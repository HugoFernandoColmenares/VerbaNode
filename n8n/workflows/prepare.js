const raw = $input.first().json;
const body = raw.body && typeof raw.body === 'object' ? raw.body : raw;
const task = String(body.task ?? '').trim();
const language = String(body.language ?? 'en').trim() || 'en';
const brief = String(body.brief ?? '');
const context = String(body.context ?? '');
const origin = String(body.origin ?? '').trim();

const known = ['commit', 'pr', 'prompt', 'git'];

function fail(status, error) {
  return [{ json: { ok: false, status, error } }];
}

function lengthError(value, max, name) {
  if (value.length > max) {
    return `${name} is longer than ${max} characters`;
  }
  return '';
}

if (!known.includes(task)) {
  return fail(400, 'Unknown task');
}

if (task === 'git') {
  const message = brief.trim();
  const messageError = lengthError(message, 4000, 'brief');
  const originError = lengthError(origin, 500, 'origin');
  if (!message) return fail(400, 'Commit message is empty');
  if (message.includes('\n') || message.includes('\r')) {
    return fail(400, 'Commit message must be a single line');
  }
  if (!origin) return fail(400, 'Origin URL is empty');
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(origin)) {
    return fail(400, 'Origin must be an https://github.com/owner/repo.git URL');
  }
  if (messageError) return fail(400, messageError);
  if (originError) return fail(400, originError);
  const draft = [
    'git init',
    'git add .',
    `git commit -m ${JSON.stringify(message)}`,
    'git branch -M main',
    `git remote add origin ${origin}`,
    'git push -u origin main',
  ].join('\n');
  return [{ json: { ok: true, mode: 'template', status: 200, task, draft, model: 'template' } }];
}

if (task === 'prompt') {
  if (!brief.trim()) return fail(400, 'Brief is empty');
  const briefError = lengthError(brief, 4000, 'brief');
  const contextError = lengthError(context, 24000, 'context');
  if (briefError) return fail(400, briefError);
  if (contextError) return fail(400, contextError);
  const preamble =
    'Bien colegui, Analiza el proyecto actual y luego, teniendo en cuenta los archivos de design_guidelines.md y architecture_guidelines.md (que están en la carpeta docs pero están agregados al archivo .gitignore y me gustaría que se mantuviera así) además de tener en cuenta las buenas prácticas de angular 22+, los principios SOLID, DRY y KISS y luego realiza lo siguiente:';
  const extra = context.trim() ? `\n\n${context.trim()}` : '';
  const draft = `${preamble}\n\n${brief.trim()}${extra}`;
  return [{ json: { ok: true, mode: 'template', status: 200, task, draft, model: 'template' } }];
}

if (!brief.trim() && !context.trim()) return fail(400, 'Brief is empty');
const briefError = lengthError(brief, 4000, 'brief');
const contextError = lengthError(context, 24000, 'context');
if (briefError) return fail(400, briefError);
if (contextError) return fail(400, contextError);

const summary =
  brief.trim() ||
  context
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 120) ||
  'Update';
const notes = context.trim();
const model = $env.LMSTUDIO_MODEL || 'liquid/lfm2.5-1.2b';

if (task === 'pr') {
  return [
    {
      json: {
        ok: true,
        mode: 'model',
        status: 200,
        task,
        model,
        system:
          'You write GitHub pull request summaries. Reply with exactly one English paragraph between 150 and 200 characters inclusive. Count characters before you finish. State how the change answers the use case. No title, no bullets, no quotes, no preamble, no second sentence if the first already fills the range.',
        user: notes ? `Use case:\n${summary}\n\nNotes:\n${notes}` : `Use case:\n${summary}`,
      },
    },
  ];
}

return [
  {
    json: {
      ok: true,
      mode: 'model',
      status: 200,
      task,
      model,
      system: `You write one git commit command. Reply with exactly one line in ${language}:\ngit commit -m "SUMMARY"\nSUMMARY is a concise imperative summary of the change. Do not add other lines or markdown fences.`,
      user: notes ? `Change:\n${summary}\n\nDiff or notes:\n${notes}` : `Change:\n${summary}`,
    },
  },
];
