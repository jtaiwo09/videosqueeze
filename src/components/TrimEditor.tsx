import { useRef, useState, useEffect, useCallback } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Play, Pause, Scissors, RotateCcw } from "lucide-react";
import { formatDuration } from "../lib/format";

interface Props {
  path: string;
  /** Full source duration in seconds. */
  duration: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}

/** Smallest selectable clip. */
const MIN_LEN = 0.2;

type Handle = "start" | "end" | null;

export function TrimEditor({ path, duration, start, end, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [current, setCurrent] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState<Handle>(null);

  const src = convertFileSrc(path);
  const pct = (t: number) => (duration > 0 ? (t / duration) * 100 : 0);
  const trimmed = start > 0.05 || end < duration - 0.05;

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    const clamped = Math.max(0, Math.min(duration, t));
    if (v) v.currentTime = clamped;
    setCurrent(clamped);
  }, [duration]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      // Always play from within the selection.
      if (v.currentTime < start || v.currentTime >= end - 0.02) v.currentTime = start;
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [start, end]);

  // Drive the playhead and stop at the out-point.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        if (v.currentTime >= end) {
          v.pause();
          v.currentTime = end;
          setCurrent(end);
          setPlaying(false);
          return;
        }
        setCurrent(v.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, end]);

  // Map a pointer x-position to a time on the track.
  const timeAt = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, ratio)) * duration;
  }, [duration]);

  // Global pointer handlers while dragging a handle.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const t = timeAt(e.clientX);
      if (dragging === "start") {
        const ns = Math.min(t, end - MIN_LEN);
        onChange(Math.max(0, ns), end);
        seek(Math.max(0, ns));
      } else {
        const ne = Math.max(t, start + MIN_LEN);
        onChange(start, Math.min(duration, ne));
        seek(Math.min(duration, ne));
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, start, end, duration, onChange, seek, timeAt]);

  const setInAtPlayhead = () => {
    const ns = Math.min(current, end - MIN_LEN);
    onChange(Math.max(0, ns), end);
  };
  const setOutAtPlayhead = () => {
    const ne = Math.max(current, start + MIN_LEN);
    onChange(start, Math.min(duration, ne));
  };
  const resetTrim = () => {
    onChange(0, duration);
    seek(0);
  };

  return (
    <div className="space-y-3 rounded-xl border border-ink-700 bg-ink-900/60 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <Scissors className="h-4 w-4 text-accent-bright" /> Trim
        </span>
        <span className="text-xs text-zinc-500">
          {trimmed ? (
            <>
              Keeping{" "}
              <span className="font-medium text-emerald-300">
                {formatDuration(end - start)}
              </span>{" "}
              of {formatDuration(duration)}
            </>
          ) : (
            <>Whole video · {formatDuration(duration)}</>
          )}
        </span>
      </div>

      {/* Preview */}
      <div className="overflow-hidden rounded-lg border border-ink-700 bg-black">
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="auto"
          onClick={togglePlay}
          onLoadedMetadata={() => seek(start)}
          className="mx-auto aspect-video max-h-64 w-full object-contain"
        />
      </div>

      {/* Timeline */}
      <div
        ref={trackRef}
        className="relative h-9 w-full cursor-pointer select-none rounded-lg bg-ink-800"
        onPointerDown={(e) => {
          // Click on the track body seeks (handles stop propagation).
          seek(timeAt(e.clientX));
        }}
      >
        {/* Dimmed (removed) regions */}
        <div
          className="absolute inset-y-0 left-0 rounded-l-lg bg-ink-900/70"
          style={{ width: `${pct(start)}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-lg bg-ink-900/70"
          style={{ width: `${100 - pct(end)}%` }}
        />
        {/* Selected region */}
        <div
          className="absolute inset-y-0 border-y-2 border-accent-bright bg-accent/15"
          style={{ left: `${pct(start)}%`, right: `${100 - pct(end)}%` }}
        />
        {/* Playhead */}
        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white"
          style={{ left: `${pct(current)}%` }}
        />
        {/* Handles */}
        <Handle pos={pct(start)} onDown={() => setDragging("start")} />
        <Handle pos={pct(end)} onDown={() => setDragging("end")} />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white hover:bg-accent-bright"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
        </button>
        <span className="shrink-0 text-xs tabular-nums text-zinc-400">
          {formatDuration(current)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={setInAtPlayhead}
            className="rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-accent hover:text-white"
            title="Set start at the playhead"
          >
            Set start
          </button>
          <button
            onClick={setOutAtPlayhead}
            className="rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-accent hover:text-white"
            title="Set end at the playhead"
          >
            Set end
          </button>
          {trimmed && (
            <button
              onClick={resetTrim}
              className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-ink-600 hover:text-zinc-200"
              title="Clear trim"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Handle({ pos, onDown }: { pos: number; onDown: () => void }) {
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        onDown();
      }}
      className="absolute inset-y-0 z-20 flex w-3 -translate-x-1/2 cursor-ew-resize items-center justify-center"
      style={{ left: `${pos}%` }}
    >
      <div className="h-full w-1.5 rounded-full bg-accent-bright shadow" />
    </div>
  );
}
