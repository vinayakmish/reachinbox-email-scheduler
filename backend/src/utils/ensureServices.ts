import net from 'net';
import { execSync, spawn } from 'child_process';
import { logger } from './logger';

function isPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

export async function ensureLocalServices(): Promise<void> {
  if (process.platform === 'win32') {
    // 1. Check PostgreSQL on port 5432
    const pgUp = await isPortOpen(5432);
    if (!pgUp) {
      logger.info('Auto-starting PostgreSQL on port 5432...');
      try {
        execSync('"C:\\pgsql\\bin\\pg_ctl.exe" -D "C:\\pgsql\\data" -l "C:\\pgsql\\data\\logfile.log" start', {
          stdio: 'ignore',
        });
      } catch {
        // Ignored if already booting
      }
    }

    // 2. Check Redis on port 6380
    const redisUp = await isPortOpen(6380);
    if (!redisUp) {
      logger.info('Auto-starting Redis 5 on port 6380...');
      try {
        const subprocess = spawn('C:\\redis5\\redis-server.exe', ['--port', '6380', '--daemonize', 'no', '--loglevel', 'notice'], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        });
        subprocess.unref();
      } catch {
        // Ignored
      }
    }

    if (!pgUp || !redisUp) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
}
