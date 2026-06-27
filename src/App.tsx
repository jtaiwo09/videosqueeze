import { useCallback, useMemo } from "react";

import { createEngine } from "./engine";
import { isVideoPath } from "./lib/videoFiles";
import { useQualitySettings } from "./hooks/useQualitySettings";
import { useSingleCompression } from "./hooks/useSingleCompression";
import { useBatchQueue } from "./hooks/useBatchQueue";
import { useVideoInput } from "./hooks/useVideoInput";
import { AppHeader } from "./components/AppHeader";
import { SingleFileView } from "./components/SingleFileView";
import { BatchView } from "./components/BatchView";

export default function App() {
  const engine = useMemo(() => createEngine(), []);
  const quality = useQualitySettings();
  const single = useSingleCompression(engine, quality);
  const batch = useBatchQueue(engine, quality);

  const { load: loadSingle, reset: resetSingle } = single;
  const { setup: setupBatch, reset: resetBatch } = batch;

  // One file → the rich single-file flow; two or more → the batch queue.
  const handleFiles = useCallback(
    (paths: string[]) => {
      const videos = Array.from(new Set(paths.filter(isVideoPath)));
      if (videos.length === 0) return;
      if (videos.length === 1) {
        resetBatch();
        loadSingle(videos[0]);
      } else {
        resetSingle();
        setupBatch(videos);
      }
    },
    [loadSingle, resetSingle, setupBatch, resetBatch],
  );

  const { dragging, pickFiles } = useVideoInput(handleFiles, batch.running);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <AppHeader />
      <main className="flex-1 px-7 pb-7 pt-3">
        {batch.isActive ? (
          <BatchView batch={batch} quality={quality} />
        ) : (
          <SingleFileView
            single={single}
            quality={quality}
            dragging={dragging}
            onPick={pickFiles}
          />
        )}
      </main>
    </div>
  );
}
