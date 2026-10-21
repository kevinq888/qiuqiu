const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const size = 512;
const source = path.join(__dirname, 'icon.png');
const appIconPath = path.join(__dirname, 'app-icon.png');
const trayIconPath = path.join(__dirname, 'tray-icon.png');

function decodePng(file) {
  const input = fs.readFileSync(file);
  const chunks = [];
  let header;
  for (let offset = 8; offset < input.length;) {
    const length = input.readUInt32BE(offset);
    const type = input.toString('ascii', offset + 4, offset + 8);
    const body = input.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') header = Buffer.from(body);
    if (type === 'IDAT') chunks.push(body);
    offset += length + 12;
    if (type === 'IEND') break;
  }

  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  if (header[8] !== 8 || header[9] !== 6 || header[12] !== 0) {
    throw new Error('Icon source must be a non-interlaced RGBA PNG');
  }
  const stride = width * 4;
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const pixels = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (stride + 1);
    const filter = raw[rowOffset];
    const outputOffset = y * stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= 4 ? pixels[outputOffset + i - 4] : 0;
      const up = y > 0 ? pixels[outputOffset - stride + i] : 0;
      const upperLeft = y > 0 && i >= 4 ? pixels[outputOffset - stride + i - 4] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
          : filter === 2 ? up
            : filter === 3 ? Math.floor((left + up) / 2)
              : paeth(left, up, upperLeft);
      pixels[outputOffset + i] = (raw[rowOffset + i + 1] + predictor) & 255;
    }
  }
  return { width, height, pixels };
}

function encodePng(width, height, pixels, output) {
  const crc32 = bytes => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, body) => {
    const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    checksum.writeUInt32BE(crc32(Buffer.concat([name, body])));
    return Buffer.concat([length, name, body, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = width * 4;
  const rows = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    pixels.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  fs.writeFileSync(output, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

function placeScaled(sourcePixels, sourceWidth, sourceHeight, scale, base) {
  const output = Buffer.alloc(size * size * 4);
  const offsetX = (size - sourceWidth * scale) / 2;
  const offsetY = (size - sourceHeight * scale) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const out = (y * size + x) * 4;
      output[out] = base[0]; output[out + 1] = base[1]; output[out + 2] = base[2]; output[out + 3] = 255;
      const sx = (x + 0.5 - offsetX) / scale - 0.5;
      const sy = (y + 0.5 - offsetY) / scale - 0.5;
      if (sx < 0 || sy < 0 || sx >= sourceWidth - 1 || sy >= sourceHeight - 1) continue;
      const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
      const points = [
        [(y0 * sourceWidth + x0) * 4, (1 - fx) * (1 - fy)],
        [(y0 * sourceWidth + x0 + 1) * 4, fx * (1 - fy)],
        [((y0 + 1) * sourceWidth + x0) * 4, (1 - fx) * fy],
        [((y0 + 1) * sourceWidth + x0 + 1) * 4, fx * fy],
      ];
      const color = [0, 0, 0, 0];
      for (const [index, weight] of points) {
        for (let channel = 0; channel < 4; channel++) color[channel] += sourcePixels[index + channel] * weight;
      }
      const alpha = color[3] / 255;
      for (let channel = 0; channel < 3; channel++) output[out + channel] = Math.round(color[channel] * alpha + base[channel] * (1 - alpha));
    }
  }
  return output;
}

function applyMask(pixels, mode, customRadius, inset = 0) {
  const radius = customRadius ?? (mode === 'circle' ? 248 : 112);
  const samples = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let covered = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          if (mode === 'circle') {
            const dx = px - size / 2, dy = py - size / 2;
            if (dx * dx + dy * dy <= radius * radius) covered++;
          } else {
            const dx = Math.max(inset + radius - px, 0, px - (size - inset - radius));
            const dy = Math.max(inset + radius - py, 0, py - (size - inset - radius));
            if (dx * dx + dy * dy <= radius * radius) covered++;
          }
        }
      }
      const alpha = (y * size + x) * 4 + 3;
      pixels[alpha] = Math.round(pixels[alpha] * covered / (samples * samples));
    }
  }
}

const original = decodePng(source);
const base = original.pixels.subarray(3, 4).length ? original.pixels.subarray(0, 3) : [241, 248, 245];
// Preserve the rounded tile footprint; fill it with the reference-sized record.
const appArtworkScale = 1.0;
const smallerAppArt = placeScaled(original.pixels, original.width, original.height, appArtworkScale, base);
applyMask(smallerAppArt, 'rounded', 88, 48);
encodePng(size, size, smallerAppArt, appIconPath);

// The macOS menu bar needs a small monochrome template, independent of the Dock tile.
const tray = Buffer.alloc(size * size * 4);
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    let coverage = 0;
    for (let sy = 0; sy < 4; sy++) {
      for (let sx = 0; sx < 4; sx++) {
        const px = x + (sx + 0.5) / 4;
        const py = y + (sy + 0.5) / 4;
        const radius = Math.hypot(px - size / 2, py - size / 2);
        const dx = px - 244, dy = py - 315;
        const u = dx * .966 - dy * .259, v = dx * .259 + dy * .966;
        const noteHead = (u / 60) ** 2 + (v / 40) ** 2 <= 1;
        const stem = px >= 272 && px <= 308 && py >= 132 && py <= 315;
        const flag = px >= 300 && px <= 364 && py >= 132 + .4 * (px - 300) && py <= 174 + .4 * (px - 300);
        if ((radius >= 192 && radius <= 216) || noteHead || stem || flag) coverage++;
      }
    }
    tray[(y * size + x) * 4 + 3] = Math.round(255 * coverage / 16);
  }
}
encodePng(size, size, tray, trayIconPath);
console.log('Generated a full-size rounded Dock tile and a monochrome menu-bar template.');
