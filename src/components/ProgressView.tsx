import { Loader2, X } from "lucide-react";
import type { Progress } from "../engine/types";
import { formatBytes, formatEta } from "../lib/format";

interface Props {
  progress: Progress | null;
  onCancel: () => void;
}

export function ProgressView({ progress, onCancel }: Props) {
  const pct = Math.round((progress?.ratio ?? 0) * 100);

  return (
    <div className="space-y-5 rounded-2xl border border-ink-700 bg-ink-900/60 p-6">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-accent-bright" />
        <span className="font-medium text-white">Compressing…</span>
        <span className="ml-auto text-2xl font-semibold tabular-nums text-accent-bright">{pct}%</span>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Speed" value={progress?.speed ? `${progress.speed.toFixed(1)}×` : "—"} />
        <Stat label="Output so far" value={formatBytes(progress?.outBytes ?? 0)} />
        <Stat label="Time left" value={formatEta(progress?.etaSec ?? null)} />
      </div>

      <button
        onClick={onCancel}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-800 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-red-500/50 hover:text-red-300"
      >
        <X className="h-4 w-4" />
        Cancel
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-800/70 py-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}
