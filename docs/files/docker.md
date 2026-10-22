# Docker

Compose runs n8n. It does not run LM Studio, and it does not run the Angular dev server. Those two processes are installed on the host on purpose. See [architecture.md](architecture.md) and [lmstudio.md](lmstudio.md).

The project file is `docker-compose.yml` at the repository root. The project name is `verbanode`.

## Service

| Setting | Value |
| --- | --- |
| Service | `n8n` |
| Image | `docker.n8n.io/n8nio/n8n` |
| Restart | `unless-stopped` |
| Published port | `127.0.0.1:${N8N_PORT:-5678}` → container `5678` |
| Env file | `.env` |
| Host alias | `host.docker.internal` → `host-gateway` |

Pin the image tag before this stack is copied to another machine. `latest` is acceptable on this workstation while workflows do not exist yet.

`N8N_SECURE_COOKIE=false` matches plain HTTP on localhost. Do not put a TLS terminator in front of this file until the bind address and cookie flag are revised together.

`N8N_ENCRYPTION_KEY` has no default. Compose refuses to start if it is missing. Set it in `.env` before the first boot and keep the same value for the life of the `verba_n8n` volume.

Diagnostics, version notifications, and the template gallery are off. They are network calls the local stack does not need.

## Volumes

| Volume | Mount | Contents |
| --- | --- | --- |
| `verba_n8n` | `/home/node/.n8n` | n8n SQLite database, encryption salt, owner account, exported workflow state |
| `verba_history` | `/data` | Reserved for `verba_history.sqlite`. Unused until the history workflow exists. |

Named volumes survive `docker compose down`. They are removed only with `docker compose down -v`, which deletes the n8n owner account and any saved workflows. Do not use that flag to restart the editor.

Do not bind-mount the n8n data directory onto the Windows working tree. Permissions and file watching on that mount are a poor fit for `/home/node/.n8n`.

## Network

Compose attaches `n8n` to the default project network. No extra network is declared.

From inside the container:

- `127.0.0.1` is the container, not the Windows host.
- `host.docker.internal` is the Windows host. LM Studio is reached there.
- `extra_hosts` maps that name through `host-gateway` so the same file works if the engine is not Docker Desktop.

From the browser on Windows:

- n8n is `http://localhost:5678`
- LM Studio, for a manual check only, is `http://127.0.0.1:1234`
- Angular is `http://localhost:4200`

Port 5678 is bound to loopback. Another machine on the LAN cannot open the editor or the webhook through this Compose file.

## Health

The healthcheck requests `http://127.0.0.1:5678/healthz` with the Node binary already in the image. A failing check marks the container unhealthy. It does not by itself mean the webhook contract is implemented.

## Commands

From the repository root, with `.env` present:

```bash
docker compose up -d
docker compose ps
docker compose logs -f n8n
docker compose stop
```

The Angular app is still:

```bash
cd verbaNodeApp
npm start
```

## Later image

When the workspace is ready to ship as a container, add a second service that serves the production build and joins the same project network. That service calls `http://n8n:5678` inside the network. The browser would then use one published UI port. Do not add that service against the CLI placeholder.
