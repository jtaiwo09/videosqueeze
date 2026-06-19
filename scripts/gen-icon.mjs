// Generates a 1024x1024 PNG app icon with zero dependencies.
// Indigo gradient + two triangles pointing inward ("squeeze").
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const N = 1024;
const cx = N / 2;

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}
// gradient stops (top -> bottom)
const top = [129, 140, 248]; // #818cf8
const bot = [79, 70, 229]; // #4f46e5

function inTriangle(px, py, ax, ay, bx, by, cxx, cyy) {
  const d = (by - cyy) * (ax - cxx) + (cxx - bx) * (ay - cyy);
  const a = ((by - cyy) * (px - cxx) + (cxx - bx) * (py - cyy)) / d;
  const b = ((cyy - ay) * (px - cxx) + (ax - cxx) * (py - cyy)) / d;
  const c = 1 - a - b;
  return a >= 0 && b >= 0 && c >= 0;
}

// raw RGBA scanlines, each row prefixed by filter byte 0
const raw = Buffer.alloc((N * 4 + 1) * N);
let o = 0;
for (let y = 0; y < N; y++) {
  raw[o++] = 0; // filter: none
  const t = y / (N - 1);
  const r = lerp(top[0], bot[0], t);
  const g = lerp(top[1], bot[1], t);
  const b = lerp(top[2], bot[2], t);
  for (let x = 0; x < N; x++) {
    let R = r, G = g, B = b;
    // top triangle: base at y=300 (width 200 half), apex at (cx, 472) pointing down
    const inTop = inTriangle(x, y, cx - 210, 300, cx + 210, 300, cx, 478);
    // bottom triangle: base at y=724, apex at (cx, 546) pointing up
    const inBot = inTriangle(x, y, cx - 210, 724, cx + 210, 724, cx, 546);
    if (inTop || inBot) {
      R = 255; G = 255; B = 255;
    }
    raw[o++] = R;
    raw[o++] = G;
    raw[o++] = B;
    raw[o++] = 255;
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// CRC32
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0);
ihdr.writeUInt32BE(N, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
const idat = zlib.deflateSync(raw, { level: 9 });
const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync("scripts", { recursive: true });
writeFileSync("app-icon.png", png);
console.log("wrote app-icon.png", png.length, "bytes");
