/* dsh-remote-connector client bundle. React and services come from the harness loader. */
window.__ModuleLoader__.load({
  id: 'dsh-remote-connector',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef } = React;
    const PANEL = 'remote-connector';

    const CSS = `
      .drc-page{height:100%;overflow:auto;box-sizing:border-box;padding:calc(var(--dsh-frame-top-clearance,24px) + 24px) 36px 48px;color:inherit;font-family:inherit}
      .drc-inner{max-width:900px;margin:0 auto}.drc-page *{box-sizing:border-box}
      .drc-header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:26px}
      .drc-page h1{font-size:24px;letter-spacing:-.5px;margin:0 0 6px;font-weight:650}
      .drc-muted{opacity:.62;font-size:13px;line-height:1.6;margin:0}
      .drc-card{border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:14px;padding:20px;margin-bottom:16px;background:color-mix(in srgb,currentColor 2%,transparent)}
      .drc-row{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
      .drc-host{display:flex;align-items:center;gap:9px;font-weight:600;font-size:14px;min-width:0}
      .drc-sub{font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px;opacity:.7;margin:6px 0 0;overflow-wrap:anywhere}
      .drc-badge{font-size:11px;white-space:nowrap;border-radius:20px;padding:4px 10px;background:color-mix(in srgb,currentColor 7%,transparent)}
      .drc-badge.connected{color:#238155;background:#23815515}
      .drc-badge.error{color:#ce5656;background:#ce565615}
      .drc-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .drc-page button{font:inherit;cursor:pointer;border-radius:8px;min-height:34px;padding:7px 12px;border:1px solid color-mix(in srgb,currentColor 15%,transparent);color:inherit;background:transparent;white-space:nowrap;font-size:13px}
      .drc-page button:hover:not(:disabled){background:color-mix(in srgb,currentColor 6%,transparent)}
      .drc-page button:disabled{opacity:.45;cursor:default}
      .drc-page .drc-primary{color:#fff;background:#3869df;border-color:#3869df}
      .drc-page .drc-primary:hover:not(:disabled){background:#2e5bc9}
      .drc-page .drc-danger{color:#c34c4c;border-color:#c34c4c55}
      .drc-page .drc-link{color:#5684ec;border-color:#5684ec55}
      .drc-field{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:550;min-width:0}
      .drc-page input{width:100%;height:38px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:8px;background:Canvas;color:CanvasText;padding:0 11px;font:inherit;outline:none;min-width:0}
      .drc-page input:focus{border-color:#5684ec;box-shadow:0 0 0 3px #5684ec22}
      .drc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .drc-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
      .drc-footer{display:flex;justify-content:flex-end;align-items:center;gap:14px;margin-top:16px}
      .drc-error{color:#c34c4c;background:#c34c4c0d;border:1px solid #c34c4c33;border-radius:9px;padding:11px 13px;margin:0 0 14px;font-size:13px;overflow-wrap:anywhere}
      .drc-notice{font-size:13px;padding:11px 13px;background:#2381550d;border:1px solid #23815533;border-radius:9px;margin-bottom:14px}
      .drc-url{display:flex;align-items:center;gap:8px;font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px;margin-top:10px;overflow-wrap:anywhere}
      .drc-empty{text-align:center;padding:36px 20px;border:1px dashed color-mix(in srgb,currentColor 18%,transparent);border-radius:12px}
      @media(max-width:650px){.drc-page{padding-left:18px;padding-right:18px}.drc-grid,.drc-grid3{grid-template-columns:1fr}}
    `;

    function ServerIcon({ size = 18 } = {}) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('rect', { x: 3, y: 3, width: 18, height: 7, rx: 2 }),
      h('rect', { x: 3, y: 14, width: 18, height: 7, rx: 2 }),
      h('path', { d: 'M7 6.5h.01M7 17.5h.01' }));
    }

    function friendly(error) {
      const message = error?.message || String(error);
      return message;
    }

    const STATUS_LABEL = { connected: '已连接', idle: '空闲', error: '错误', running: '运行中' };

    function ServerForm({ onDone, onCancel, busy }) {
      const [form, setForm] = useState({ name: '', host: '', user: '', port: '', identityFile: '', remotePort: '', localPort: '' });
      const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
      const field = (label, key, opts = {}) => h('label', { className: 'drc-field' }, label,
        h('input', { value: form[key], placeholder: opts.placeholder ?? '', onChange: set(key),
          ...(opts.type ? { type: opts.type } : {}) }));
      return h('form', { className: 'drc-card', onSubmit: (e) => {
        e.preventDefault();
        const payload = { name: form.name, host: form.host, user: form.user,
          port: form.port ? Number(form.port) : undefined,
          identityFile: form.identityFile,
          remotePort: form.remotePort ? Number(form.remotePort) : undefined,
          localPort: form.localPort ? Number(form.localPort) : undefined };
        onDone(payload);
      } },
      h('h2', { style: { fontSize: 15, fontWeight: 650, margin: '0 0 14px' } }, '添加服务器'),
      h('div', { className: 'drc-grid' },
        field('名称', 'name', { placeholder: '可选，默认用地址' }),
        field('地址（host 或 user@host）*', 'host', { placeholder: '如 server.example.com 或 root@example.com' })),
      h('div', { className: 'drc-grid3', style: { marginTop: 12 } },
        field('用户名', 'user', { placeholder: '可选' }),
        field('SSH 端口', 'port', { placeholder: '22', type: 'number' }),
        field('密钥路径', 'identityFile', { placeholder: '可选，如 ~/.ssh/id_ed25519' })),
      h('div', { className: 'drc-grid', style: { marginTop: 12 } },
        field('远端端口', 'remotePort', { placeholder: '8787', type: 'number' }),
        field('本地端口', 'localPort', { placeholder: '8787', type: 'number' })),
      h('div', { className: 'drc-footer' },
        h('button', { type: 'button', disabled: busy, onClick: onCancel }, '取消'),
        h('button', { type: 'submit', className: 'drc-primary', disabled: busy || !form.host.trim() }, '保存')));
    }

    function RemotePanel({ api }) {
      const [servers, setServers] = useState([]);
      const [loading, setLoading] = useState(true);
      const [busy, setBusy] = useState('');
      const [error, setError] = useState('');
      const [notice, setNotice] = useState('');
      const [showAdd, setShowAdd] = useState(false);
      const lifetime = useRef(null);

      const refresh = async (signal) => {
        const next = await api('list', undefined, signal);
        setServers(next.servers);
      };

      useEffect(() => {
        const ctl = new AbortController();
        lifetime.current = ctl;
        refresh(ctl.signal).catch((e) => setError(friendly(e))).finally(() => setLoading(false));
        return () => ctl.abort();
      }, []);

      const run = async (key, fn, after) => {
        setBusy(key); setError(''); setNotice('');
        try {
          const r = await fn(lifetime.current.signal);
          if (r && r.message) setNotice(r.message);
          await refresh(lifetime.current.signal);
          if (after) after(r);
        } catch (e) {
          setError(friendly(e));
          try { await refresh(lifetime.current.signal); } catch { /* ignore */ }
        } finally {
          setBusy('');
        }
      };

      const call = (method, id) => run(`${method}:${id}`, (signal) => api(method, { id }, signal));

      return h('section', { className: 'drc-page', 'aria-label': '远程服务器' },
        h('style', null, CSS),
        h('div', { className: 'drc-inner' },
          h('header', { className: 'drc-header' }, h('div', null,
            h('h1', null, '远程服务器'),
            h('p', { className: 'drc-muted' }, '在远程服务器上部署、启动并连接 DeepSeek Harness。')),
            h('button', { className: 'drc-primary', disabled: !!busy, onClick: () => setShowAdd((v) => !v) },
              showAdd ? '收起' : '添加服务器')),
          error && h('div', { className: 'drc-error', role: 'alert' }, error),
          notice && h('div', { className: 'drc-notice', role: 'status' }, notice),
          showAdd && h(ServerForm, {
            busy: !!busy,
            onCancel: () => setShowAdd(false),
            onDone: (payload) => run('add', () => api('add', payload, lifetime.current.signal), () => setShowAdd(false)),
          }),
          loading ? h('div', { className: 'drc-empty', role: 'status' }, '正在读取服务器…') :
          !servers.length ? h('div', { className: 'drc-empty' },
            h('p', { className: 'drc-muted' }, '还没有服务器。点击「添加服务器」开始。')) :
          servers.map((server) => h('article', { className: 'drc-card', key: server.id },
            h('div', { className: 'drc-row' },
              h('div', { className: 'drc-host' }, h(ServerIcon), server.name || server.host),
              h('span', { className: `drc-badge ${server.status === 'connected' ? 'connected' : ''} ${server.status === 'error' ? 'error' : ''}` },
                STATUS_LABEL[server.status] ?? server.status)),
            h('p', { className: 'drc-sub' }, `${server.user ? server.user + '@' : ''}${server.host}${server.port !== 22 ? ':' + server.port : ''}  →  127.0.0.1:${server.localPort}`),
            server.url && h('div', { className: 'drc-url' },
              h('button', { className: 'drc-link', onClick: () => window.open(server.url, '_blank') }, '打开'),
              h('span', null, server.url)),
            server.message && h('p', { className: 'drc-muted', style: { marginTop: 8 } }, server.message),
            h('div', { className: 'drc-actions', style: { marginTop: 12 } },
              h('button', { disabled: !!busy, onClick: () => call('test', server.id) }, busy === `test:${server.id}` ? '测试中…' : '测试'),
              h('button', { disabled: !!busy, onClick: () => call('deploy', server.id) }, busy === `deploy:${server.id}` ? '部署中…' : '部署'),
              h('button', { disabled: !!busy, onClick: () => call('start', server.id) }, busy === `start:${server.id}` ? '启动中…' : '启动'),
              h('button', { className: 'drc-primary', disabled: !!busy, onClick: () => call('connect', server.id) }, busy === `connect:${server.id}` ? '连接中…' : '一键连接'),
              h('button', { disabled: !!busy, onClick: () => call('stop', server.id) }, busy === `stop:${server.id}` ? '停止中…' : '停止'),
              h('button', { disabled: !!busy, onClick: () => call('disconnect', server.id) }, busy === `disconnect:${server.id}` ? '断开中…' : '断开'),
              h('button', { className: 'drc-danger', disabled: !!busy, onClick: () => run(`remove:${server.id}`, () => api('remove', { id: server.id }, lifetime.current.signal)) }, '删除'))))));
    }

    return {
      inject: ['slots', 'layout', 'connection'],
      apply(ctx) {
        const api = async (method, request, signal) => {
          const result = await ctx.connection.rpc.call('/api', `remoteConnectorUi/${method}`,
            { args: request === undefined ? {} : { request } }, signal);
          if (!result.ok) throw new Error(result.error?.message ?? '请求失败');
          return result.value;
        };
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL,
          inject: () => ({ api }) }, RemotePanel));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist',
          id: PANEL, order: -10, label: '远程服务器' }, ServerIcon));
      },
    };
  },
});
