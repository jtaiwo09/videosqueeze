import { CheckCircle2, FolderOpen, RotateCcw, GitCompare, Save, Trash2, Loader2 } from "lucide-react";
import { formatBytes } from "../lib/format";

interface Props {
  originalBytes: number;
  compressedBytes: number;
  savedPath: string | null;
  saving: boolean;
  /** Compare relies on matching timelines — hidden when the output was trimmed. */
  canCompare?: boolean;
  onCompare: () => void;
  onSave: () => void;
  onReveal: () => void;
  onDiscard: () => void;
  onReset: () => void;
}

export function ResultSummary({
  originalBytes,
  compressedBytes,
  savedPath,
  saving,
  canCompare = true,
  onCompare,
  onSave,
  onReveal,
  onDiscard,
  onReset,
}: Props) {
  const saved = originalBytes - compressedBytes;
  const pctSaved = originalBytes > 0 ? Math.round((saved / originalBytes) * 100) : 0;

  return (
    <div className="space-y-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        <span className="text-lg font-semibold text-white">Compressed!</span>
        {pctSaved > 0 && (
          <span className="ml-auto rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-300">
            {pctSaved}% smaller
          </span>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 text-center">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">Original</div>
          <div className="mt-1 text-xl font-semibold text-zinc-400 line-through decoration-zinc-600">
            {formatBytes(originalBytes)}
          </div>
        </div>
        <div className="text-2xl text-zinc-600">→</div>
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">Compressed</div>
          <div className="mt-1 text-2xl font-bold text-emerald-300">{formatBytes(compressedBytes)}</div>
        </div>
      </div>

      {/* Review before saving (compare needs matching timelines, so not for trims) */}
      {canCompare && (
        <button
          onClick={onCompare}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-800 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-accent hover:text-white"
        >
          <GitCompare className="h-4 w-4" />
          Compare original vs compressed
        </button>
      )}

      {savedPath ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </div>
          <div className="selectable truncate rounded-lg bg-ink-800/70 px-3 py-2 text-center text-xs text-zinc-400">
            {savedPath}
          </div>
          <button
            onClick={onReveal}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-800 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-accent hover:text-white"
          >
            <FolderOpen className="h-4 w-4" />
            Show in Finder
          </button>
        </div>
      ) : (
        <button
          onClick={onSave}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? "Saving…" : "Save compressed video…"}
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          onClick={onDiscard}
          className="flex items-center justify-center gap-2 rounded-xl border border-ink-700 bg-ink-800 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-red-500/50 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
          Discard & retry
        </button>
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-800 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-accent hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
          Compress another
        </button>
      </div>
    </div>
  );
}
