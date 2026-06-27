import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type {
  CompressionEngine,
  CompressionSettings,
  VideoInfo,
  Progress,
  CompressResult,
} from "../engine/types";
import {
  estimateBytes,
  deriveSettings,
  sourceKbpsOf,
  targetBytesOf,
  isUnderTargetSize,
} from "../engine/presets";
import { formatBytes, deriveOutputName } from "../lib/format";
import { compressToTemp } from "../lib/compression";
import type { QualitySettings } from "./useQualitySettings";

export type SinglePhase =
  | "idle"
  | "ready"
  | "compressing"
  | "done"
  | "compare"
  | "error";

/** Below this many seconds of head/tail movement, the clip is "the whole video". */
const TRIM_EPSILON = 0.05;

/**
 * Owns the single-file flow: loading/probing, trim selection, the derived size
 * estimate, and the compress → review → save lifecycle.
 */
export function useSingleCompression(
  engine: CompressionEngine,
  quality: QualitySettings,
) {
  const [phase, setPhase] = useState<SinglePhase>("idle");
  const [inputPath, setInputPath] = useState<string | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [probing, setProbing] = useState(false);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState<number | null>(null);

  const [progress, setProgress] = useState<Progress | null>(null);
  const [resultTrimmed, setResultTrimmed] = useState(false);
  const [compressedInfo, setCompressedInfo] = useState<VideoInfo | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Result is mirrored in a ref so cleanup stays stable (no stale closures).
  const [result, setResultState] = useState<CompressResult | null>(null);
  const resultRef = useRef<CompressResult | null>(null);
  const setResult = useCallback((r: CompressResult | null) => {
    resultRef.current = r;
    setResultState(r);
  }, []);

  // ---- Derived (trim → effective duration/size/settings) ----
  const { presetId, custom, target } = quality;
  const fullDuration = info?.durationSec ?? 0;
  const trimEndEff = trimEnd ?? fullDuration;
  const isTrimmed =
    !!info &&
    (trimStart > TRIM_EPSILON || trimEndEff < fullDuration - TRIM_EPSILON);
  const effectiveDuration = isTrimmed
    ? Math.max(0, trimEndEff - trimStart)
    : fullDuration;
  const effectiveSourceBytes =
    info && fullDuration > 0
      ? info.sizeBytes * (effectiveDuration / fullDuration)
      : (info?.sizeBytes ?? 0);

  const effectiveSettings: CompressionSettings | null = info
    ? deriveSettings(presetId, custom, target, sourceKbpsOf(info), effectiveDuration)
    : null;
  const estimatedBytes =
    info && effectiveSettings
      ? estimateBytes(effectiveSettings, effectiveDuration)
      : 0;

  const alreadyUnderTarget =
    !!info && isUnderTargetSize(presetId, target, effectiveSourceBytes);

  // Warn only when the requested size is unreachable at watchable quality.
  const targetHint =
    presetId === "target" && info && !alreadyUnderTarget
      ? estimatedBytes > targetBytesOf(target) * 1.04
        ? `Can't reach ${target.targetMB} MB at watchable quality — smallest here is ~${formatBytes(
            estimatedBytes,
          )}.${effectiveSettings?.scaleHeight ? "" : " Try a lower resolution."}`
        : ""
      : "";

  // ---- Actions ----
  const cleanupTemp = useCallback(async () => {
    const r = resultRef.current;
    if (!r) return;
    try {
      await invoke("delete_file", { path: r.outputPath });
    } catch {
      /* ignore — file may already be gone */
    }
  }, []);

  const reset = useCallback(async () => {
    await cleanupTemp();
    setPhase("idle");
    setInputPath(null);
    setInfo(null);
    setResult(null);
    setCompressedInfo(null);
    setSavedPath(null);
    setProgress(null);
    setError("");
    setTrimStart(0);
    setTrimEnd(null);
  }, [cleanupTemp, setResult]);

  const load = useCallback(
    async (path: string) => {
      await cleanupTemp();
      setInputPath(path);
      setInfo(null);
      setResult(null);
      setSavedPath(null);
      setProbing(true);
      setError("");
      setPhase("ready");
      setTrimStart(0);
      setTrimEnd(null);
      try {
        const probed = await engine.probe(path);
        setInfo(probed);
        setTrimEnd(probed.durationSec);
      } catch (e) {
        setError(`Couldn't read that video.\n${String(e)}`);
        setPhase("error");
      } finally {
        setProbing(false);
      }
    },
    [engine, cleanupTemp, setResult],
  );

  const setTrim = useCallback((start: number, end: number) => {
    setTrimStart(start);
    setTrimEnd(end);
  }, []);

  const compress = async () => {
    if (!inputPath || !info || !effectiveSettings) return;
    setProgress(null);
    setResult(null);
    setSavedPath(null);
    setError("");
    setResultTrimmed(isTrimmed);
    setPhase("compressing");
    try {
      const res = await compressToTemp(engine, {
        inputPath,
        info,
        settings: effectiveSettings,
        durationSec: effectiveDuration,
        trim: isTrimmed ? { start: trimStart, end: trimEndEff } : null,
        label: "preview",
        onProgress: setProgress,
      });
      setResult(res);
      setPhase("done");
    } catch (e) {
      const msg = String(e);
      if (msg.includes("Canceled")) setPhase("ready");
      else {
        setError(msg);
        setPhase("error");
      }
    }
  };

  const cancel = () => engine.cancel();

  const saveAs = async () => {
    if (!result || !inputPath) return;
    const dest = await save({
      defaultPath: deriveOutputName(inputPath),
      filters: [{ name: "Video", extensions: ["mp4"] }],
    });
    if (!dest) return; // cancelled
    if (dest === inputPath) {
      setError(
        "The compressed file can't overwrite the original.\nPlease choose a different file name or location.",
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
      setCompressedInfo(await engine.probe(result.outputPath));
    } catch {
      // Non-fatal: comparison still works, we just won't show compressed dimensions.
    }
  };

  const backToResult = () => setPhase("done");

  const discard = async () => {
    await cleanupTemp();
    setResult(null);
    setCompressedInfo(null);
    setSavedPath(null);
    setProgress(null);
    setPhase("ready"); // keep the source loaded so the user can try another quality
  };

  const reveal = () => {
    if (savedPath) invoke("reveal_in_finder", { path: savedPath });
  };

  return {
    // state
    phase,
    inputPath,
    info,
    probing,
    trimStart,
    trimEnd: trimEndEff,
    progress,
    result,
    resultTrimmed,
    compressedInfo,
    savedPath,
    saving,
    error,
    // derived
    fullDuration,
    isTrimmed,
    effectiveDuration,
    effectiveSourceBytes,
    estimatedBytes,
    alreadyUnderTarget,
    targetHint,
    // actions
    load,
    reset,
    setTrim,
    compress,
    cancel,
    saveAs,
    openCompare,
    backToResult,
    discard,
    reveal,
  };
}

export type SingleCompression = ReturnType<typeof useSingleCompression>;
