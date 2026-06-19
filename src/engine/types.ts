// The contract every compression engine implements.
// Today: NativeFFmpegEngine (Tauri sidecar). Later (hosted): WasmFFmpegEngine.
// The React UI talks ONLY to this interface, so going online means swapping the
// implementation — not rewriting the app.

export type CodecId = "h264" | "h265";
export type EncoderMode = "hardware" | "software";

export interface VideoInfo {
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number;
  videoCodec: string;
  fps: number;
  bitrateKbps: number;
}

export interface CompressionSettings {
  codec: CodecId;
  mode: EncoderMode;
  /**
   * Target VIDEO bitrate in kbps. We use bitrate-targeting (not constant quality)
   * so the output is reliably smaller than the source and the size estimate is
   * accurate (size ≈ (videoBitrateKbps + audioKbps) × duration).
   */
  videoBitrateKbps: number;
  /** Target max height in px (e.g. 1080). null = keep source resolution. */
  scaleHeight: number | null;
  /** Cap frame rate (e.g. 30). null = keep source fps. */
  fps: number | null;
  /** Audio bitrate in kbps. */
  audioKbps: number;
}

export interface CompressJob {
  inputPath: string;
  outputPath: string;
  settings: CompressionSettings;
  /** From probe(), used to compute progress %. */
  durationSec: number;
}

export interface Progress {
  /** 0..1 */
  ratio: number;
  fps: number;
  /** encode speed relative to real-time (e.g. 4.2 = 4.2× faster than playback) */
  speed: number;
  /** current output file size in bytes */
  outBytes: number;
  etaSec: number | null;
}

export interface CompressResult {
  outputPath: string;
  outputBytes: number;
}

export interface CompressionEngine {
  readonly id: string;
  probe(inputPath: string): Promise<VideoInfo>;
  compress(job: CompressJob, onProgress: (p: Progress) => void): Promise<CompressResult>;
  cancel(): Promise<void>;
}
