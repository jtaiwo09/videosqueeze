import type { CompressionEngine } from "./types";
import { NativeFFmpegEngine } from "./nativeEngine";
import { WasmFFmpegEngine } from "./wasmEngine";

export * from "./types";
export * from "./presets";

/**
 * Pick the right engine for where we're running:
 *  - Inside the Tauri desktop app → native FFmpeg (fast, this build)
 *  - Plain browser / hosted        → wasm FFmpeg (future online build)
 */
export function createEngine(): CompressionEngine {
  const isTauri =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  return isTauri ? new NativeFFmpegEngine() : new WasmFFmpegEngine();
}
