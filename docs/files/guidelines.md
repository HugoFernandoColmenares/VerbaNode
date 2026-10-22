# VerbaNode technical guidelines

VerbaNode is a local automation stack for a commit command, a short English pull request summary, an implementation prompt, and a git bootstrap script. Docker Compose runs n8n. LM Studio on this workstation runs the model **liquid/lfm2.5-1.2b** for the commit and pull request tasks. The prompt and git tasks are templates. Angular is the workspace. Text does not leave the machine for a paid model API.

These files are the technical source of truth. They describe the scaffold and the contracts implementation must follow. They do not describe shipped workflows or product screens. Those are not built yet.

## Author

Hugo Fernando Colmenares — [github.com/HugoFernandoColmenares](https://github.com/HugoFernandoColmenares)

## Documentation rule

Canonical writing lives in:

| Path | Role |
| --- | --- |
| `docs/files/guidelines.md` | Scope, stack, and this map |
| `docs/files/architecture.md` | Processes, request path, trust boundaries |
| `docs/files/docker.md` | Compose service, ports, volumes, host reachability |
| `docs/files/n8n.md` | Webhook contract and workflow shape |
| `docs/files/lmstudio.md` | Local model server and `liquid/lfm2.5-1.2b` |
| `docs/files/sqlite.md` | What is stored, and where |
| `verbaNodeApp/docs/files/architecture_guidelines.md` | Angular modules, routes, and client rules |
| `verbaNodeApp/docs/files/design_guidelines.md` | Look, tokens, interaction |
| `README.md` | How to boot the scaffold |

Screenshots belong in `docs/screenshot/` (stack) and `verbaNodeApp/docs/screenshot/` (UI). A screenshot illustrates a rule in those files. It does not replace the rule.

Do not add a second `ARCHITECTURE.md`, `DESIGN.md`, `PRODUCT.md`, or `setup.md`. Extend the files in this table.

Write these guidelines in English.

## Product scope

In scope:

1. **Commit command.** The user pastes a summary or a diff. The draft is one line: `git commit -m "summary"`.
2. **Pull request summary.** The user describes a use case. The draft is one English paragraph of about 150–200 characters.
3. **Implementation prompt.** The draft is the fixed preamble (Angular 22+, SOLID, DRY, KISS, and the gitignored design and architecture guidelines) plus the task the user wants done. The page composes that text. It does not edit a repository.
4. **Git bootstrap.** The draft is `git init` through `git push -u origin main`, with the commit message and GitHub origin filled in. The page does not run those commands.
5. **Local history.** A later workflow may record the task, the time, and the draft. The history is a local SQLite file. It is not an account system.

Out of scope:

- Cloud model APIs and their keys
- Sending email, running git, or pushing commits from the app
- User accounts, billing, and multi-tenant hosting
- Running LM Studio inside a container
- A production Angular image, until the UI exists

## Technology stack

| Layer | Technology | Role |
| --- | --- | --- |
| Workspace | Angular 22, standalone components, signals, OnPush | Forms, draft view, history list |
| Orchestration | Docker Compose | Runs n8n and names its volumes |
| Automation | n8n, self-hosted | Webhook, prompt, call to the model, response |
| Model runtime | LM Studio local server on the host | OpenAI-compatible `POST /v1/chat/completions` |
| Model | `liquid/lfm2.5-1.2b` | The model loaded on this workstation |
| State | SQLite | n8n's own database, plus a planned history file |
| UI styling | CSS variables in the Angular app | No component kit and no utility framework |

Angular details stay in `verbaNodeApp/docs/files/`. This folder owns the stack around it.

## Implementation order

1. Boot Compose and the LM Studio server using the README.
2. Build the n8n workflow that satisfies [n8n.md](n8n.md) and [lmstudio.md](lmstudio.md).
3. Build the Angular workspace against that webhook, using the app guidelines.
4. Add the history write described in [sqlite.md](sqlite.md).
5. Capture screenshots in the matching `screenshot/` folder when a screen or the editor is real.

## Secrets

`.env` is local. `.env.template` is the committed list of keys. The only secret the scaffold requires is `N8N_ENCRYPTION_KEY`. LM Studio on localhost does not use a cloud key. Do not add provider keys to make the path "also work in the cloud."
