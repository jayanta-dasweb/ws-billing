import { execSync } from 'child_process';

const port = process.argv[2] || '4000';

function killOnWindows() {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`Freed port ${port} (PID ${pid})`);
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* nothing listening */
  }
}

function killOnUnix() {
  try {
    const pid = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim();
    if (pid) {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
      console.log(`Freed port ${port} (PID ${pid})`);
    }
  } catch {
    /* nothing listening */
  }
}

if (process.platform === 'win32') killOnWindows();
else killOnUnix();
