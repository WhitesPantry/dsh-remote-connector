/**
 * Remote DSH lifecycle: test / deploy / start / stop / status / tunnel.
 *
 * Everything runs over `ssh` (see lib/ssh.js). The remote host only needs
 * POSIX `sh`, `curl` or `wget`, and `tar`; this plugin installs its own
 * user-local Node and DSH so it never touches the system Node.
 */
import { runSsh, startTunnel } from './ssh.js';

const MARK = { RUNNING: '__RUNNING__', STOPPED: '__STOPPED__', STARTED: '__STARTED__', OK: '__OK__' };

export class RemoteManager {
  constructor({ config, store, logger }) {
    this.config = config;
    this.store = store;
    this.logger = logger;
    this.tunnels = new Map(); // server.id -> child process
    this.state = new Map(); // server.id -> { status, url, message }
    this.nodeDir = `node-${config.nodeVersion}-linux-x64`;
    this.tarball = `https://nodejs.org/dist/${config.nodeVersion}/${this.nodeDir}.tar.xz`;
  }

  /** Client-facing view of a server, including tunnel state. */
  view(server) {
    const { remotePort, localPort } = this.ports(server);
    const st = this.state.get(server.id) ?? {};
    const status = this.tunnels.has(server.id) ? 'connected' : (st.status ?? 'idle');
    return {
      id: server.id,
      name: server.name,
      host: server.host,
      user: server.user,
      port: server.port,
      identityFile: server.identityFile,
      remotePort,
      localPort,
      status,
      url: this.tunnels.has(server.id) ? (st.url ?? null) : null,
      message: st.message ?? '',
    };
  }

  log(level, message) {
    this.logger?.[level]?.(`dsh-remote-connector: %s`, message);
  }

  ports(server) {
    return {
      remotePort: server.remotePort ?? this.config.defaultRemotePort ?? 8787,
      localPort: server.localPort ?? this.config.defaultLocalPort ?? 8787,
    };
  }

