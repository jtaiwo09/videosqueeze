import { tempDir, join } from "@tauri-apps/api/path";
import type {
  CompressionEngine,
  CompressionSettings,
  VideoInfo,
  Progress,
  CompressResult,
} from "../engine/types";

/** A half-open clip selection, in seconds. */
export interface TrimRange {
  start: number;
  end: number;
}

/**
 * Resolve a non-colliding output path in `dir` for `fileName`, appending `-1`,
 * `-2`, … before the extension until the name is free of both already-chosen
 * paths this run (`taken`) and files already on disk (`exists`). Prevents one
 * batch item from silently overwriting another's output, or a previous run's.
 * Mutates `taken` with the chosen path.
 */
export async function resolveUniqueDestination(
  dir: string,
  fileName: string,
  taken: Set<string>,
  exists: (path: string) => Promise<boolean>,
): Promise<string> {
  const dot = fileName.lastIndexOf(".");
  const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : "";

  for (let suffix = 0; ; suffix++) {
    const candidate = suffix === 0 ? `${stem}${ext}` : `${stem}-${suffix}${ext}`;
    const fullPath = await join(dir, candidate);
    const key = fullPath.toLowerCase(); // macOS paths are case-insensitive
    if (!taken.has(key) && !(await exists(fullPath))) {
      taken.add(key);
      return fullPath;
    }
  }
}

/**
 * Never upscale: if the source is already at or below the requested downscale
 * height, drop the scale so we don't enlarge it.
 */
export function withoutUpscale(
  settings: CompressionSettings,
  info: VideoInfo,
): CompressionSettings {
  if (settings.scaleHeight && info.height <= settings.scaleHeight) {
    return { ...settings, scaleHeight: null };
  }
  return settings;
}

export interface CompressToTempParams {
  inputPath: string;
  info: VideoInfo;
  settings: CompressionSettings;
  /** Encoded duration (trimmed length when trimming) — drives progress %. */
  durationSec: number;
  /** Clip selection, or null/undefined to encode the whole video. */
  trim?: TrimRange | null;
  /** Filename-safe label distinguishing this temp file (e.g. "preview"). */
  label: string;
  onProgress: (progress: Progress) => void;
}

/**
 * Compress to a fresh temp `.mp4` and return the result. Centralizes temp-path
 * creation and the never-upscale clamp so the single-file and batch flows share
 * exactly one compression path.
 */
export async function compressToTemp(
  engine: CompressionEngine,
  params: CompressToTempParams,
): Promise<CompressResult> {
  const { inputPath, info, settings, durationSec, trim, label, onProgress } =
    params;
  const dir = await tempDir();
  const outputPath = await join(dir, `videosqueeze-${label}-${Date.now()}.mp4`);

  return engine.compress(
    {
      inputPath,
      outputPath,
      settings: withoutUpscale(settings, info),
      durationSec,
      trimStart: trim ? trim.start : null,
      trimEnd: trim ? trim.end : null,
    },
    onProgress,
  );
}
