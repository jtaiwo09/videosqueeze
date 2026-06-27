import {
  Film,
  X,
  FolderOpen,
  Folder,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Layers,
  Play,
  RotateCcw,
} from "lucide-react";
import { formatBytes, formatDuration, fileName, formatEta } from "../lib/format";
import type { QueueItem, QueueStatus } from "../hooks/useBatchQueue";

interface Props {
  items: QueueItem[];
  running: boolean;
  outputFolder: string | null;
  /** Estimated output size (bytes) for a queued item under the current settings. */
  estimateFor: (item: QueueItem) => number;
  /** Whether a queued item is already under the target size (target mode only). */
  underTargetFor: (item: QueueItem) => boolean;
  onCompressAll: () => void;
  onCancel: () => void;
  onRemove: (id: string) => void;
  onChangeFolder: () => void;
  onClearFolder: () => void;
  onReveal: (path: string) => void;
  onReset: () => void;
}

export function BatchQueue({
  items,
  running,
  outputFolder,
  estimateFor,
  underTargetFor,
  onCompressAll,
  onCancel,
  onRemove,
  onChangeFolder,
  onClearFolder,
  onReveal,
  onReset,
}: Props) {
  const probing = items.some((i) => i.status === "probing");
  const allDone = items.length > 0 && items.every((i) => i.status === "done");
  const anyDone = items.some((i) => i.status === "done");

  const originalTotal = items.reduce((sum, i) => sum + (i.info?.sizeBytes ?? 0), 0);
  const resultTotal = items.reduce((sum, i) => sum + (i.outputBytes ?? 0), 0);
  const pctSaved =
    anyDone && originalTotal > 0
      ? Math.round(((originalTotal - resultTotal) / originalTotal) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-accent-bright">
          <Layers className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-medium text-white">{items.length} videos queued</div>
          <div className="text-xs text-zinc-500">
            {allDone
              ? `Done · ${pctSaved}% smaller overall`
              : `${formatBytes(originalTotal)} total · one quality applies to all`}
          </div>
        </div>
        {anyDone && pctSaved > 0 && (
          <span className="ml-auto rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-300">
            {pctSaved}% smaller
          </span>
        )}
      </div>

      {/* Output destination */}
      <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-3">
        <Folder className="h-4 w-4 shrink-0 text-zinc-500" />
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Save to</div>
          <div className="truncate text-sm text-zinc-300">
            {outputFolder ?? "Next to each original file"}
          </div>
        </div>
        {outputFolder && !running && (
          <button
            onClick={onClearFolder}
            className="shrink-0 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Reset
          </button>
        )}
        {!running && (
          <button
            onClick={onChangeFolder}
            className="shrink-0 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-accent hover:text-white"
          >
            Change folder…
          </button>
        )}
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {items.map((item) => (
          <Row
            key={item.id}
            item={item}
            running={running}
            estimateBytes={estimateFor(item)}
            underTarget={underTargetFor(item)}
            onRemove={() => onRemove(item.id)}
            onReveal={() => item.savedPath && onReveal(item.savedPath)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {running ? (
          <button
            onClick={onCancel}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-800 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-red-500/50 hover:text-red-300"
          >
            <X className="h-4 w-4" /> Cancel
          </button>
        ) : allDone ? (
          <button
            onClick={onReset}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-3 font-medium text-white transition-colors hover:bg-accent-bright"
          >
            <RotateCcw className="h-4 w-4" /> Compress more
          </button>
        ) : (
          <>
            <button
              onClick={onReset}
              className="flex items-center justify-center gap-2 rounded-xl border border-ink-700 bg-ink-800 px-5 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-ink-600 hover:text-white"
            >
              Start over
            </button>
            <button
              onClick={onCompressAll}
              disabled={probing || items.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-3 font-medium text-white transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="h-4 w-4" />
              {probing ? "Reading videos…" : "Compress all"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  item,
  running,
  estimateBytes,
  underTarget,
  onRemove,
  onReveal,
}: {
  item: QueueItem;
  running: boolean;
  estimateBytes: number;
  underTarget: boolean;
  onRemove: () => void;
  onReveal: () => void;
}) {
  const { info, status } = item;
  const pct = Math.round((item.progress?.ratio ?? 0) * 100);
  const savedPct =
    status === "done" && info && info.sizeBytes > 0 && item.outputBytes != null
      ? Math.round(((info.sizeBytes - item.outputBytes) / info.sizeBytes) * 100)
      : 0;

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-800/50 p-3">
      <div className="flex items-center gap-3">
        <StatusIcon status={status} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">
            {fileName(item.path)}
          </div>
          <div className="mt-0.5 truncate text-xs text-zinc-500">
            {status === "probing"
              ? "Reading…"
              : status === "error"
                ? <span className="text-red-300/80">{item.error || "Failed"}</span>
                : info
                  ? `${info.width}×${info.height} · ${formatDuration(info.durationSec)} · ${formatBytes(info.sizeBytes)}`
                  : "—"}
          </div>
        </div>

        {/* Right-side status */}
        <div className="shrink-0 text-right">
          {status === "queued" &&
            info &&
            (underTarget ? (
              <div className="text-xs font-medium text-emerald-300/80">Under target</div>
            ) : (
              <div className="text-xs text-zinc-400">
                <span className="text-zinc-500">est. </span>
                <span className="font-medium text-zinc-300">~{formatBytes(estimateBytes)}</span>
              </div>
            ))}
          {status === "compressing" && (
            <div className="text-xs tabular-nums text-accent-bright">{pct}%</div>
          )}
          {status === "done" &&
            info &&
            (item.passedThrough ? (
              <div className="text-xs text-zinc-400">Under target · kept as-is</div>
            ) : (
              item.outputBytes != null && (
                <div className="text-xs">
                  <span className="font-semibold text-emerald-300">
                    {formatBytes(item.outputBytes)}
                  </span>
                  {savedPct > 0 && (
                    <span className="text-zinc-500"> · {savedPct}% smaller</span>
                  )}
                </div>
              )
            ))}
          {status === "canceled" && <div className="text-xs text-zinc-500">Canceled</div>}
        </div>

        {/* Trailing button */}
        {status === "done" ? (
          <button
            onClick={onReveal}
            title="Show in Finder"
            aria-label="Show in Finder"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-zinc-400 transition-colors hover:border-accent hover:text-white"
          >
            <FolderOpen className="h-4 w-4" />
          </button>
        ) : !running ? (
          <button
            onClick={onRemove}
            title="Remove from queue"
            aria-label="Remove from queue"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-zinc-400 transition-colors hover:border-red-500/50 hover:text-red-300"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <div className="h-8 w-8 shrink-0" />
        )}
      </div>

      {/* Progress bar while compressing */}
      {status === "compressing" && (
        <div className="mt-2.5 space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] tabular-nums text-zinc-500">
            <span>
              {item.progress?.speed ? `${item.progress.speed.toFixed(1)}×` : "—"} ·{" "}
              {formatBytes(item.progress?.outBytes ?? 0)}
            </span>
            <span>{formatEta(item.progress?.etaSec ?? null)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: QueueStatus }) {
  const base = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg";
  switch (status) {
    case "compressing":
      return (
        <div className={`${base} bg-ink-700 text-accent-bright`}>
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      );
    case "done":
      return (
        <div className={`${base} bg-emerald-500/15 text-emerald-400`}>
          <CheckCircle2 className="h-4 w-4" />
        </div>
      );
    case "error":
      return (
        <div className={`${base} bg-red-500/10 text-red-400`}>
          <AlertTriangle className="h-4 w-4" />
        </div>
      );
    default:
      return (
        <div className={`${base} bg-ink-700 text-zinc-400`}>
          <Film className="h-4 w-4" />
        </div>
      );
  }
}
