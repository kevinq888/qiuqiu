// 零依赖生成 PWA 图标：手写 PNG 编码（zlib 为 Node 内置），绘制黑胶唱片图案。
// 用法：node scripts/gen-icons.js
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');

function crc32(buf) {
  if (!crc32.table) {
    crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32.table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crc32.table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 黑胶唱片：奶油底色 + 深青唱片 + 橙色唱片芯 + 中心孔，四周留安全边距（兼容 maskable 裁切）。
function drawVinyl(size) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const R = size * 0.375;
  const labelR = R * 0.4;
  const holeR = R * 0.1;
  const bg = [241, 248, 245];
  const rim = [10, 33, 36];
  const base = [18, 60, 65];
  const light = [31, 78, 82];
  const orange = [244, 141, 115];
  const hole = [255, 248, 240];
  const bands = 16;
  const mix = (a, b, t) => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy);
      let col;
      if (r >= R) col = bg;
      else if (r > R - size * 0.012) col = rim;
      else if (r < holeR) col = hole;
      else if (r < labelR) col = orange;
      else {
        const band = Math.floor((r - labelR) / ((R - labelR) / bands));
        col = band % 2 ? light : base;
        const sheen = (dx - dy) / (2 * R); // 右上方向柔和高光
        if (sheen > 0.3) col = mix(col, [255, 255, 255], Math.min(0.25, (sheen - 0.3) * 0.6));
      }
      const edge = Math.min(1, Math.max(0, R - r)); // 外缘抗锯齿
      col = edge < 1 ? mix(bg, col, edge) : col;
      const i = (y * size + x) * 4;
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255;
    }
  }
  return px;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
  fs.writeFileSync(path.join(OUT_DIR, name), encodePng(size, drawVinyl(size)));
  console.log(`生成 ${name} (${size}x${size})`);
}
