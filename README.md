# VideoSqueeze

A lightweight, **fully local** video compressor for macOS (Apple Silicon), built for
shrinking large screen recordings fast — without ever uploading them anywhere.

- 🎯 **Drag in a video, pick a quality, save it.** That's it.
- ⚡ **Fast** — uses your Mac's hardware video encoder (VideoToolbox) by default.
- 🔒 **100% offline** — FFmpeg is bundled; no file ever leaves your machine.
- 🎛️ **High / Medium / Low / Custom** quality presets.
- 📏 Shows an **estimated size** up front and the **exact size** after.
- 💾 Saves the compressed file **wherever you choose**.

Supports `.mov`, `.mp4`, `.m4v`, `.mkv`, `.avi`, `.webm`, and more.

---

## How it works

VideoSqueeze is a [Tauri](https://tauri.app) desktop app: a small native window
running a React UI, with a Rust backend that drives a **bundled static FFmpeg**
binary. Nothing is sent over the network.

```
React UI  ──▶  CompressionEngine (interface)
                   └─ NativeFFmpegEngine ──▶ Rust ──▶ FFmpeg sidecar (VideoToolbox / libx264 / libx265)
```

### Quality presets

| Preset  | Encoder            | Result                                            |
|---------|--------------------|---------------------------------------------------|
| High    | Hardware H.264     | Near-original quality, big savings on recordings  |
| Medium  | Hardware H.264     | Balanced — good default                           |
| Low     | Hardware H.264     | Smallest, downscaled to 1080p                     |
| Custom  | Your choice        | H.264/H.265 · hardware/software · quality · resolution |

- **Hardware** (VideoToolbox) is the fast path — several times faster than real-time on Apple Silicon.
- **Software** (libx264 / libx265) packs files a little smaller at the cost of speed.

---

## Develop

Prerequisites: **Node 18+**, **Rust** (`rustup`), and the bundled FFmpeg binaries.

```bash
npm install
bash scripts/fetch-ffmpeg.sh   # downloads static arm64 ffmpeg + ffprobe (gitignored)
npm run app:dev                # launches the app with hot reload
```

## Build a distributable `.app`

```bash
npm run app:build
```

The bundled app and DMG land in `src-tauri/target/release/bundle/`.

> **Note on signing:** the build is unsigned. To run it on another Mac without a
> Gatekeeper warning you'd sign + notarize it with an Apple Developer ID. For your
> own machine, right-click → Open the first time is enough.

---

## Project layout

```
src/                      React UI
  components/             DropZone, QualitySelector, ProgressView, ResultSummary
  engine/
    types.ts              CompressionEngine interface (the swap point)
    presets.ts            High/Medium/Low/Custom → settings + size estimate
    nativeEngine.ts       talks to the Rust backend (this build)
    wasmEngine.ts         STUB for the future hosted/web build
  lib/format.ts           byte/time formatting
src-tauri/
  src/main.rs             probe + compress (streams progress) + cancel + reveal
  binaries/               bundled ffmpeg/ffprobe sidecars (gitignored)
scripts/
  fetch-ffmpeg.sh         download the FFmpeg sidecars
  gen-icon.mjs            regenerate the app icon
```

---

## Future: hosting it online

The UI is engine-agnostic. To put VideoSqueeze on the web later (e.g. Vercel)
**while keeping videos 100% on the user's device**, implement `WasmFFmpegEngine`
with [`@ffmpeg/ffmpeg`](https://github.com/ffmpegwasm/ffmpeg.wasm) (WebAssembly,
runs in the browser) and have `createEngine()` select it outside Tauri. The React
UI needs **no changes** — only the engine swaps. Note that the wasm path is slower
and has a ~2GB file ceiling, which is why the desktop app uses native FFmpeg.

---

## Licensing

The bundled FFmpeg static build includes GPL components (`libx264`, `libx265`),
so a distributed build is subject to the GPL. Fine for personal use.
```
