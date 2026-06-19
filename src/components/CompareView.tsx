import { useRef, useState, useEffect, useCallback } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Columns2,
  SquareSplitHorizontal,
  ArrowLeft,
  FolderOpen,
  Trash2,
  Save,
  Loader2,
} from "lucide-react";
import type { VideoInfo } from "../engine/types";
import { formatBytes, formatDuration } from "../lib/format";

interface Props {
  originalPath: string;
  compressedPath: string;
  originalInfo: VideoInfo;
  compressedInfo: VideoInfo | null;
  savedPath: string | null;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  onReveal: () => void;
  onDiscard: () => void;
}

type Mode = "side" | "slider";

// Keep the compressed video locked to the original's playhead.
const DRIFT_TOLERANCE = 0.18; // seconds

export function CompareView({
  originalPath,
  compressedPath,
  originalInfo,
  compressedInfo,
  savedPath,
  saving,
  onBack,
  onSave,
  onReveal,
  onDiscard,
}: Props) {
  const origRef = useRef<HTMLVideoElement>(null);
  const compRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode>("side");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState(originalInfo.durationSec || 0);
  const [current, setCurrent] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [split, setSplit] = useState(50); // % position of the slider divider

  const origSrc = convertFileSrc(originalPath);
  const compSrc = convertFileSrc(compressedPath);

  const pctSaved =
    compressedInfo && originalInfo.sizeBytes > 0
      ? Math.round(((originalInfo.sizeBytes - compressedInfo.sizeBytes) / originalInfo.sizeBytes) * 100)
      : 0;

  const syncCompressed = useCallback((force = false) => {
    const o = origRef.current;
    const c = compRef.current;
    if (!o || !c) return;
    if (force || Math.abs(c.currentTime - o.currentTime) > DRIFT_TOLERANCE) {
      c.currentTime = o.currentTime;
    }
  }, []);

  const togglePlay = useCallback(() => {
    const o = origRef.current;
    const c = compRef.current;
    if (!o || !c) return;
    if (o.paused) {
      syncCompressed(true);
      void o.play();
      void c.play();
      setPlaying(true);
    } else {
      o.pause();
      c.pause();
      setPlaying(false);
    }
  }, [syncCompressed]);

  const seekTo = useCallback((t: number) => {
    const o = origRef.current;
    const c = compRef.current;
    if (!o || !c) return;
    o.currentTime = t;
    c.currentTime = t;
    setCurrent(t);
  }, []);

  // Media-event handlers bound directly on the <video> in JSX, so they work in
  // both view modes (the element remounts when the mode switches).
  const handleMeta = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) =>
      setDuration(e.currentTarget.duration || originalInfo.durationSec || 0),
    [originalInfo.durationSec]
  );
  const handleTime = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      if (!scrubbing) setCurrent(e.currentTarget.currentTime);
      syncCompressed();
    },
    [scrubbing, syncCompressed]
  );
  const handleEnded = useCallback(() => {
    setPlaying(false);
    origRef.current?.pause();
    compRef.current?.pause();
  }, []);

  // Drive the playhead with requestAnimationFrame while playing — reliable and
  // smooth (timeupdate alone can be sparse or stall with streamed sources).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const o = origRef.current;
      if (o && !scrubbing) setCurrent(o.currentTime);
      syncCompressed();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, scrubbing, syncCompressed]);

  // A mode switch remounts the <video> elements — restore position & playback.
  useEffect(() => {
    const o = origRef.current;
    const c = compRef.current;
    if (!o || !c) return;
    o.currentTime = current;
    c.currentTime = current;
    if (playing) {
      void o.play();
      void c.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Keyboard: space = play/pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  // Slider drag (split mode).
  const handleSplitPointer = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(0, Math.min(100, pct)));
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-zinc-300 hover:border-ink-600 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h2 className="text-lg font-semibold text-white">Compare quality</h2>
        {pctSaved > 0 && (
          <span className="ml-auto rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-300">
            {pctSaved}% smaller
          </span>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <ModeButton active={mode === "side"} onClick={() => setMode("side")} icon={Columns2} label="Side by side" />
        <ModeButton
          active={mode === "slider"}
          onClick={() => setMode("slider")}
          icon={SquareSplitHorizontal}
          label="Split slider"
        />
      </div>

      {/* Players */}
      {mode === "side" ? (
        <div className="grid grid-cols-2 gap-3">
          <Panel
            label="Original"
            badge={formatBytes(originalInfo.sizeBytes)}
            sub={`${originalInfo.width}×${originalInfo.height}`}
            tone="neutral"
          >
            <video
              ref={origRef}
              src={origSrc}
              muted={muted}
              playsInline
              preload="auto"
              onLoadedMetadata={handleMeta}
              onTimeUpdate={handleTime}
              onEnded={handleEnded}
              className="h-full w-full object-contain"
            />
          </Panel>
          <Panel
            label="Compressed"
            badge={compressedInfo ? formatBytes(compressedInfo.sizeBytes) : "…"}
            sub={compressedInfo ? `${compressedInfo.width}×${compressedInfo.height}` : ""}
            tone="good"
          >
            <video ref={compRef} src={compSrc} muted playsInline className="h-full w-full object-contain" />
          </Panel>
        </div>
      ) : (
        <div
          ref={trackRef}
          className="relative aspect-video w-full select-none overflow-hidden rounded-xl border border-ink-700 bg-black"
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            handleSplitPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) handleSplitPointer(e.clientX);
          }}
        >
          {/* Base: original (right side shows through) */}
          <video
            ref={origRef}
            src={origSrc}
            muted={muted}
            playsInline
            preload="auto"
            onLoadedMetadata={handleMeta}
            onTimeUpdate={handleTime}
            onEnded={handleEnded}
            className="absolute inset-0 h-full w-full object-contain"
          />
          {/* Overlay: compressed, clipped to the left of the divider */}
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
            <video ref={compRef} src={compSrc} muted playsInline className="h-full w-full object-contain" />
          </div>
          {/* Divider */}
          <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white/90" style={{ left: `${split}%` }}>
            <div className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink-900 shadow-lg">
              <SquareSplitHorizontal className="h-4 w-4" />
            </div>
          </div>
          {/* Corner labels */}
          <span className="absolute left-2 top-2 z-10 rounded bg-emerald-500/80 px-2 py-0.5 text-xs font-medium text-white">
            Compressed{compressedInfo ? ` · ${formatBytes(compressedInfo.sizeBytes)}` : ""}
          </span>
          <span className="absolute right-2 top-2 z-10 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
            Original · {formatBytes(originalInfo.sizeBytes)}
          </span>
        </div>
      )}

      {/* Transport */}
      <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-3">
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-bright"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
        </button>
        <span className="shrink-0 text-xs tabular-nums text-zinc-400">{formatDuration(current)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={current}
          onMouseDown={() => setScrubbing(true)}
          onMouseUp={() => setScrubbing(false)}
          onChange={(e) => seekTo(Number(e.target.value))}
          className="h-1.5 flex-1 accent-indigo-400"
        />
        <span className="shrink-0 text-xs tabular-nums text-zinc-400">{formatDuration(duration)}</span>
        <button
          onClick={() => setMuted((m) => !m)}
          title={muted ? "Unmute original audio" : "Mute"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-700 bg-ink-800 text-zinc-300 hover:text-white"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      <p className="text-center text-xs text-zinc-600">
        Both videos play in sync. Audio (when unmuted) comes from the original. Press space to play/pause.
      </p>

      {/* Decision actions */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={onDiscard}
          className="flex items-center justify-center gap-2 rounded-xl border border-ink-700 bg-ink-800 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-red-500/50 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" /> Discard & retry
        </button>
        {savedPath ? (
          <button
            onClick={onReveal}
            className="flex items-center justify-center gap-2 rounded-xl border border-ink-700 bg-ink-800 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-accent hover:text-white"
          >
            <FolderOpen className="h-4 w-4" /> Show in Finder
          </button>
        ) : (
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save video"}
          </button>
        )}
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-800 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-accent hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Columns2;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-accent-bright bg-accent/20 text-white"
          : "border-ink-700 bg-ink-800 text-zinc-300 hover:border-ink-600"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Panel({
  label,
  badge,
  sub,
  tone,
  children,
}: {
  label: string;
  badge: string;
  sub: string;
  tone: "neutral" | "good";
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-700 bg-black">
      <div className="flex aspect-video items-center justify-center bg-black">{children}</div>
      <div className="flex items-center justify-between border-t border-ink-800 bg-ink-900/80 px-3 py-2">
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="flex items-center gap-2 text-xs">
          {sub && <span className="text-zinc-500">{sub}</span>}
          <span
            className={`rounded px-2 py-0.5 font-medium ${
              tone === "good" ? "bg-emerald-500/20 text-emerald-300" : "bg-ink-700 text-zinc-300"
            }`}
          >
            {badge}
          </span>
        </span>
      </div>
    </div>
  );
}
