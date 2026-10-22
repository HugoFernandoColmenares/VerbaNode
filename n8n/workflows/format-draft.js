const prepared = $('Prepare').first().json;
const item = $input.first();
const http = item.json ?? {};
const failure = item.error?.message || http.error?.message || (typeof http.error === 'string' ? http.error : '');

if (failure || !http.choices) {
  const text = String(failure || http.error?.message || 'connection failed');
  if (/timeout|ETIMEDOUT|aborted/i.test(text)) {
    return [{ json: { ok: false, status: 504, error: 'The local model timed out' } }];
  }
  if (/model/i.test(text)) {
    return [{ json: { ok: false, status: 503, error: 'The model id is not loaded' } }];
  }
  return [{ json: { ok: false, status: 503, error: 'Local model server is not running' } }];
}

let draft = String(http.choices?.[0]?.message?.content ?? '').trim();
draft = draft.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();

if (prepared.task === 'commit') {
  const line = draft
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('git commit'));
  if (line) draft = line;
}

if (prepared.task === 'pr') {
  draft = draft.replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim();
  if (draft.length > 200) {
    const window = draft.slice(0, 200);
    const stop = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
    if (stop >= 149) {
      draft = window.slice(0, stop + 1).trim();
    } else {
      const space = window.lastIndexOf(' ');
      draft = `${(space > 120 ? window.slice(0, space) : window).trim()}…`;
    }
  }
}

if (!draft) {
  return [{ json: { ok: false, status: 502, error: 'The model returned an empty draft' } }];
}

return [{ json: { ok: true, status: 200, task: prepared.task, draft, model: prepared.model } }];
