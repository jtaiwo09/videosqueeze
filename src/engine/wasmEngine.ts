import type {
  CompressionEngine,
  VideoInfo,
  CompressJob,
  Progress,
  CompressResult,
} from "./types";

/**
 * Hosted/browser engine — STUB.
 *
 * When VideoSqueeze is deployed online (e.g. Vercel), this will run @ffmpeg/ffmpeg
 * (WebAssembly) entirely in the user's browser, so videos STILL never upload.
 * Same `CompressionEngine` contract → the React UI needs zero changes.
 *
 * To implement later:
 *   1. `npm i @ffmpeg/ffmpeg @ffmpeg/util`
 *   2. Load ffmpeg-core, accept a File/Blob instead of a filesystem path,
 *      map CompressionSettings → ffmpeg args (shared with the native builder),
 *      parse progress via ffmpeg.on("progress", ...), and return a Blob the user
 *      downloads via a save dialog.
 *
 * It throws today so a misconfigured build fails loudly rather than silently.
 */
export class WasmFFmpegEngine implements CompressionEngine {
  readonly id = "wasm-ffmpeg";

  private notImplemented(): never {
    throw new Error(
      "WasmFFmpegEngine is not implemented yet. It is reserved for the hosted/web build."
    );
  }

  async probe(_inputPath: string): Promise<VideoInfo> {
    return this.notImplemented();
  }

  async compress(
    _job: CompressJob,
    _onProgress: (p: Progress) => void
  ): Promise<CompressResult> {
    return this.notImplemented();
  }

  async cancel(): Promise<void> {
    return this.notImplemented();
  }
}
