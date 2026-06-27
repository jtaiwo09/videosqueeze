import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { DropZone } from "./DropZone";
import { FileCard } from "./FileCard";
import { TrimEditor } from "./TrimEditor";
import { QualitySelector } from "./quality/QualitySelector";
import { ProgressView } from "./ProgressView";
import { ResultSummary } from "./ResultSummary";
import { CompareView } from "./CompareView";
import { formatBytes, formatDuration, fileName } from "../lib/format";
import type { SingleCompression } from "../hooks/useSingleCompression";
import type { QualitySettings } from "../hooks/useQualitySettings";

interface Props {
  single: SingleCompression;
  quality: QualitySettings;
  dragging: boolean;
  onPick: () => void;
}

/** Single-file mode: the full load → trim → compress → review → save flow. */
export function SingleFileView({ single, quality, dragging, onPick }: Props) {
  const { phase, inputPath } = single;

  if (phase === "idle") {
    return <DropZone dragging={dragging} onPick={onPick} />;
  }

  if (phase === "error") {
    return <ErrorPanel message={single.error} onReset={single.reset} />;
  }

  if (phase === "compare" && inputPath && single.info && single.result) {
    return (
      <CompareView
        originalPath={inputPath}
        compressedPath={single.result.outputPath}
        originalInfo={single.info}
        compressedInfo={single.compressedInfo}
        savedPath={single.savedPath}
        saving={single.saving}
        onBack={single.backToResult}
        onSave={single.saveAs}
        onReveal={single.reveal}
        onDiscard={single.discard}
      />
    );
  }

  if (!inputPath) return null;

  return (
    <div className="space-y-5">
      <FileCard
        name={fileName(inputPath)}
        info={single.info}
        probing={single.probing}
        onChange={phase === "ready" ? onPick : undefined}
        onRemove={phase === "ready" ? single.reset : undefined}
      />

      {phase === "ready" && <ReadyPanel single={single} quality={quality} />}

      {phase === "compressing" && (
        <ProgressView progress={single.progress} onCancel={single.cancel} />
      )}

      {phase === "done" && single.result && single.info && (
        <ResultSummary
          originalBytes={Math.round(single.effectiveSourceBytes)}
          compressedBytes={single.result.outputBytes}
          savedPath={single.savedPath}
          saving={single.saving}
          canCompare={!single.resultTrimmed}
          onCompare={single.openCompare}
          onSave={single.saveAs}
          onReveal={single.reveal}
          onDiscard={single.discard}
          onReset={single.reset}
        />
      )}
    </div>
  );
}

/** Trim + quality + size estimate (or the "already under target" completion state). */
function ReadyPanel({
  single,
  quality,
}: {
  single: SingleCompression;
  quality: QualitySettings;
}) {
  const { info, inputPath } = single;

  return (
    <>
      {info && inputPath && (
        <TrimEditor
          path={inputPath}
          duration={single.fullDuration}
          start={single.trimStart}
          end={single.trimEnd}
          onChange={single.setTrim}
        />
      )}

      <QualitySelector
        presetId={quality.presetId}
        custom={quality.custom}
        target={quality.target}
        sourceHeight={info?.height ?? 4320}
        onSelectPreset={quality.selectPreset}
        onChangeCustom={quality.changeCustom}
        onChangeTarget={quality.changeTarget}
      />

      {single.alreadyUnderTarget ? (
        <UnderTargetNotice single={single} target={quality.target.targetMB} />
      ) : (
        <SizeEstimate single={single} />
      )}
    </>
  );
}

function SizeEstimate({ single }: { single: SingleCompression }) {
  const { info } = single;
  return (
    <>
      <div className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Estimated size
          </div>
          <div className="mt-0.5 text-sm text-zinc-300">
            {info ? (
              <>
                <span className="font-semibold text-white">
                  ~{formatBytes(single.estimatedBytes)}
                </span>
                <span className="text-zinc-500">
                  {" "}
                  from {formatBytes(info.sizeBytes)}
                  {single.isTrimmed
                    ? ` · trimmed to ${formatDuration(single.effectiveDuration)}`
                    : ""}
                </span>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
        <button
          onClick={single.compress}
          disabled={!info || single.probing}
          className="rounded-xl bg-accent px-6 py-2.5 font-medium text-white transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          Compress
        </button>
      </div>
      {single.targetHint ? (
        <p className="text-center text-xs text-amber-400/80">{single.targetHint}</p>
      ) : (
        <p className="text-center text-xs text-zinc-600">
          Estimate is approximate — the exact size is shown as it encodes.
        </p>
      )}
    </>
  );
}

function UnderTargetNotice({
  single,
  target,
}: {
  single: SingleCompression;
  target: number;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
      <div className="flex-1">
        <p className="text-sm font-medium text-white">
          Already under your {target} MB target
        </p>
        <p className="mt-0.5 text-xs text-zinc-400">
          This {single.isTrimmed ? "clip" : "video"} is ~
          {formatBytes(single.effectiveSourceBytes)} — nothing to compress. Need
          it smaller? Pick a quality preset above.
        </p>
        <button
          onClick={single.compress}
          className="mt-2 text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          Compress anyway
        </button>
      </div>
    </div>
  );
}

function ErrorPanel({
  message,
  onReset,
}: {
  message: string;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <div>
          <p className="font-medium text-white">Something went wrong</p>
          <pre className="selectable mt-2 whitespace-pre-wrap wrap-break-word text-xs text-red-300/80">
            {message}
          </pre>
        </div>
      </div>
      <button
        onClick={onReset}
        className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white hover:bg-accent-bright"
      >
        Start over
      </button>
    </div>
  );
}
