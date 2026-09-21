/**
 * Frees ports 3001 (AI API) and 1234 (Hocuspocus) on Windows before dev:all.
 */
import { execSync } from 'child_process';

// Only run port clearing on Windows; Linux containers (Render, Railway, Docker) allocate isolated network namespaces
if (process.platform !== 'win32') {
  process.exit(0);
}

const isAll = process.argv.includes('--all');
const PORTS = isAll ? [3001, 1234, 5173, 5174, 5175, 8000] : [3001, 1234];

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port}"`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
        console.log(`Freed port ${port} (PID ${pid})`);
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* nothing listening */
  }
}

for (const port of PORTS) killPort(port);

// Allow brief moment for Windows kernel to release sockets
try {
  execSync('powershell -Command "Start-Sleep -Milliseconds 250"', { stdio: 'ignore' });
} catch {
  /* ignore */
}

