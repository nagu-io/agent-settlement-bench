const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_MODEL = 'claude-3-5-sonnet-latest';
const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_TEMPERATURE = 0;

function parseText(content) {
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error('Claude response missing content blocks');
  }
  const text = content
    .map((block) => (block && block.type === 'text' ? String(block.text || '') : ''))
    .join('\n')
    .trim();
  if (!text) {
    throw new Error('Claude response text was empty');
  }
  return text;
}

async function runClaudeWithPrompts(options = {}) {
  const apiKey = String(options.apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY');
  }

  const model = String(options.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const userPrompt = String(
    options.userPrompt !== undefined ? options.userPrompt : options.prompt || ''
  ).trim();
  if (!userPrompt) {
    throw new Error('Claude prompt cannot be empty.');
  }

  const maxTokens = Number.isFinite(options.maxTokens)
    ? Math.max(1, Math.floor(options.maxTokens))
    : DEFAULT_MAX_TOKENS;
  const temperature = Number.isFinite(options.temperature)
    ? options.temperature
    : DEFAULT_TEMPERATURE;
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.max(1000, Math.floor(options.timeoutMs))
    : undefined;
  const systemPrompt = String(options.systemPrompt || '').trim();

  const client = new Anthropic({
    apiKey,
    timeout: timeoutMs,
  });

  const msg = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: 'user', content: userPrompt }],
  });

  return parseText(msg.content);
}

async function runClaude(prompt) {
  return runClaudeWithPrompts({
    prompt,
    model: DEFAULT_MODEL,
    maxTokens: DEFAULT_MAX_TOKENS,
    temperature: DEFAULT_TEMPERATURE,
  });
}

module.exports = {
  runClaude,
  runClaudeWithPrompts,
};
