const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const desktop = path.resolve(__dirname, '..');
const pkg = require(path.join(desktop, 'package.json'));
const [platform, ...args] = process.argv.slice(2);
const targets = {
  mac: [['--mac', 'dmg', ...args]],
  win: [['--win', 'nsis', '--x64', ...args]],
  all: [['--mac', 'dmg', '--x64', '--arm64'], ['--win', 'nsis', '--x64']],
};

function build() {
  if (!Object.hasOwn(targets, platform)) throw Error('Specify mac, win, or all.');
  if (platform === 'all' && args.length) throw Error('build:all already selects both Mac architectures and Windows x64.');
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(pkg.version)) throw Error('Invalid release version.');
  const release = path.join(desktop, 'dist', pkg.version);
  const prefix = `${pkg.build.productName}-${pkg.version}`;
  const allowed = new Set([`${prefix}-macos-arm64.dmg`, `${prefix}-macos-x64.dmg`, `${prefix}-windows-x64.exe`]);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qiuqiu-build-'));
  const cli = path.join(path.dirname(require.resolve('electron-builder/package.json')), 'cli.js');
  let complete = false;
  try {
    for (const target of targets[platform]) {
      const result = spawnSync(process.execPath, [cli, ...target, `--config.directories.output=${scratch}`], { cwd: desktop, stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) throw Error(`electron-builder failed (${result.signal || result.status}).`);
    }
    const installers = fs.readdirSync(scratch).filter(name => allowed.has(name));
    const expected = platform === 'all' ? 3 : 1;
    if (installers.length < expected) throw Error('Expected installers are missing from the build output.');
    fs.mkdirSync(release, { recursive: true });
    for (const name of installers) {
      fs.copyFileSync(path.join(scratch, name), path.join(release, name), fs.constants.COPYFILE_FICLONE);
      console.log(`Installer: ${path.join(release, name)}`);
    }
    complete = true;
  } finally {
    if (complete) fs.rmSync(scratch, { recursive: true, force: true });
    else console.error(`Build diagnostics retained at: ${scratch}`);
  }
}

try { build(); } catch (error) { console.error(error.message); process.exitCode = 1; }
