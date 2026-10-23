/**
 * dsh-remote-connector — deploy and manage DeepSeek Harness on a remote server
 * over SSH, with one-click tunnel and open.
 *
 * Host half: holds the server registry and the remote lifecycle manager, and
 * registers the `remoteConnectorUi` Typert service so the Web UI can drive it.
 */
import { loadHostModules } from './lib/host-modules.js';
import { ServerStore } from './lib/store.js';
import { RemoteManager } from './lib/remote.js';
import { registerUi } from './ui/host.js';

export const name = 'remote-connector';

// Load the harness's typert protocol once, before the plugin is instantiated.
const host = await loadHostModules();

function defaults() {
  return {
    sshBinary: 'ssh',
    connectTimeoutSec: 15,
    storageDir: '~/.dsh/dsh-remote-connector',
    nodeVersion: 'v22.21.0',
    dshPackage: '@deepseek-ai/dsh',
    defaultRemotePort: 8787,
    defaultLocalPort: 8787,
    servers: [],
  };
}

export function apply(ctx, rawConfig) {
  const config = { ...defaults(), ...(rawConfig ?? {}) };
  const store = new ServerStore(config);
  const manager = new RemoteManager({ config, store, logger: ctx.logger });
  const runtime = { ctx, config, store, manager };

  ctx.inject(['typert'], (scope) => registerUi(scope, runtime, host));

  // Tear down any tunnels we still own when the plugin unloads.
  ctx.effect(() => () => {
    for (const server of store.list()) manager.disconnect(server);
  });
}
