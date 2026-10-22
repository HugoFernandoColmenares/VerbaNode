# SQLite

VerbaNode stores state in SQLite files on Docker volumes. There is no separate database server and no cloud database.

Two files, two jobs.

| File | Volume | Path in the n8n container | Status |
| --- | --- | --- | --- |
| n8n database | `verba_n8n` | `/home/node/.n8n/database.sqlite` | Created by n8n on first boot |
| Draft history | `verba_history` | `/data/verba_history.sqlite` | Reserved. Not created until the history step is implemented. |

n8n's file holds the owner account, credentials encrypted with `N8N_ENCRYPTION_KEY`, workflows, and execution logs. The application does not read that file to render history. Execution logs are an operator tool inside the n8n editor.

## Draft history

When the webhook is stable, the same workflow appends one row after a successful draft. Failures are not stored. The person can retry; a 503 is not a draft.

Table `drafts`:

| Column | Type | Rule |
| --- | --- | --- |
| `id` | INTEGER primary key | Autoincrement |
| `created_at` | TEXT | ISO-8601 UTC |
| `task` | TEXT | `commit`, `pr`, `prompt`, or `git` |
| `language` | TEXT | The requested language |
| `brief` | TEXT | The brief that was sent |
| `draft` | TEXT | The model text that was returned |
| `model` | TEXT | The id sent to LM Studio |

`context` is not stored. Diffs and letter notes can be large and sensitive. The history view shows when a draft was made, which task it was, the brief, and the draft.

The write happens in n8n, in the workflow, with a SQL node or a code node against `/data/verba_history.sqlite`. The Angular app does not open SQLite. A later `GET /webhook/verba/drafts` returns the newest rows, limited to 50, ordered by `created_at` descending. That second webhook is specified here so the UI has a target. It is not part of the first workflow.

There is no user id column. The stack is one workstation, one operator.

## Backup

The volume is the backup unit:

```bash
docker compose stop
docker run --rm -v verbanode_verba_n8n:/from -v %cd%:/to alpine tar -cvf /to/verba_n8n.tar /from
docker compose start
```

Confirm the volume name with `docker volume ls`. Compose prefixes it with the project name.

Restoring is the same tar in reverse, with the stack stopped. Restoring `verba_n8n` without the matching `N8N_ENCRYPTION_KEY` leaves stored credentials unreadable. Draft text in `verba_history` is not encrypted.

## What not to do

- Point n8n at Postgres "for later scale." One local user does not need it.
- Store prompts that include secrets from a diff in a second copy outside the volume.
- Let the Angular SSR process open either SQLite file.
