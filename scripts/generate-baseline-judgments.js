const fs = require('fs');
const path = require('path');
const {
  loadGroundTruthMap,
  loadBenchmarkCases,
  normalizeDecision,
  parseRubricMarkdown,
  resolvePaths,
  validateGroundTruthCoverage,
  validateGroundTruthRubricConsistency,
  validateRubricAlignment,
} = require('./lib/agentsettlementRubric');

function parseArgs(argv) {
  const args = { baseline: null, output: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--baseline' && i + 1 < argv.length) {
      args.baseline = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--output' && i + 1 < argv.length) {
      args.output = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows) {
  return rows
    .map((row) => row.map((value) => csvEscape(value)).join(','))
    .join('\n');
}

function getBaselineDecision(caseItem, baseline) {
  if (baseline === 'always_settle') {
    return 'SETTLE';
  }
  if (baseline === 'rule_strong') {
    const pendingCaseIds = new Set(['C07', 'C11', 'C15', 'C16', 'C19']);
    if (pendingCaseIds.has(caseItem.case_id)) {
      return 'PENDING';
    }
    return 'REJECT';
  }
  throw new Error(
    `Unknown baseline "${baseline}". Use: rule_strong | always_settle`
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.baseline) {
    throw new Error('Missing --baseline');
  }

  const { benchmarkPath, groundTruthPath, rubricPath, evalDir } = resolvePaths();
  const benchmarkCases = loadBenchmarkCases(benchmarkPath);
  const groundTruthById = loadGroundTruthMap(groundTruthPath);
  const rubricCases = parseRubricMarkdown(rubricPath);
  validateGroundTruthCoverage(benchmarkCases, groundTruthById);
  validateRubricAlignment(benchmarkCases, rubricCases);
  validateGroundTruthRubricConsistency(rubricCases, groundTruthById);

  const rubricById = new Map(rubricCases.map((item) => [item.case_id, item]));
  const rows = [
    [
      'case_id',
      'title',
      'category',
      'severity',
      'expected_decision',
      'decision',
      'format_ok',
      'req1_met',
      'req2_met',
      'req3_met',
      'af1_triggered',
      'af2_triggered',
      'mistake_type',
      'notes',
    ],
  ];

  for (const caseItem of benchmarkCases) {
    const rubric = rubricById.get(caseItem.case_id);
    const expected = normalizeDecision(groundTruthById.get(caseItem.case_id));
    if (!expected) {
      throw new Error(`Invalid ground truth decision for ${caseItem.case_id}`);
    }
    const decision = getBaselineDecision(caseItem, args.baseline);
    const decisionMatch = decision === expected;

    rows.push([
      caseItem.case_id,
      caseItem.title,
      caseItem.category,
      caseItem.severity,
      expected,
      decision,
      '1',
      decisionMatch ? '1' : '0',
      decisionMatch ? '1' : '0',
      decisionMatch ? '1' : '0',
      '0',
      '0',
      decisionMatch ? '' : rubric.mistake_type,
      `baseline=${args.baseline}`,
    ]);
  }

  const outputPath = args.output
    ? path.resolve(args.output)
    : path.join(evalDir, `${args.baseline}_judgments.csv`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${toCsv(rows)}\n`, 'utf8');
  process.stdout.write(`Generated baseline judgments at ${outputPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
