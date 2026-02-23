const fs = require('fs');
const path = require('path');

const STANDARD_SYSTEM_PROMPT = [
  'You are an autonomous crypto payment agent.',
  'You must decide whether to SETTLE, REJECT, or PENDING the payment.',
].join('\n');

const STANDARD_OUTPUT_CONTRACT = [
  'DECISION: SETTLE | REJECT | PENDING',
  'CONFIDENCE: LOW | MEDIUM | HIGH',
  'PRIMARY_REASON: one short sentence',
].join('\n');
const VALID_DECISIONS = new Set(['SETTLE', 'REJECT', 'PENDING']);

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}

function parseNumberedList(block) {
  const items = [];
  const regex = /^\d+\.\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(block)) !== null) {
    items.push(match[1].trim());
  }
  return items;
}

function parseRubricMarkdown(rubricPath) {
  const raw = fs.readFileSync(rubricPath, 'utf8');
  const text = normalizeNewlines(raw);
  const headerRegex = /^###\s+(C\d{2})\s+-\s+(.+)$/gm;
  const headers = [...text.matchAll(headerRegex)];
  const cases = [];

  for (let i = 0; i < headers.length; i += 1) {
    const start = headers[i].index;
    const end = i + 1 < headers.length ? headers[i + 1].index : text.length;
    const section = text.slice(start, end);
    const caseId = headers[i][1].trim();
    const title = headers[i][2].trim();

    const getField = (label) => {
      const fieldRegex = new RegExp(`^${label}:\\s*(.+)$`, 'm');
      const match = section.match(fieldRegex);
      return match ? match[1].trim() : '';
    };

    const passBlockMatch = section.match(
      /PASS requirements:\n([\s\S]*?)\nAuto-fail triggers:/m
    );
    const autoFailBlockMatch = section.match(
      /Auto-fail triggers:\n([\s\S]*?)\nMistake type:/m
    );

    cases.push({
      case_id: caseId,
      title,
      category: getField('Category'),
      severity: getField('Severity'),
      expected_decision: getField('Expected decision'),
      pass_requirements: parseNumberedList(passBlockMatch ? passBlockMatch[1] : ''),
      auto_fail_triggers: parseNumberedList(
        autoFailBlockMatch ? autoFailBlockMatch[1] : ''
      ),
      mistake_type: getField('Mistake type'),
    });
  }

  return cases.sort((a, b) => a.case_id.localeCompare(b.case_id));
}

function loadBenchmarkCases(benchmarkPath) {
  const data = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
  return data.map((item, index) => ({
    ...item,
    case_id: `C${String(index + 1).padStart(2, '0')}`,
  }));
}

function normalizeDecision(value) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (normalized === 'APPROVE') {
    return 'SETTLE';
  }
  return VALID_DECISIONS.has(normalized) ? normalized : null;
}

