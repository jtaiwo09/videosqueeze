import { Film, X, RefreshCw } from "lucide-react";
import type { VideoInfo } from "../engine/types";
import { formatBytes, formatDuration } from "../lib/format";

interface Props {
  name: string;
  info: VideoInfo | null;
  probing: boolean;
  /** Shown only when provided (e.g. while the source is still swappable). */
  onChange?: () => void;
  onRemove?: () => void;
}

/** The loaded-source summary row: name, dimensions/duration/size/codec. */
export function FileCard({ name, info, probing, onChange, onRemove }: Props) {
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
                  info.sizeBytes,
                )} · ${info.videoCodec.toUpperCase()}`
              : "—"}
        </div>
      </div>
      {(onChange || onRemove) && (
        <div className="flex shrink-0 items-center gap-1.5">
          {onChange && (
            <button
              onClick={onChange}
              title="Choose a different video"
              className="flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-accent hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Change
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              title="Remove video"
              aria-label="Remove video"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
