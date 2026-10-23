/**
 * Persistent server registry stored as JSON under the storage directory.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

export function expandHome(path) {
  if (typeof path !== 'string') return path;
  if (path === '~') return homedir();
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2));
  return path;
}

export class ServerStore {
  constructor(config) {
    this.config = config ?? {};
    this.dir = expandHome(this.config.storageDir ?? '~/.dsh/dsh-remote-connector');
    this.file = join(this.dir, 'servers.json');
    this.servers = this.#load();
  }

  #load() {
    const seed = Array.isArray(this.config?.servers) ? this.config.servers : [];
    if (!existsSync(this.file)) return seed.map(normalizeServer);
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8'));
      if (!Array.isArray(parsed)) return seed.map(normalizeServer);
      return parsed.map(normalizeServer);
    } catch {
      return seed.map(normalizeServer);
    }
  }

  #save() {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.servers, null, 2));
  }

  list() {
    return [...this.servers];
  }

  get(id) {
    return this.servers.find((s) => s.id === id);
  }

  add(input) {
    const server = normalizeServer({ id: randomUUID(), ...input });
    this.servers.push(server);
    this.#save();
    return server;
  }

  remove(id) {
    const before = this.servers.length;
    this.servers = this.servers.filter((s) => s.id !== id);
    this.#save();
    return this.servers.length < before;
  }
}

function normalizeServer(input) {
  const s = input ?? {};
  return {
    id: typeof s.id === 'string' && s.id.length > 0 ? s.id : randomUUID(),
    name: typeof s.name === 'string' && s.name.length > 0 ? s.name : String(s.host ?? ''),
    host: String(s.host ?? '').trim(),
    user: String(s.user ?? '').trim(),
    port: Number.isInteger(Number(s.port)) && Number(s.port) > 0 ? Number(s.port) : 22,
    identityFile: String(s.identityFile ?? '').trim(),
    remotePort: Number.isInteger(Number(s.remotePort)) && Number(s.remotePort) > 0 ? Number(s.remotePort) : undefined,
    localPort: Number.isInteger(Number(s.localPort)) && Number(s.localPort) > 0 ? Number(s.localPort) : undefined,
  };
}
