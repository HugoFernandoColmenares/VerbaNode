# Architecture

VerbaNode is three processes on one workstation. Compose owns one of them.

```text
browser (Angular, host :4200)
        |  POST /webhook/verba/draft
        v
n8n (container, 127.0.0.1:5678)
        |  POST /v1/chat/completions
        v
LM Studio (host :1234, model liquid/lfm2.5-1.2b)
```

n8n is the only component that knows the model id, the prompt for each task, and the LM Studio base URL. The browser never calls port 1234. That keeps CORS, the model id, and prompt text out of the Angular bundle.

LM Studio stays a desktop app. It already uses the workstation GPU and the model files installed for this machine. Packaging that runtime into an image would ignore the installation the project is meant to use.

## Trust boundary

All three listeners are local.

| Listener | Bind | Who may call it |
| --- | --- | --- |
| LM Studio | Host port 1234, reachable from Docker via `host.docker.internal` | n8n container |
| n8n | `127.0.0.1:5678` | Browser on this machine, and the operator |
| Angular dev server | `127.0.0.1:4200` by default | Browser on this machine |

n8n is not published on `0.0.0.0`. The webhook has no shared bearer token in v1 because the port is loopback-only. A token inside the Angular app would be visible in the browser and would not add a boundary. If n8n is ever published beyond localhost, put a secret on the webhook and stop shipping that secret in the frontend.

`N8N_BLOCK_ENV_ACCESS_IN_NODE=false` is a workstation exception so the workflow can read `LMSTUDIO_MODEL` and `LMSTUDIO_BASE_URL`. Do not reuse that setting on a shared server.

## Request path

1. The workspace collects one task: `commit`, `pr`, `prompt`, or `git`.
2. The browser `POST`s the JSON contract in [n8n.md](n8n.md) to `http://localhost:5678/webhook/verba/draft`.
3. n8n checks the task and required fields. A bad body returns 400 with a short `error` string. It does not call the model.
4. n8n builds a system prompt and a user prompt for that task. The system prompt fixes the shape of the draft. The user prompt is only the fields the person typed.
5. n8n calls LM Studio with `model` set from `LMSTUDIO_MODEL` (`liquid/lfm2.5-1.2b` on this machine) and a timeout of `LMSTUDIO_TIMEOUT_MS`.
6. n8n returns `{ task, draft, model }`. The UI shows `draft` and can copy it.
7. History storage is a later step. Until [sqlite.md](sqlite.md) is implemented, n8n execution data is the only record of a run.

The Angular SSR process is a web shell. It must not call n8n or LM Studio during server render. The draft request happens in the browser after the person submits the form.

## Failure behavior

| Condition | Result |
| --- | --- |
| LM Studio server is stopped | n8n returns 503. The UI says the local model server is not running. |
| Model id is not loaded | n8n returns 503 and includes the model id it tried. |
| The call exceeds `LMSTUDIO_TIMEOUT_MS` | n8n aborts and returns 504. The UI does not spin without a terminal state. |
| The model returns an empty message | n8n returns 502. The UI does not invent a draft. |
| The diff or brief is empty | 400 before any model call. |

The UI shows the error string from the workflow. It does not retry in a loop.

## Responsibilities

| Piece | Owns | Does not own |
| --- | --- | --- |
| Angular | Forms, validation messages, draft display, copy, history list | Prompts, model id, SQLite writes |
| n8n | Webhook, prompts, HTTP call, status codes, later history insert | Layout, CSS, git, SMTP |
| LM Studio | Loading `liquid/lfm2.5-1.2b`, OpenAI-compatible HTTP | Workflow routing, the UI |
| Compose | n8n image, loopback port, volumes, env injection | The model process, `ng serve` |
| SQLite | n8n state on `verba_n8n`; planned drafts on `verba_history` | Source of the draft text while the user is still editing |

## Angular place in the system

The app lives in `verbaNodeApp/`. Its module, route, and coding rules are [architecture_guidelines.md](../../verbaNodeApp/docs/files/architecture_guidelines.md). Its visual rules are [design_guidelines.md](../../verbaNodeApp/docs/files/design_guidelines.md).

The dev server stays on the host so UI work does not wait on an image build. A container for the built app is a later Compose service, added when the screens exist. That service still calls n8n on the Compose network. It still does not call LM Studio itself.

## What is already true in the repo

- `docker-compose.yml` defines the `n8n` service and the two volumes.
- `.env.template` lists the keys. `.env` is the local copy and is gitignored.
- `verbaNodeApp` is an Angular 22 CLI app with SSR enabled and the default placeholder screen.
- No workflow JSON is exported. No feature routes exist.