  async test(server) {
    const r = await runSsh({ server, command: 'echo __OK__; uname -a', sshBinary: this.config.sshBinary });
    if (r.code === 0 && r.stdout.includes(MARK.OK)) {
      const info = r.stdout.split('\n').map((l) => l.trim()).filter(Boolean).slice(1).join(' · ');
      return { ok: true, message: `已连接：${info || 'OK'}` };
    }
    return { ok: false, message: this.#explain(r) };
  }

  async deploy(server, signal) {
    const { remotePort } = this.ports(server);
    const dshPackage = this.config.dshPackage ?? '@deepseek-ai/dsh';
    const script = [
      'set +e',
      'if ~/node/bin/node --version >/dev/null 2>&1; then',
      '  echo "NODE_OK $(~/node/bin/node --version)"',
      'else',
      '  echo "NODE_MISSING installing..."',
      '  mkdir -p ~/.local || { echo NODE_MKDIR_FAIL; exit 1; }',
      `  curl -fsSL -o /tmp/dsh-node.tar.xz ${this.tarball} || { echo NODE_DOWNLOAD_FAIL; exit 1; }`,
      `  tar -xJf /tmp/dsh-node.tar.xz -C ~/.local || { echo NODE_EXTRACT_FAIL; exit 1; }`,
      `  ln -sfn ~/.local/${this.nodeDir} ~/node`,
      '  rm -f /tmp/dsh-node.tar.xz',
      '  echo "NODE_OK $(~/node/bin/node --version)"',
      'fi',
      'if ~/.npm-global/bin/dsh --version >/dev/null 2>&1; then',
      '  echo "DSH_OK $(~/.npm-global/bin/dsh --version)"',
      'else',
      '  echo "DSH_MISSING installing..."',
      `  env PATH=$HOME/node/bin:$PATH ~/node/bin/npm install -g --prefix ~/.npm-global ${dshPackage} || { echo DSH_INSTALL_FAIL; exit 1; }`,
      '  echo "DSH_OK $(~/.npm-global/bin/dsh --version)"',
      'fi',
      'echo DEPLOY_DONE',
    ].join('\n');
    const r = await runSsh({ server, command: script, timeoutMs: 600000, sshBinary: this.config.sshBinary, signal });
    if (r.code !== 0 || !r.stdout.includes('DEPLOY_DONE')) {
      return { ok: false, message: this.#explain(r) };
    }
    const lines = r.stdout.split('\n').filter((l) => l.trim().length > 0);
    return { ok: true, message: lines.map((l) => l.trim()).join('\n') };
  }

  async start(server, signal) {
    const { remotePort } = this.ports(server);
    const pidfile = `$HOME/.dsh-remote-connector-${remotePort}.pid`;
    const logfile = `$HOME/.dsh-remote-connector-${remotePort}.log`;
    const script = [
      `PIDFILE="${pidfile}"`,
      `if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then`,
      `  echo "${MARK.RUNNING}"`,
      'else',
      `  nohup env "PATH=$HOME/node/bin:$PATH" "$HOME/.npm-global/bin/dsh" --profile web --no-open --port ${remotePort} > "${logfile}" 2>&1 &`,
      `  echo $! > "$PIDFILE"`,
      `  echo "${MARK.STARTED}"`,
      'fi',
    ].join('\n');
    const r = await runSsh({ server, command: script, timeoutMs: 60000, sshBinary: this.config.sshBinary, signal });
    if (r.code !== 0) return { ok: false, message: this.#explain(r) };
    const url = await this.#readUrl(server, remotePort);
    if (url) return { ok: true, url, message: '远程 DSH 已启动' };
    return { ok: true, message: '远程 DSH 已启动（尚未读到访问地址，稍后重试）' };
  }

  async stop(server) {
    const { remotePort } = this.ports(server);
    const pidfile = `$HOME/.dsh-remote-connector-${remotePort}.pid`;
    const script = [
      `PIDFILE="${pidfile}"`,
      'if [ -f "$PIDFILE" ]; then',
      '  PID="$(cat "$PIDFILE")"',
      '  kill "$PID" 2>/dev/null || true',
      '  rm -f "$PIDFILE"',
      'fi',
      `  echo "${MARK.STOPPED}"`,
    ].join('\n');
    await this.disconnect(server);
    const r = await runSsh({ server, command: script, timeoutMs: 60000, sshBinary: this.config.sshBinary });
    this.state.set(server.id, { status: 'idle', url: null, message: '已停止' });
    return { ok: r.code === 0, message: r.code === 0 ? '已停止' : this.#explain(r) };
  }

  async status(server) {
    const { remotePort } = this.ports(server);
    const pidfile = `$HOME/.dsh-remote-connector-${remotePort}.pid`;
    const script = `if [ -f "${pidfile}" ] && kill -0 "$(cat "${pidfile}")" 2>/dev/null; then echo ${MARK.RUNNING}; else echo ${MARK.STOPPED}; fi`;
    const r = await runSsh({ server, command: script, timeoutMs: 30000, sshBinary: this.config.sshBinary });
    return r.stdout.includes(MARK.RUNNING) ? 'running' : 'stopped';
  }

  async connect(server, signal) {
    const deploy = await this.deploy(server, signal);
    if (!deploy.ok) return { ok: false, message: deploy.message };
    const started = await this.start(server, signal);
    if (!started.ok) return { ok: false, message: started.message };
    const { remotePort, localPort } = this.ports(server);
    const url = started.url ?? await this.#readUrl(server, remotePort);
    if (!url) return { ok: false, message: '远程 DSH 已启动，但读不到访问 token，请重试或检查远端日志' };
    this.disconnect(server);
    const child = startTunnel({ server, localPort, remotePort, sshBinary: this.config.sshBinary });
    this.tunnels.set(server.id, child);
    const localUrl = url.replace(/^https?:\/\/[^/]+/, `http://127.0.0.1:${localPort}`);
    this.state.set(server.id, { status: 'connected', url: localUrl, message: '隧道已建立' });
    return { ok: true, url: localUrl, message: '隧道已建立' };
  }

  disconnect(server) {
    const child = this.tunnels.get(server.id);
    if (child) {
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
      this.tunnels.delete(server.id);
      this.state.set(server.id, { status: 'idle', url: null, message: '已断开' });
      return true;
    }
    return false;
  }

  /** Read the tokenized web URL printed to the remote DSH log. */
  async #readUrl(server, remotePort) {
    const logfile = `$HOME/.dsh-remote-connector-${remotePort}.log`;
    const script = `sleep 2; cat "${logfile}" 2>/dev/null`;
    const r = await runSsh({ server, command: script, timeoutMs: 30000, sshBinary: this.config.sshBinary });
    const match = r.stdout.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : undefined;
  }

  #explain(r) {
    const detail = String(r.stderr ?? '').trim();
    if (/Permission denied|publickey/i.test(detail)) return 'SSH 认证失败：请确认密钥已加载，或服务器已配置好免密登录';
    if (/timed out|timeout/i.test(detail)) return '连接超时：请检查网络与服务器是否在线';
    if (/Could not resolve hostname|Name or service not known/i.test(detail)) return '无法解析主机名';
    if (/Connection refused/i.test(detail)) return '连接被拒绝：请检查 SSH 端口';
    if (/Host key verification failed/i.test(detail)) return '主机密钥校验失败';
    if (detail.length > 0) return detail;
    return `ssh 退出码 ${r.code}`;
  }
}