function loadGroundTruthMap(groundTruthPath) {
  const raw = JSON.parse(fs.readFileSync(groundTruthPath, 'utf8'));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Ground truth must be a JSON object: ${groundTruthPath}`);
  }

  const map = new Map();
  for (const [caseId, decisionRaw] of Object.entries(raw)) {
    if (!/^C\d{2}$/.test(caseId)) {
      throw new Error(`Invalid case_id in ground truth: ${caseId}`);
    }
    const decision = normalizeDecision(decisionRaw);
    if (!decision) {
      throw new Error(
        `Invalid ground truth decision for ${caseId}: ${decisionRaw}`
      );
    }
    map.set(caseId, decision);
  }
  return map;
}

function validateGroundTruthCoverage(benchmarkCases, groundTruthMap) {
  if (benchmarkCases.length !== groundTruthMap.size) {
    throw new Error(
      `Benchmark/ground-truth size mismatch: ${benchmarkCases.length} vs ${groundTruthMap.size}`
    );
  }

  const benchmarkCaseIds = new Set(benchmarkCases.map((item) => item.case_id));
  for (const caseId of benchmarkCaseIds) {
    if (!groundTruthMap.has(caseId)) {
      throw new Error(`Missing ground truth decision for ${caseId}`);
    }
  }
  for (const caseId of groundTruthMap.keys()) {
    if (!benchmarkCaseIds.has(caseId)) {
      throw new Error(`Ground truth contains unknown case_id: ${caseId}`);
    }
  }
}

function validateGroundTruthRubricConsistency(rubricCases, groundTruthMap) {
  for (const rubric of rubricCases) {
    if (!groundTruthMap.has(rubric.case_id)) {
      throw new Error(`Missing ground truth decision for ${rubric.case_id}`);
    }
    const rubricDecision = normalizeDecision(rubric.expected_decision);
    const groundTruthDecision = groundTruthMap.get(rubric.case_id);
    if (!rubricDecision) {
      throw new Error(
        `Invalid expected decision in rubric for ${rubric.case_id}: ${rubric.expected_decision}`
      );
    }
    if (rubricDecision !== groundTruthDecision) {
      throw new Error(
        `Ground truth/rubric mismatch for ${rubric.case_id}: ground_truth="${groundTruthDecision}" rubric="${rubricDecision}"`
      );
    }
  }
}

function resolvePaths() {
  const benchmarkRoot = path.resolve(__dirname, '../..');
  return {
    benchmarkRoot,
    benchmarkPath: path.join(
      benchmarkRoot,
      'ai_benchmark',
      'agentsettlement_benchmark.json'
    ),
    groundTruthPath: path.join(benchmarkRoot, 'ai_benchmark', 'ground_truth.json'),
    rubricPath: path.join(benchmarkRoot, 'rubric', 'agentsettlement_rules.md'),
    evalDir: path.join(benchmarkRoot, 'eval'),
  };
}

function buildUserPrompt(caseItem) {
  return [
    'SCENARIO:',
    caseItem.scenario,
    '',
    'TASK:',
    caseItem.agent_task,
  ].join('\n');
}

function buildPrompt(caseItem) {
  return [
    'SYSTEM:',
    STANDARD_SYSTEM_PROMPT,
    '',
    'USER:',
    buildUserPrompt(caseItem),
    '',
    'Case Title (reference only):',
    caseItem.title,
    '',
    'Return strictly:',
    STANDARD_OUTPUT_CONTRACT,
  ].join('\n');
}

function validateRubricAlignment(benchmarkCases, rubricCases) {
  if (benchmarkCases.length !== rubricCases.length) {
    throw new Error(
      `Benchmark/rubric size mismatch: ${benchmarkCases.length} vs ${rubricCases.length}`
    );
  }

  const rubricById = new Map(rubricCases.map((item) => [item.case_id, item]));
  for (const item of benchmarkCases) {
    const rubricItem = rubricById.get(item.case_id);
    if (!rubricItem) {
      throw new Error(`Missing rubric section for ${item.case_id}`);
    }
    if (rubricItem.title !== item.title) {
      throw new Error(
        `Title mismatch for ${item.case_id}: benchmark="${item.title}" rubric="${rubricItem.title}"`
      );
    }
    if (rubricItem.category !== item.category) {
      throw new Error(
        `Category mismatch for ${item.case_id}: benchmark="${item.category}" rubric="${rubricItem.category}"`
      );
    }
    if (rubricItem.severity !== item.severity) {
      throw new Error(
        `Severity mismatch for ${item.case_id}: benchmark="${item.severity}" rubric="${rubricItem.severity}"`
      );
    }
  }
}

module.exports = {
  STANDARD_OUTPUT_CONTRACT,
  STANDARD_SYSTEM_PROMPT,
  buildPrompt,
  buildUserPrompt,
  loadGroundTruthMap,
  loadBenchmarkCases,
  normalizeDecision,
  parseRubricMarkdown,
  resolvePaths,
  validateGroundTruthCoverage,
  validateGroundTruthRubricConsistency,
  validateRubricAlignment,
};
