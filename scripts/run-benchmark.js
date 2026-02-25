const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  STANDARD_OUTPUT_CONTRACT,
  STANDARD_SYSTEM_PROMPT,
  buildUserPrompt,
} = require('./lib/agentsettlementRubric');

try {
  require('dotenv').config();
} catch {
  // dotenv is optional at runtime.
}

const PROVIDERS = new Set(['mock', 'openai', 'gemini', 'local']);
const DEFAULT_PROVIDER_MODELS = {
  openai: 'gpt-4.1-mini',
  gemini: 'gemini-2.0-flash',
  local: 'qwen2.5:7b',
};

let cachedFetch = null;

function parseArgs(argv) {
  const args = {
    model: 'mock',
    provider: '',
    apiModel: '',
    key: '',
    outdir: '',
    decision: 'PENDING',
    baseUrl: '',
    temperature: 0,
    maxOutputTokens: 120,
    timeoutMs: 45000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--model=')) {
      args.model = arg.slice('--model='.length).trim() || args.model;
      continue;
    }
    if (arg === '--model' && i + 1 < argv.length) {
      args.model = String(argv[i + 1]).trim() || args.model;
      i += 1;
      continue;
    }
    if (arg.startsWith('--provider=')) {
      args.provider = arg.slice('--provider='.length).trim();
      continue;
    }
    if (arg === '--provider' && i + 1 < argv.length) {
      args.provider = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (arg.startsWith('--api-model=')) {
      args.apiModel = arg.slice('--api-model='.length).trim();
      continue;
    }
    if (arg === '--api-model' && i + 1 < argv.length) {
      args.apiModel = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (arg.startsWith('--key=')) {
      args.key = arg.slice('--key='.length).trim();
      continue;
    }
    if (arg === '--key' && i + 1 < argv.length) {
      args.key = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (arg.startsWith('--outdir=')) {
      args.outdir = arg.slice('--outdir='.length).trim();
      continue;
    }
    if (arg === '--outdir' && i + 1 < argv.length) {
      args.outdir = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (arg.startsWith('--decision=')) {
      args.decision = arg.slice('--decision='.length).trim().toUpperCase();
      continue;
    }
    if (arg === '--decision' && i + 1 < argv.length) {
      args.decision = String(argv[i + 1]).trim().toUpperCase();
      i += 1;
      continue;
    }
    if (arg.startsWith('--base-url=')) {
      args.baseUrl = arg.slice('--base-url='.length).trim();
      continue;
    }
    if (arg === '--base-url' && i + 1 < argv.length) {
      args.baseUrl = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (arg.startsWith('--temperature=')) {
      args.temperature = Number(arg.slice('--temperature='.length));
      continue;
    }
    if (arg === '--temperature' && i + 1 < argv.length) {
      args.temperature = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--max-output-tokens=')) {
      args.maxOutputTokens = Number(arg.slice('--max-output-tokens='.length));
      continue;
    }
    if (arg === '--max-output-tokens' && i + 1 < argv.length) {
      args.maxOutputTokens = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith('--timeout-ms=')) {
      args.timeoutMs = Number(arg.slice('--timeout-ms='.length));
      continue;
    }
    if (arg === '--timeout-ms' && i + 1 < argv.length) {
      args.timeoutMs = Number(argv[i + 1]);
      i += 1;
      continue;
    }
  }

  return args;
}

function normalizeDecision(rawValue) {
  const value = String(rawValue || '')
    .trim()
    .toUpperCase();
  if (value === 'APPROVE') return 'SETTLE';
  if (value === 'SETTLE' || value === 'REJECT' || value === 'PENDING') return value;
  return 'PENDING';
}

function parseFiniteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function resolveProviderConfig(parsedArgs) {
  const requestedProvider = String(parsedArgs.provider || '').trim().toLowerCase();
  const requestedModel = String(parsedArgs.model || '').trim();
  const requestedModelLower = requestedModel.toLowerCase();

  let provider = '';
  let apiModel = String(parsedArgs.apiModel || '').trim();

  if (requestedProvider) {
    provider = requestedProvider;
  } else if (PROVIDERS.has(requestedModelLower)) {
    provider = requestedModelLower;
  } else if (requestedModelLower.includes('gemini')) {
    provider = 'gemini';
    if (!apiModel) apiModel = requestedModel;
  } else if (
    requestedModelLower.includes('gpt') ||
    requestedModelLower.includes('openai') ||
    requestedModelLower.startsWith('o')
  ) {
    provider = 'openai';
    if (!apiModel) apiModel = requestedModel;
  } else if (requestedModelLower === 'mock') {
    provider = 'mock';
  } else {
    provider = 'local';
    if (!apiModel) apiModel = requestedModel;
  }

  if (!PROVIDERS.has(provider)) {
    throw new Error(
      `Unsupported provider "${provider}". Use one of: mock, openai, gemini, local.`
    );
  }

  if (!apiModel && provider !== 'mock') {
    apiModel = DEFAULT_PROVIDER_MODELS[provider] || '';
  }

  const keyFromEnv =
    provider === 'openai'
      ? process.env.OPENAI_API_KEY || ''
      : provider === 'gemini'
      ? process.env.GEMINI_API_KEY || ''
      : process.env.LOCAL_API_KEY || '';

  const key = parsedArgs.key || keyFromEnv;

  if ((provider === 'openai' || provider === 'gemini') && !key) {
    throw new Error(
      `${provider} provider requires an API key. Pass --key or set ${provider.toUpperCase()}_API_KEY in .env`
    );
  }

  const baseUrl =
    parsedArgs.baseUrl ||
    (provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : provider === 'gemini'
      ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          apiModel
        )}:generateContent?key=${encodeURIComponent(key)}`
      : provider === 'local'
      ? 'http://localhost:11434/v1/chat/completions'
      : '');

  return {
    provider,
    apiModel,
    key,
    baseUrl,
    decision: normalizeDecision(parsedArgs.decision),
    temperature: parseFiniteNumber(parsedArgs.temperature, 0),
    maxOutputTokens: Math.max(1, parseFiniteNumber(parsedArgs.maxOutputTokens, 120)),
    timeoutMs: Math.max(1000, parseFiniteNumber(parsedArgs.timeoutMs, 45000)),
    outdir: parsedArgs.outdir,
  };
}

function timestampId() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function loadCases(benchmarkPath) {
  const raw = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
  if (!Array.isArray(raw)) {
    throw new Error(`Benchmark file must be an array: ${benchmarkPath}`);
  }
  return raw.map((item, index) => ({
    ...item,
    case_id: `C${String(index + 1).padStart(2, '0')}`,
  }));
}

function toJsonl(records) {
  return `${records.map((item) => JSON.stringify(item)).join('\n')}\n`;
}

function sanitizeId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60);
}

function buildPrompts(caseItem) {
  const userPrompt = [
    buildUserPrompt(caseItem),
    '',
    'Case Title (reference only):',
    caseItem.title,
    '',
    'Return strictly:',
    STANDARD_OUTPUT_CONTRACT,
  ].join('\n');

  return {
    systemPrompt: STANDARD_SYSTEM_PROMPT,
    userPrompt,
  };
}

async function getFetch() {
  if (cachedFetch) return cachedFetch;
  if (typeof fetch === 'function') {
    cachedFetch = fetch.bind(globalThis);
    return cachedFetch;
  }
  const imported = await import('node-fetch');
  cachedFetch = imported.default;
  return cachedFetch;
}

async function fetchJson(url, options, timeoutMs) {
  const fetchFn = await getFetch();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      ...options,
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload = {};
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = {};
      }
    }

    if (!response.ok) {
      const detail =
        (payload &&
          (payload.error?.message || payload.message || payload.error_description)) ||
        raw ||
        `HTTP ${response.status}`;
      throw new Error(`HTTP ${response.status}: ${String(detail).slice(0, 400)}`);
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(config, prompts) {
  const body = {
    model: config.apiModel,
    temperature: config.temperature,
    max_tokens: config.maxOutputTokens,
    messages: [
      { role: 'system', content: prompts.systemPrompt },
      { role: 'user', content: prompts.userPrompt },
    ],
  };

  const payload = await fetchJson(
    config.baseUrl,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    config.timeoutMs
  );

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('OpenAI response missing choices[0].message.content');
  }
  return content.trim();
}

async function callGemini(config, prompts) {
  const body = {
    systemInstruction: {
      role: 'system',
      parts: [{ text: prompts.systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: prompts.userPrompt }],
      },
    ],
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
    },
  };

  const payload = await fetchJson(
    config.baseUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    config.timeoutMs
  );

  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error('Gemini response missing candidates[0].content.parts');
  }

  const text = parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('Gemini response parts were empty');
  }
  return text;
}

async function callLocal(config, prompts) {
  const body = {
    model: config.apiModel,
    temperature: config.temperature,
    max_tokens: config.maxOutputTokens,
    messages: [
      { role: 'system', content: prompts.systemPrompt },
      { role: 'user', content: prompts.userPrompt },
    ],
  };

  const headers = {
    'Content-Type': 'application/json',
  };
  if (config.key) headers.Authorization = `Bearer ${config.key}`;

  const payload = await fetchJson(
    config.baseUrl,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
    config.timeoutMs
  );

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Local provider response missing choices[0].message.content');
  }
  return content.trim();
}

function mockModelOutput(config) {
  return [
    `DECISION: ${config.decision}`,
    'CONFIDENCE: LOW',
    'PRIMARY_REASON: Mock run placeholder response.',
  ].join('\n');
}

async function generateModelOutput(config, caseItem) {
  if (config.provider === 'mock') {
    return mockModelOutput(config);
  }

  const prompts = buildPrompts(caseItem);
  if (config.provider === 'openai') {
    return callOpenAI(config, prompts);
  }
  if (config.provider === 'gemini') {
    return callGemini(config, prompts);
  }
  if (config.provider === 'local') {
    return callLocal(config, prompts);
  }
  throw new Error(`Unsupported provider: ${config.provider}`);
}

async function main() {
  const parsedArgs = parseArgs(process.argv.slice(2));
  const config = resolveProviderConfig(parsedArgs);

  const rootDir = path.resolve(__dirname, '..');
  const benchmarkPath = path.join(rootDir, 'ai_benchmark', 'agentsettlement_benchmark.json');
  const scoreScript = path.join(rootDir, 'scripts', 'score-model-responses.js');

  if (!fs.existsSync(benchmarkPath)) {
    throw new Error(`Benchmark file not found: ${benchmarkPath}`);
  }
  if (!fs.existsSync(scoreScript)) {
    throw new Error(`Scoring script not found: ${scoreScript}`);
  }

  const runModelLabel =
    config.provider === 'mock'
      ? 'mock'
      : `${config.provider}:${config.apiModel || 'unspecified'}`;
  const runId = `${sanitizeId(runModelLabel)}_${timestampId()}`;

  const outdir = config.outdir
    ? path.resolve(config.outdir)
    : path.join(rootDir, 'eval', 'runs', runId);
  fs.mkdirSync(outdir, { recursive: true });

  process.stdout.write(`Provider: ${config.provider}\n`);
  if (config.provider !== 'mock') {
    process.stdout.write(`API Model: ${config.apiModel}\n`);
    process.stdout.write(`Endpoint: ${config.baseUrl}\n`);
  }

  const cases = loadCases(benchmarkPath);
  const responsesPath = path.join(outdir, 'responses.jsonl');

  const records = [];
  for (const c of cases) {
    process.stdout.write(`Running: ${c.case_id} ${c.title}\n`);
    try {
      const modelOutput = await generateModelOutput(config, c);
      records.push({
        case_id: c.case_id,
        model_output: modelOutput,
      });
    } catch (error) {
      throw new Error(`Case ${c.case_id} failed: ${error.message}`);
    }
  }

  fs.writeFileSync(responsesPath, toJsonl(records), 'utf8');

  const scoreRun = spawnSync(
    process.execPath,
    [scoreScript, '--input', responsesPath, '--outdir', outdir, '--model', runModelLabel],
    { cwd: rootDir, encoding: 'utf8' }
  );

  if (scoreRun.status !== 0) {
    const stderr = scoreRun.stderr ? scoreRun.stderr.trim() : '';
    const stdout = scoreRun.stdout ? scoreRun.stdout.trim() : '';
    throw new Error(
      ['Scoring failed.', stderr, stdout]
        .filter((line) => line.length > 0)
        .join('\n')
    );
  }

  const summaryPath = path.join(outdir, 'results_summary.json');
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Expected summary not found: ${summaryPath}`);
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  process.stdout.write('\n');
  process.stdout.write(`Accuracy: ${Number(summary.pass_rate_pct).toFixed(1)}%\n`);
  process.stdout.write(
    `Critical Fail Rate: ${Number(summary.critical_fail_rate_pct).toFixed(1)}%\n`
  );
  process.stdout.write(
    `Risk-Weighted Fail: ${Number(summary.risk_weighted_fail_rate_pct).toFixed(1)}%\n`
  );
  process.stdout.write(`Saved: ${responsesPath}\n`);
  process.stdout.write(`Summary: ${summaryPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
