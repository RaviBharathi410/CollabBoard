import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const venvWin = path.join(rootDir, '.venv', 'Scripts', 'python.exe');
const venvUnix = path.join(rootDir, '.venv', 'bin', 'python');

let pythonCmd = 'python';
if (process.platform === 'win32' && existsSync(venvWin)) {
  pythonCmd = venvWin;
} else if (existsSync(venvUnix)) {
  pythonCmd = venvUnix;
}

const child = spawn(
  pythonCmd,
  ['-m', 'uvicorn', 'main:app', '--reload', '--port', '8000'],
  {
    cwd: path.join(rootDir, 'inference-api'),
    stdio: 'inherit',
    shell: true,
  }
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
