import { QualitySelector } from "./quality/QualitySelector";
import { BatchQueue } from "./BatchQueue";
import type { BatchQueueController } from "../hooks/useBatchQueue";
import type { QualitySettings } from "../hooks/useQualitySettings";

interface Props {
  batch: BatchQueueController;
  quality: QualitySettings;
}

/** Multi-file mode: shared quality picker above the sequential compression queue. */
export function BatchView({ batch, quality }: Props) {
  return (
    <div className="space-y-5">
      {!batch.running && !batch.allDone && (
        <QualitySelector
          presetId={quality.presetId}
          custom={quality.custom}
          target={quality.target}
          sourceHeight={batch.maxHeight}
          onSelectPreset={quality.selectPreset}
          onChangeCustom={quality.changeCustom}
          onChangeTarget={quality.changeTarget}
        />
      )}
      <BatchQueue
        items={batch.items}
        running={batch.running}
        outputFolder={batch.outputFolder}
        estimateFor={batch.estimateFor}
        underTargetFor={batch.underTargetFor}
        onCompressAll={batch.compressAll}
        onCancel={batch.cancel}
        onRemove={batch.remove}
        onChangeFolder={batch.changeFolder}
        onClearFolder={batch.clearFolder}
        onReveal={batch.reveal}
        onReset={batch.reset}
      />
    </div>
  );
}
