import { useEffect, useMemo, useState, useCallback } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { invoke } from "@tauri-apps/api/core";
import { tempDir, join } from "@tauri-apps/api/path";
import { Minimize2, Film, AlertTriangle } from "lucide-react";

import { createEngine } from "./engine";
import type { CompressionSettings, VideoInfo, Progress, CompressResult } from "./engine/types";
import {
  PRESETS,
  DEFAULT_CUSTOM,
  settingsFromPreset,
  settingsFromCustom,
  estimateBytes,
  type PresetId,
  type CustomConfig,
} from "./engine/presets";
import { DropZone } from "./components/DropZone";
import { QualitySelector } from "./components/QualitySelector";
import { ProgressView } from "./components/ProgressView";
import { ResultSummary } from "./components/ResultSummary";
import { CompareView } from "./components/CompareView";
import { formatBytes, formatDuration, fileName, deriveOutputName } from "./lib/format";

const VIDEO_EXTS = ["mov", "mp4", "m4v", "mkv", "avi", "webm", "flv", "wmv", "mpg", "mpeg"];

type Phase = "idle" | "ready" | "compressing" | "done" | "compare" | "error";

export default function App() {
  const engine = useMemo(() => createEngine(), []);

  const [phase, setPhase] = useState<Phase>("idle");
  const [dragging, setDragging] = useState(false);
  const [inputPath, setInputPath] = useState<string | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [probing, setProbing] = useState(false);

  const [presetId, setPresetId] = useState<PresetId>("medium");
  const [custom, setCustom] = useState<CustomConfig>(DEFAULT_CUSTOM);

  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null); // temp/preview file
  const [compressedInfo, setCompressedInfo] = useState<VideoInfo | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null); // where the user saved it
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  // Source bitrate (kbps): prefer the probed value, fall back to size/duration.
  const sourceKbps = info
    ? info.bitrateKbps ||
      Math.round((info.sizeBytes * 8) / Math.max(1, info.durationSec) / 1000)
    : 0;
  const effectiveSettings: CompressionSettings | null = info
    ? presetId === "custom"
      ? settingsFromCustom(custom, sourceKbps)
      : settingsFromPreset(PRESETS[presetId], sourceKbps)
    : null;
  const estimatedBytes =
    info && effectiveSettings ? estimateBytes(effectiveSettings, info.durationSec) : 0;

  const loadFile = useCallback(
    async (path: string) => {
      setInputPath(path);
      setInfo(null);
      setProbing(true);
      setError("");
      setPhase("ready");
      try {
        const vi = await engine.probe(path);
        setInfo(vi);
      } catch (e) {
        setError(`Couldn't read that video.\n${String(e)}`);
        setPhase("error");
      } finally {
        setProbing(false);
      }
    },
    [engine]
  );

  // Native drag-and-drop (Tauri webview).
  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      const p = event.payload;
      if (p.type === "over" || p.type === "enter") {
        setDragging(true);
      } else if (p.type === "drop") {
        setDragging(false);
        const path = p.paths?.[0];
        if (path && VIDEO_EXTS.some((ext) => path.toLowerCase().endsWith(`.${ext}`))) {
          loadFile(path);
        }
      } else {
        setDragging(false);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [loadFile]);

  const handlePick = useCallback(async () => {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Video", extensions: VIDEO_EXTS }],
    });
    if (typeof selected === "string") loadFile(selected);
  }, [loadFile]);

  const handleSelectPreset = (id: PresetId) => setPresetId(id);

  const handleChangeCustom = (patch: Partial<CustomConfig>) => {
    setCustom((prev) => ({ ...prev, ...patch }));
  };

  const handleCompress = async () => {
    if (!inputPath || !info || !effectiveSettings) return;

    const settings: CompressionSettings = { ...effectiveSettings };
    // Never upscale.
    if (settings.scaleHeight && info.height <= settings.scaleHeight) {
      settings.scaleHeight = null;
    }

    // Compress to a temp file first; the user previews/compares, then saves.
    const dir = await tempDir();
    const tempOut = await join(dir, `videosqueeze-preview-${Date.now()}.mp4`);

    setProgress(null);
    setResult(null);
    setSavedPath(null);
    setError("");
    setPhase("compressing");
    try {
      const res = await engine.compress(
        { inputPath, outputPath: tempOut, settings, durationSec: info.durationSec },
        setProgress
      );
      setResult(res);
      setPhase("done");
    } catch (e) {
      const msg = String(e);
      if (msg.includes("Canceled")) {
        setPhase("ready");
      } else {
        setError(msg);
        setPhase("error");
      }
    }
  };

  const handleCancel = () => engine.cancel();

  // Copy the temp/preview file to a user-chosen location.
  const handleSave = async () => {
    if (!result || !inputPath) return;
    const dest = await save({
      defaultPath: deriveOutputName(inputPath),
      filters: [{ name: "Video", extensions: ["mp4"] }],
    });
    if (!dest) return; // cancelled
    if (dest === inputPath) {
      setError(
        "The compressed file can't overwrite the original.\nPlease choose a different file name or location."
      );
      setPhase("error");
      return;
    }
    setSaving(true);
    try {
      await invoke("copy_file", { src: result.outputPath, dest });
      setSavedPath(dest);
    } catch (e) {
      setError(`Couldn't save the file.\n${String(e)}`);
      setPhase("error");
    } finally {
      setSaving(false);
    }
  };

  const openCompare = async () => {
    if (!result) return;
    setPhase("compare");
    setCompressedInfo(null);
    try {
      const ci = await engine.probe(result.outputPath);
      setCompressedInfo(ci);
    } catch {
      // Non-fatal: the comparison still works, we just won't show compressed dimensions.
    }
  };

  const cleanupTemp = async () => {
    if (result) {
      try {
        await invoke("delete_file", { path: result.outputPath });
      } catch {
        /* ignore — file may already be gone */
      }
    }
  };

  const discardCompressed = async () => {
    await cleanupTemp();
    setResult(null);
    setCompressedInfo(null);
    setSavedPath(null);
    setProgress(null);
    setPhase("ready"); // keep the loaded source so the user can try another quality
  };

  const reset = async () => {
    await cleanupTemp();
    setPhase("idle");
    setInputPath(null);
    setInfo(null);
    setResult(null);
    setCompressedInfo(null);
    setSavedPath(null);
    setProgress(null);
    setError("");
  };

  // Reveal the saved file (only meaningful once saved).
  const reveal = () => {
    if (savedPath) invoke("reveal_in_finder", { path: savedPath });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="flex items-center gap-2.5 px-7 pb-2 pt-7">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <Minimize2 className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-lg font-semibold leading-none text-white">VideoSqueeze</h1>
          <p className="mt-0.5 text-xs text-zinc-500">Fast local compression · stays on your Mac</p>
        </div>
      </header>

      <main className="flex-1 px-7 pb-7 pt-3">
        {phase === "idle" && <DropZone dragging={dragging} onPick={handlePick} />}

        {phase === "error" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="font-medium text-white">Something went wrong</p>
                <pre className="selectable mt-2 whitespace-pre-wrap break-words text-xs text-red-300/80">
                  {error}
                </pre>
              </div>
            </div>
            <button
              onClick={reset}
              className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-bright"
            >
              Start over
            </button>
          </div>
        )}

        {(phase === "ready" || phase === "compressing" || phase === "done") && inputPath && (
          <div className="space-y-5">
            <FileCard name={fileName(inputPath)} info={info} probing={probing} />

            {phase === "ready" && (
              <>
                <QualitySelector
                  presetId={presetId}
                  custom={custom}
                  sourceHeight={info?.height ?? 4320}
                  onSelectPreset={handleSelectPreset}
                  onChangeCustom={handleChangeCustom}
                />

                <div className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Estimated size</div>
                    <div className="mt-0.5 text-sm text-zinc-300">
                      {info ? (
                        <>
                          <span className="font-semibold text-white">~{formatBytes(estimatedBytes)}</span>
                          <span className="text-zinc-500"> from {formatBytes(info.sizeBytes)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleCompress}
                    disabled={!info || probing}
                    className="rounded-xl bg-accent px-6 py-2.5 font-medium text-white transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Compress
                  </button>
                </div>
                <p className="text-center text-xs text-zinc-600">
                  Estimate is approximate — the exact size is shown as it encodes.
                </p>
              </>
            )}

            {phase === "compressing" && <ProgressView progress={progress} onCancel={handleCancel} />}

            {phase === "done" && result && info && (
              <ResultSummary
                originalBytes={info.sizeBytes}
                compressedBytes={result.outputBytes}
                savedPath={savedPath}
                saving={saving}
                onCompare={openCompare}
                onSave={handleSave}
                onReveal={reveal}
                onDiscard={discardCompressed}
                onReset={reset}
              />
            )}
          </div>
        )}

        {phase === "compare" && inputPath && info && result && (
          <CompareView
            originalPath={inputPath}
            compressedPath={result.outputPath}
            originalInfo={info}
            compressedInfo={compressedInfo}
            savedPath={savedPath}
            saving={saving}
            onBack={() => setPhase("done")}
            onSave={handleSave}
            onReveal={reveal}
            onDiscard={discardCompressed}
          />
        )}
      </main>
    </div>
  );
}

function FileCard({
  name,
  info,
  probing,
}: {
  name: string;
  info: VideoInfo | null;
  probing: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-800/50 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-accent-bright">
        <Film className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-white">{name}</div>
        <div className="mt-0.5 text-xs text-zinc-400">
          {probing
            ? "Reading…"
            : info
            ? `${info.width}×${info.height} · ${formatDuration(info.durationSec)} · ${formatBytes(
                info.sizeBytes
              )} · ${info.videoCodec.toUpperCase()}`
            : "—"}
        </div>
      </div>
    </div>
  );
}
