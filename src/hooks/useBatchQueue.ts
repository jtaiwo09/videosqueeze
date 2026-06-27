import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { dirname } from "@tauri-apps/api/path";
import type {
  CompressionEngine,
  VideoInfo,
  Progress,
} from "../engine/types";
import {
  estimateBytes,
  deriveSettings,
  sourceKbpsOf,
  isUnderTargetSize,
} from "../engine/presets";
import { deriveOutputName, fileName } from "../lib/format";
import { compressToTemp, resolveUniqueDestination } from "../lib/compression";
import type { QualitySettings } from "./useQualitySettings";

export type QueueStatus =
  | "queued"
  | "probing"
  | "compressing"
  | "done"
  | "error"
  | "canceled";

export interface QueueItem {
  id: string;
  path: string;
  info: VideoInfo | null;
  status: QueueStatus;
  progress: Progress | null;
  outputBytes: number | null;
  savedPath: string | null;
  error: string;
  /** Already under the target size → copied/kept as-is instead of re-encoded. */
  passedThrough?: boolean;
}

const DEFAULT_MAX_HEIGHT = 4320; // fall back to 8K so no resolution is wrongly disabled

/**
 * Owns the batch flow: a probed queue of files compressed sequentially with one
 * shared quality, auto-saved next to each original (or into a chosen folder).
 */
export function useBatchQueue(
  engine: CompressionEngine,
  quality: QualitySettings,
) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const canceled = useRef(false);

  const { presetId, custom, target } = quality;

  const updateItem = useCallback(
    (id: string, patch: Partial<QueueItem>) =>
      setItems((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it))),
    [],
  );

  const reset = useCallback(() => {
    canceled.current = false;
    setItems([]);
    setRunning(false);
    setOutputFolder(null);
  }, []);

  const setup = useCallback(
    (paths: string[]) => {
      canceled.current = false;
      setRunning(false);
      setOutputFolder(null);

      const initial: QueueItem[] = paths.map((path, idx) => ({
        id: `${idx}-${path}`,
        path,
        info: null,
        status: "probing",
        progress: null,
        outputBytes: null,
        savedPath: null,
        error: "",
      }));
      setItems(initial);

      initial.forEach(async (it) => {
        try {
          const probed = await engine.probe(it.path);
          setItems((q) =>
            q.map((x) =>
              x.id === it.id ? { ...x, info: probed, status: "queued" } : x,
            ),
          );
        } catch (e) {
          setItems((q) =>
            q.map((x) =>
              x.id === it.id ? { ...x, status: "error", error: String(e) } : x,
            ),
          );
        }
      });
    },
    [engine],
  );

  const compressAll = async () => {
    canceled.current = false;
    setRunning(true);

    // Track destinations chosen this run so two items never overwrite each other.
    const takenDestinations = new Set<string>();
    const fileExists = (path: string) =>
      invoke<boolean>("file_exists", { path });

    // Snapshot every probed item that isn't already done.
    const todo = items.filter((it) => it.info && it.status !== "done");
    for (const item of todo) {
      if (canceled.current) break;
      const info = item.info!;

      // Already under target → copy/keep as-is rather than re-encode (which would
      // only cost quality for no size gain).
      if (isUnderTargetSize(presetId, target, info.sizeBytes)) {
        try {
          let dest = item.path; // saving next to original: it's already there
          if (outputFolder) {
            dest = await resolveUniqueDestination(
              outputFolder,
              fileName(item.path),
              takenDestinations,
              fileExists,
            );
            await invoke("copy_file", { src: item.path, dest });
          }
          updateItem(item.id, {
            status: "done",
            outputBytes: info.sizeBytes,
            savedPath: dest,
            passedThrough: true,
            progress: null,
          });
        } catch (e) {
          updateItem(item.id, { status: "error", error: String(e), progress: null });
        }
        continue;
      }

      updateItem(item.id, { status: "compressing", progress: null, error: "" });
      const settings = deriveSettings(
        presetId,
        custom,
        target,
        sourceKbpsOf(info),
        info.durationSec,
      );
      const safeId = item.id.replace(/[^a-z0-9]/gi, "_");

      try {
        const res = await compressToTemp(engine, {
          inputPath: item.path,
          info,
          settings,
          durationSec: info.durationSec,
          trim: null,
          label: `batch-${safeId}`,
          onProgress: (p) => updateItem(item.id, { progress: p }),
        });

        const destDir = outputFolder ?? (await dirname(item.path));
        const dest = await resolveUniqueDestination(
          destDir,
          deriveOutputName(item.path),
          takenDestinations,
          fileExists,
        );
        await invoke("copy_file", { src: res.outputPath, dest });
        invoke("delete_file", { path: res.outputPath }).catch(() => {});

        updateItem(item.id, {
          status: "done",
          outputBytes: res.outputBytes,
          savedPath: dest,
          progress: null,
        });
      } catch (e) {
        const msg = String(e);
        if (msg.includes("Canceled")) {
          canceled.current = true;
          updateItem(item.id, { status: "canceled", progress: null });
          break;
        }
        updateItem(item.id, { status: "error", error: msg, progress: null });
      }
    }

    setRunning(false);
  };

  const cancel = () => {
    canceled.current = true;
    engine.cancel();
  };

  const remove = (id: string) =>
    setItems((q) => q.filter((it) => it.id !== id));

  const changeFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") setOutputFolder(selected);
  };

  const clearFolder = () => setOutputFolder(null);

  const reveal = (path: string) => invoke("reveal_in_finder", { path });

  const estimateFor = (item: QueueItem) => {
    if (!item.info) return 0;
    const settings = deriveSettings(
      presetId,
      custom,
      target,
      sourceKbpsOf(item.info),
      item.info.durationSec,
    );
    return estimateBytes(settings, item.info.durationSec);
  };

  const underTargetFor = (item: QueueItem) =>
    !!item.info && isUnderTargetSize(presetId, target, item.info.sizeBytes);

  const isActive = items.length > 0;
  const maxHeight =
    items.reduce((max, it) => Math.max(max, it.info?.height ?? 0), 0) ||
    DEFAULT_MAX_HEIGHT;
  const allDone = isActive && items.every((it) => it.status === "done");

  return {
    items,
    running,
    outputFolder,
    isActive,
    maxHeight,
    allDone,
    estimateFor,
    underTargetFor,
    setup,
    compressAll,
    cancel,
    remove,
    changeFolder,
    clearFolder,
    reset,
    reveal,
  };
}

export type BatchQueueController = ReturnType<typeof useBatchQueue>;
