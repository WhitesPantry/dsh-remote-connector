# dsh-remote-connector

在 DeepSeek Harness（DSH）里管理远程服务器：通过 SSH 在远程 Linux 服务器上部署、启动 DeepSeek Harness，并在本机建立端口隧道，一键打开远程 DSH 的 Web 界面。

Manage remote servers inside DeepSeek Harness: deploy and start DSH on a remote Linux server over SSH, set up a local port tunnel, and open the remote DSH web UI in one click.

## 这是什么 / What it does

- **侧边栏「远程服务器」面板**：添加、删除、测试 SSH 服务器。
- **一键部署**：在服务器上安装用户级 Node.js（`~/node`）与 DSH（`~/.npm-global`），不动系统 Node。
- **启动 / 停止**：在服务器上常驻启动 `dsh --profile web`，并可停止。
- **一键连接**：部署 + 启动 + 建立本机 `ssh -L` 隧道 + 返回带 token 的访问地址。
- 服务器列表保存在 `~/.dsh/dsh-remote-connector/servers.json`。

## 前置条件 / Requirements

- 本机（跑 DSH 的那台）需要可用的 `ssh` 客户端（Windows 10+/macOS/Linux 都自带 OpenSSH）。
- 目标服务器需为 **Linux（POSIX）**，且已配置好免密 SSH（密钥/agent）；服务器上有 `curl`（或 `wget`）与 `tar`。
- 密码认证当前版本暂未内置，请先用密钥登录。

## 安装 / Install

### 从 GitHub 安装（推荐）

先启动一次 DSH，使 profile 目录存在。然后在侧栏「插件 → 添加插件」填入：

```text
github:WhitesPantry/dsh-remote-connector#main&path:/
```

或使用命令行（CLI Web 版）：

```powershell
dsh plugin --profile web add 'github:WhitesPantry/dsh-remote-connector#main&path:/'
```

安装后按提示启用插件，并**重启一次 DSH**。重启后侧栏出现「远程服务器」。

### 本地目录安装（开发）

```powershell
dsh plugin --profile web add 'C:/path/to/dsh-remote-connector'
```

路径请写绝对路径；相对路径需以 `./` 开头并相对于运行 `dsh` 命令的目录。

## 使用 / Usage

1. 打开侧栏「远程服务器」→「添加服务器」，填地址（如 `server.example.com` 或 `user@host`）、可选端口/密钥/远端端口/本地端口。
2. 点「测试」确认 SSH 连通。
3. 点「一键连接」：插件会自动部署 Node+DSH（首次较慢）、启动远端 DSH、建立隧道并给出访问地址。
4. 点「打开」在浏览器打开远端 DSH；或手动访问面板显示的 `http://127.0.0.1:<本地端口>/?token=...`。

- 「停止」= 停止远端 DSH 进程；「断开」= 只断开本机隧道；「删除」= 移除服务器记录。
- 远端日志位于服务器 `~/.dsh-remote-connector-<端口>.log`；token 地址也会打印在这里。

## 配置 / Config

`cordis.patch.yml` 中的默认配置可在 profile 的 patch 层覆盖：

| 键 | 默认 | 说明 |
|---|---|---|
| `sshBinary` | `ssh` | ssh 命令路径 |
| `connectTimeoutSec` | `15` | 连接超时（秒） |
| `storageDir` | `~/.dsh/dsh-remote-connector` | 服务器列表存储目录 |
| `nodeVersion` | `v22.21.0` | 部署到远端的 Node 版本 |
| `dshPackage` | `@deepseek-ai/dsh` | 部署到远端的 DSH npm 包 |
| `defaultRemotePort` | `8787` | 远端 DSH 默认端口 |
| `defaultLocalPort` | `8787` | 本机隧道默认端口 |

## 安全说明 / Security

- 部署在远端执行的是标准的 Node 官方 tarball 与 npm 包安装，不下载本仓库以外的可执行内容。
- 服务器列表与 token 地址保存在本机，token 属于敏感凭据，请勿分享。
- 隧道绑定本机回环地址（`127.0.0.1`），仅本机可访问。

## 许可证 / License

[MIT](LICENSE)
