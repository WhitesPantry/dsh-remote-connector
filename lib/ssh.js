/**
 * SSH process helpers: run one remote command, and manage a local tunnel.
 */
import { spawn } from 'node:child_process';

/** Build the ssh destination argument from a server entry. */
export function destinationOf(server) {
  const host = String(server.host ?? '').trim();
  if (host.length === 0) throw new Error('服务器地址不能为空');
  const user = String(server.user ?? '').trim();
  return user.length > 0 ? `${user}@${host}` : host;
}

/** Build the base ssh argv (without a remote command) for a server entry. */
export function baseArgv(server, sshBinary) {
  const argv = ['-o', 'BatchMode=yes', '-o', `ConnectTimeout=${server.connectTimeoutSec ?? 15}`,
    '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3', '-o', 'LogLevel=ERROR'];
  const port = Number(server.port);
  if (Number.isInteger(port) && port > 0 && port !== 22) argv.push('-p', String(port));
  const identityFile = String(server.identityFile ?? '').trim();
  if (identityFile.length > 0) argv.push('-i', identityFile);
  return argv;
}

/**
 * Run one remote command and collect its output.
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
export function runSsh({ server, command, timeoutMs = 120000, sshBinary = 'ssh', signal }) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ code: -1, stdout: '', stderr: 'aborted' });
      return;
    }
    const argv = [...baseArgv(server, sshBinary), '-T', '--', destinationOf(server), command];
    let child;
    try {
      child = spawn(sshBinary, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ code: -1, stdout: '', stderr: String(error?.message ?? error) });
      return;
    }
    const stdout = [];
    const stderr = [];
    let settled = false;
    const finish = (code, out, err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve({ code, stdout: out, stderr: err });
    };
    const onAbort = () => {
      try { child.kill('SIGKILL'); } catch { /* gone */ }
      finish(-1, Buffer.concat(stdout).toString('utf8'), 'aborted');
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* gone */ }
      finish(-1, Buffer.concat(stdout).toString('utf8'),
        Buffer.concat(stderr).toString('utf8') + '\n(timeout)');
    }, timeoutMs);
    child.stdout.on('data', (c) => stdout.push(c));
    child.stderr.on('data', (c) => stderr.push(c));
    child.on('error', (error) => finish(-1, Buffer.concat(stdout).toString('utf8'), String(error?.message ?? error)));
    child.on('close', (code) => finish(code ?? -1, Buffer.concat(stdout).toString('utf8'), Buffer.concat(stderr).toString('utf8')));
  });
}

/**
 * Start a local SSH port-forward tunnel (`ssh -N -L`).
 * @returns the child process.
 */
export function startTunnel({ server, localPort, remotePort, sshBinary = 'ssh' }) {
  const argv = [...baseArgv(server, sshBinary), '-N',
    '-o', 'ExitOnForwardFailure=yes',
    '-L', `127.0.0.1:${localPort}:127.0.0.1:${remotePort}`,
    '--', destinationOf(server)];
  const child = spawn(sshBinary, argv, { stdio: 'ignore' });
  return child;
}
