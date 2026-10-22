# n8n

n8n is the automation runtime. One webhook accepts every draft request. The workflow branches on `task`, calls LM Studio, and returns the draft. The workflow is not in the repository yet. This file is the contract the workflow and the Angular client share.

Editor: `http://localhost:5678` after `docker compose up -d`.

## Webhook

| | |
| --- | --- |
| Method | `POST` |
| Production path | `/webhook/verba/draft` |
| Test path, while the editor is listening | `/webhook-test/verba/draft` |
| Request content type | `application/json` |
| Success | `200` and a JSON body |
| Client | Browser on this machine |

The production URL the UI will call:

```text
http://localhost:5678/webhook/verba/draft
```

## Request

```json
{
  "task": "commit",
  "language": "en",
  "brief": "Short instruction in the user's words",
  "context": "Optional diff, notes, or source text"
}
```

| Field | Rule |
| --- | --- |
| `task` | `commit`, `pr`, `prompt`, or `git` |
| `language` | BCP 47 tag. Used by `commit`. `pr` is always English. Default `en`. |
| `brief` | For `commit`, the summary. For `pr`, the use case. For `prompt`, the instruction that follows the preamble. For `git`, the commit message inside `git commit -m`. |
| `context` | Optional notes or diff for `commit`, `pr`, and `prompt`. |
| `origin` | Required for `git`. An `https://github.com/owner/repo.git` URL. |

Limits, enforced in the workflow before the model call:

| Field | Max |
| --- | --- |
| `brief` | 4 000 characters |
| `context` | 24 000 characters |

A longer diff is the operator's to trim. The workflow rejects it with 400 instead of silently cutting the middle of a patch.

## Response

```json
{
  "task": "commit",
  "draft": "feat(scope): imperative subject\n\nBody when needed.\n",
  "model": "liquid/lfm2.5-1.2b"
}
```

`model` is the id that was sent to LM Studio, not a label invented by the UI.

Error body, for every non-200 status:

```json
{
  "error": "Local model server is not running"
}
```

| Status | When |
| --- | --- |
| 400 | Unknown task, empty brief, or a field over the limit |
| 502 | LM Studio answered with an empty draft |
| 503 | Connection refused, or the model id is not loaded |
| 504 | `LMSTUDIO_TIMEOUT_MS` elapsed |

## Workflow shape

The workflow to build, in order:

1. **Webhook** node, path `verba/draft`, `POST`, response mode "last node".
2. **Code or IF** nodes that validate `task`, `brief`, and the length limits. Fail closed.
3. **Switch** on `task`.
4. Three prompt branches. Each branch sets a system message and a user message. The system message is fixed in the workflow. The user message is only `language`, `brief`, and `context`.
5. **HTTP Request** to `{{$env.LMSTUDIO_BASE_URL}}/chat/completions` (the base URL already ends in `/v1`). Header `Content-Type: application/json`. Timeout from `LMSTUDIO_TIMEOUT_MS`. Body:

```json
{
  "model": "={{$env.LMSTUDIO_MODEL}}",
  "temperature": 0.2,
  "messages": [
    { "role": "system", "content": "={{$json.system}}"},
    { "role": "user", "content": "={{$json.user}}"}
  ]
}
```

Temperature stays low. These tasks are drafts with a requested shape, not open-ended chat.

6. Read `choices[0].message.content`. Trim it. If it is empty, respond 502.
7. Respond with `task`, `draft`, and `model`.

`commit` and `pr` call LM Studio. `prompt` and `git` do not. They fill a template in the Prepare node and return it with `model` set to `template`.

Commit system prompt, in substance:

- Reply with exactly one line: `git commit -m "SUMMARY"`.
- `SUMMARY` is a concise imperative summary in the requested language.
- Do not invent files or behavior that are not in `brief` or `context`.

Pull request system prompt, in substance:

- Reply with one English paragraph of about 150 to 200 characters.
- State how the change answers the use case.
- No title, bullets, quotes, or preamble.

Prompt template, in substance:

- The fixed Spanish preamble that names `design_guidelines.md` and `architecture_guidelines.md`, notes that those files are gitignored and must stay gitignored, and requires Angular 22+, SOLID, DRY, and KISS.
- Then the user's task, then any extra notes.

Git template, in substance, one command per line:

- `git init`
- `git add .`
- `git commit -m "<message>"`
- `git branch -M main`
- `git remote add origin <url>`
- `git push -u origin main`

The workflow does not execute those commands. The origin must match `https://github.com/owner/repo` with an optional `.git` suffix.

## Environment the workflow reads

| Variable | Purpose |
| --- | --- |
| `LMSTUDIO_BASE_URL` | `http://host.docker.internal:1234/v1` |
| `LMSTUDIO_MODEL` | `liquid/lfm2.5-1.2b` on this workstation |
| `LMSTUDIO_TIMEOUT_MS` | Abort the HTTP node. Default `120000`. |

`N8N_BLOCK_ENV_ACCESS_IN_NODE` is `false` in Compose so those expressions resolve. See [docker.md](docker.md).

## Persistence inside n8n

The first boot asks for an owner account. That account lives in the `verba_n8n` volume. Workflows created in the editor live there too.

When the workflow is stable, export it to `n8n/workflows/verba-draft.json` in this repository so the contract is reviewable. That directory does not exist yet. Create it with the first export, not before.

## What the UI must not do

The Angular app does not embed an n8n API key, does not call the n8n REST API to build workflows, and does not parse execution logs to recover a draft. The webhook response is the draft.
