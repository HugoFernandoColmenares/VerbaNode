import fs from 'node:fs';

const prepare = fs.readFileSync(new URL('./prepare.js', import.meta.url), 'utf8');
const format = fs.readFileSync(new URL('./format-draft.js', import.meta.url), 'utf8');

const workflow = {
  id: 'HMws5BgoL5uHEWwS',
  name: 'Verba draft',
  nodes: [
    {
      parameters: {
        httpMethod: 'POST',
        path: 'verba/draft',
        responseMode: 'responseNode',
        options: {},
      },
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [240, 300],
      webhookId: 'verba-draft',
    },
    {
      parameters: { mode: 'runOnceForAllItems', jsCode: prepare },
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Prepare',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [480, 300],
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [
            {
              id: 'ok-is-false',
              leftValue: '={{ $json.ok ? "yes" : "no" }}',
              rightValue: 'no',
              operator: { type: 'string', operation: 'equals' },
            },
          ],
          combinator: 'and',
        },
      },
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Needs error',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [720, 300],
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [
            {
              id: 'mode-is-template',
              leftValue: '={{ $json.mode }}',
              rightValue: 'template',
              operator: { type: 'string', operation: 'equals' },
            },
          ],
          combinator: 'and',
        },
      },
      id: '55555555-5555-4555-8555-555555555555',
      name: 'Is template',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [980, 160],
    },
    {
      parameters: {
        method: 'POST',
        url: '={{ ($env.LMSTUDIO_BASE_URL || "http://host.docker.internal:1234/v1").replace(/\\/$/, "") + "/chat/completions" }}',
        sendBody: true,
        specifyBody: 'json',
        jsonBody:
          '={{ JSON.stringify({ model: $json.model, temperature: 0.2, messages: [{ role: "system", content: $json.system }, { role: "user", content: $json.user }] }) }}',
        options: { timeout: '={{ Number($env.LMSTUDIO_TIMEOUT_MS || 120000) }}' },
      },
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Call model',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1220, 420],
      onError: 'continueRegularOutput',
    },
    {
      parameters: { mode: 'runOnceForAllItems', jsCode: format },
      id: '88888888-8888-4888-8888-888888888888',
      name: 'Format draft',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1460, 420],
    },
    {
      parameters: {
        respondWith: 'json',
        responseBody:
          '={{ $json.ok ? { task: $json.task, draft: $json.draft, model: $json.model } : { error: $json.error } }}',
        options: {
          responseCode: '={{ $json.status }}',
          responseHeaders: {
            entries: [{ name: 'Access-Control-Allow-Origin', value: 'http://localhost:4200' }],
          },
        },
      },
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Respond',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.4,
      position: [1700, 300],
    },
  ],
  connections: {
    Webhook: { main: [[{ node: 'Prepare', type: 'main', index: 0 }]] },
    Prepare: { main: [[{ node: 'Needs error', type: 'main', index: 0 }]] },
    'Needs error': {
      main: [
        [{ node: 'Respond', type: 'main', index: 0 }],
        [{ node: 'Is template', type: 'main', index: 0 }],
      ],
    },
    'Is template': {
      main: [
        [{ node: 'Respond', type: 'main', index: 0 }],
        [{ node: 'Call model', type: 'main', index: 0 }],
      ],
    },
    'Call model': { main: [[{ node: 'Format draft', type: 'main', index: 0 }]] },
    'Format draft': { main: [[{ node: 'Respond', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
  staticData: null,
};

fs.writeFileSync(new URL('./verba-draft.json', import.meta.url), JSON.stringify(workflow, null, 2));
console.log('nodes', workflow.nodes.length);
