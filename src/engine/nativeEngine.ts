import { invoke, Channel } from "@tauri-apps/api/core";
import type {
  CompressionEngine,
  VideoInfo,
  CompressJob,
  Progress,
  CompressResult,
} from "./types";

/**
 * Local engine: drives the bundled native FFmpeg via the Rust backend.
 * Fast, hardware-accelerated, no file-size ceiling — the right choice for the
 * desktop app. Progress streams back over a Tauri Channel.
 */
export class NativeFFmpegEngine implements CompressionEngine {
  readonly id = "native-ffmpeg";

  async probe(inputPath: string): Promise<VideoInfo> {
    return await invoke<VideoInfo>("probe_video", { path: inputPath });
  }

  async compress(
    job: CompressJob,
    onProgress: (p: Progress) => void
  ): Promise<CompressResult> {
    const channel = new Channel<Progress>();
    channel.onmessage = (p) => onProgress(p);
    return await invoke<CompressResult>("compress_video", {
      job,
      onProgress: channel,
    });
  }

  async cancel(): Promise<void> {
    await invoke("cancel_compression");
  }
}
