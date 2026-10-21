// Read ZIP directory bytes directly. macOS unzip's locale-dependent filename
// display can corrupt UTF-8 Chinese names; it must not decide archive safety.
const fs = require('node:fs/promises');
async function inspectInstallerZip(file, filename) {
  const handle = await fs.open(file, 'r');
  const invalid = () => Error('安装包内容异常，更新已停止');
  try {
    const { size } = await handle.stat();
    if (size < 22) throw invalid();
    const length = Math.min(size, 65557), tail = Buffer.alloc(length);
    await handle.read(tail, 0, length, size - length);
    let end = -1;
    for (let i = length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50 && i + 22 + tail.readUInt16LE(i + 20) === length) { end = i; break; }
    }
    if (end < 0 || tail.readUInt16LE(end + 4) !== 0 || tail.readUInt16LE(end + 6) !== 0 || tail.readUInt16LE(end + 8) !== 1 || tail.readUInt16LE(end + 10) !== 1) throw invalid();
    const directorySize = tail.readUInt32LE(end + 12), offset = tail.readUInt32LE(end + 16);
    if (directorySize < 46 || directorySize > 65536 || offset + directorySize !== size - length + end) throw invalid();
    const directory = Buffer.alloc(directorySize);
    if ((await handle.read(directory, 0, directorySize, offset)).bytesRead !== directorySize || directory.readUInt32LE(0) !== 0x02014b50) throw invalid();
    const nameLength = directory.readUInt16LE(28), extraLength = directory.readUInt16LE(30), commentLength = directory.readUInt16LE(32);
    const name = directory.subarray(46, 46 + nameLength);
    if (46 + nameLength + extraLength + commentLength !== directorySize || !name.equals(Buffer.from(filename, 'utf8'))) throw invalid();
    if (directory.readUInt16LE(8) & 1 || ![0, 8].includes(directory.readUInt16LE(10)) || directory.readUInt16LE(34) !== 0 || directory.readUInt32LE(24) > 1024 * 1024 * 1024) throw invalid();
    const localOffset = directory.readUInt32LE(42), local = Buffer.alloc(30);
    if (localOffset + 30 > offset || (await handle.read(local, 0, 30, localOffset)).bytesRead !== 30 || local.readUInt32LE(0) !== 0x04034b50) throw invalid();
    const localNameLength = local.readUInt16LE(26), localExtraLength = local.readUInt16LE(28);
    if (localNameLength !== nameLength || local.readUInt16LE(6) & 1 || local.readUInt16LE(8) !== directory.readUInt16LE(10)) throw invalid();
    const localName = Buffer.alloc(localNameLength);
    await handle.read(localName, 0, localNameLength, localOffset + 30);
    if (!localName.equals(name) || localOffset + 30 + localNameLength + localExtraLength + directory.readUInt32LE(20) > offset) throw invalid();
  } finally { await handle.close(); }
}
module.exports = { inspectInstallerZip };
