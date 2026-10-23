/**
 * RPC surface for the Web UI: registers `remoteConnectorUi` as a Typert service
 * so the Client panel can call the host's remote-server lifecycle.
 */
import { z } from 'zod';

export function registerUi(ctx, runtime, host) {
  const { TypertRemoteService } = host.typert;

  const requireServer = (id) => {
    const server = runtime.store.get(id);
    if (!server) throw new Error('服务器不存在');
    return server;
  };

  class ConnectorUi extends TypertRemoteService {
    constructor(scope) {
      super(scope, 'remoteConnectorUi');
    }

    list() {
      return { servers: runtime.store.list().map((server) => runtime.manager.view(server)) };
    }

    add(request) {
      const server = runtime.store.add(request);
      return { server: runtime.manager.view(server) };
    }

    remove(request) {
      const server = runtime.store.get(request.id);
      if (server) runtime.manager.disconnect(server);
      return { removed: runtime.store.remove(request.id) };
    }

    test(request) {
      return runtime.manager.test(requireServer(request.id));
    }

    deploy(request, signal) {
      return runtime.manager.deploy(requireServer(request.id), signal);
    }

    start(request, signal) {
      return runtime.manager.start(requireServer(request.id), signal);
    }

    stop(request) {
      return runtime.manager.stop(requireServer(request.id));
    }

    connect(request, signal) {
      return runtime.manager.connect(requireServer(request.id), signal);
    }

    disconnect(request) {
      return { ok: runtime.manager.disconnect(requireServer(request.id)), message: '已断开' };
    }
  }

  new ConnectorUi(ctx);

  const idRequest = z.object({ id: z.string().min(1).max(128) }).strict();
  const serverView = z.object({
    id: z.string(),
    name: z.string(),
    host: z.string(),
    user: z.string(),
    port: z.number(),
    identityFile: z.string(),
    remotePort: z.number(),
    localPort: z.number(),
    status: z.string(),
    url: z.string().nullable(),
    message: z.string(),
  });
  const addRequest = z.object({
    name: z.string().max(80).optional(),
    host: z.string().min(1).max(512),
    user: z.string().max(128).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    identityFile: z.string().max(1024).optional(),
    remotePort: z.number().int().min(1).max(65535).optional(),
    localPort: z.number().int().min(1).max(65535).optional(),
  }).strict();
  const actionResult = z.object({
    ok: z.boolean(),
    message: z.string(),
    url: z.string().nullable().optional(),
  });

  const definitions = {
    list: { result: z.object({ servers: z.array(serverView) }) },
    add: { request: addRequest, result: z.object({ server: serverView }) },
    remove: { request: idRequest, result: z.object({ removed: z.boolean() }) },
    test: { request: idRequest, result: actionResult },
    deploy: { request: idRequest, cancel: true, result: actionResult },
    start: { request: idRequest, cancel: true, result: actionResult },
    stop: { request: idRequest, result: actionResult },
    connect: { request: idRequest, cancel: true, result: actionResult },
    disconnect: { request: idRequest, result: actionResult },
  };

  const codec = (method, kind, schema) => ({
    mode: 'strict',
    typeSymbol: `dsh-remote-connector-ui#${method}:${kind}`,
    create: () => schema,
  });

  ctx.typert.register({
    package: 'dsh-remote-connector-ui',
    face: 'host',
    schemas: [],
    invocations: Object.entries(definitions).map(([method, def]) => ({
      id: `dsh-remote-connector-ui#remoteConnectorUi/${method}`,
      service: 'remoteConnectorUi',
      namespace: 'remoteConnectorUi',
      method,
      invocation: { kind: 'direct' },
      parameters: def.request
        ? [{ name: 'request', wire: 'request', source: 'json', codec: codec(method, 'request', def.request) }]
        : [],
      ...(def.cancel ? { cancellation: { parameter: 'signal' } } : {}),
      result: codec(method, 'result', def.result),
    })),
    model: { services: [], events: [], objects: [] },
  });
}
