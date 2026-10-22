# LM Studio

The text model runs in LM Studio on this workstation. The loaded model id is **liquid/lfm2.5-1.2b**. Compose does not start it, pull it, or mount its weights.

n8n reaches it with the OpenAI-compatible local server:

```text
POST http://host.docker.internal:1234/v1/chat/completions
```

The browser does not call this URL. See [architecture.md](architecture.md).

## Why it stays on the host

LM Studio is already installed here, and `liquid/lfm2.5-1.2b` is the model chosen for this machine. The app owns GPU access, the model library, and the context length setting. Duplicating that inside a container would be a second runtime, not the one this project uses.

Consequences:

- `docker compose up` does not load the model. The operator loads the model and starts the server before expecting a draft.
- A cold load can take longer than a warm completion. `LMSTUDIO_TIMEOUT_MS` covers a slow first token on this machine. It is not a license to send unbounded diffs. The webhook limits are in [n8n.md](n8n.md).
- Context length is whatever LM Studio is set to for the loaded model. The workflow does not override it with a guessed token count.

## Server settings on this machine

1. Load **liquid/lfm2.5-1.2b** in LM Studio.
2. Start the local server (Developer tab). The default port is **1234**.
3. Allow the server to be reached on the local network. A server bound only to the host's loopback interface is invisible to the n8n container, even with `host.docker.internal`.
4. Leave CORS permissive or unused. The caller is the container, not a browser page on another origin.
5. Confirm the id:

```text
curl.exe http://127.0.0.1:1234/v1/models
```

`LMSTUDIO_MODEL` must be that id. The scaffold default is `liquid/lfm2.5-1.2b`. If LM Studio reports a different id, put that exact string in `.env` and restart the n8n container so it picks up the change.

## Call shape

n8n sends a chat completion:

| Field | Value |
| --- | --- |
| `model` | `$env.LMSTUDIO_MODEL` |
| `temperature` | `0.2` |
| `messages` | One system message, one user message |
| Timeout | `LMSTUDIO_TIMEOUT_MS` (120000) |

No tools, no image input, no streaming in v1. The webhook waits for the full draft so the UI can show one result or one error.

The response field the workflow reads is `choices[0].message.content`.

## Manual check from the host

This checks LM Studio only. It does not check the webhook.

```text
curl.exe http://127.0.0.1:1234/v1/chat/completions -H "Content-Type: application/json" -d "{\"model\":\"liquid/lfm2.5-1.2b\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with the single word ready.\"}]}"
```

A connection error means the server is stopped or the port is not 1234. An unknown-model error means `LMSTUDIO_MODEL` does not match a loaded model. Update `.env`, then `docker compose up -d` again.

## Manual check from the container

After Compose is up:

```bash
docker compose exec n8n node -e "fetch(process.env.LMSTUDIO_BASE_URL+'/models').then(r=>r.text()).then(console.log).catch(e=>{console.error(e); process.exit(1)})"
```

Success here and failure from the host, or the reverse, means the bind address or `host.docker.internal` mapping is wrong. Fix LM Studio's listen address before changing the Angular app.

## What not to add

- An OpenAI, Anthropic, or other hosted key as a fallback
- A second model container "for CI"
- Direct `fetch` of port 1234 from an Angular service

If the model is replaced on this machine, change `LMSTUDIO_MODEL` and this file's model name in the same edit.
