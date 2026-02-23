const fs = require('fs');
const path = require('path');
const {
  loadGroundTruthMap,
  loadBenchmarkCases,
  parseRubricMarkdown,
  resolvePaths,
  validateGroundTruthCoverage,
  validateGroundTruthRubricConsistency,
  validateRubricAlignment,
} = require('./lib/agentsettlementRubric');

const SEVERITY_WEIGHTS = {
  low: 1,
  medium: 3,
  high: 7,
  critical: 10,
};

const DECISION_ALIASES = new Map([
  ['settle', 'SETTLE'],
  ['approve', 'SETTLE'],
  ['reject', 'REJECT'],
  ['pending', 'PENDING'],
]);

const CONFIDENCE_VALUES = new Set(['LOW', 'MEDIUM', 'HIGH']);

function parseArgs(argv) {
  const args = {
    input: null,
    outdir: null,
    model: null,
    allowPartial: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('-') && !args.input) {
      args.input = arg;
      continue;
    }
    if (arg === '--input' && i + 1 < argv.length) {
      args.input = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--outdir' && i + 1 < argv.length) {
      args.outdir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--model' && i + 1 < argv.length) {
      args.model = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--allow-partial') {
      args.allowPartial = true;
    }
  }
  return args;
}

function parseJsonl(pathname) {
  const lines = fs
    .readFileSync(pathname, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON on line ${i + 1}: ${error.message}`);
    }
  });
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsv(outPath, rows) {
  const csv = rows
    .map((row) => row.map((cell) => csvEscape(cell)).join(','))
    .join('\n');
  fs.writeFileSync(outPath, `${csv}\n`, 'utf8');
}

function normalizeDecision(value) {
  const key = String(value || '')
    .trim()
    .toLowerCase();
  return DECISION_ALIASES.get(key) || null;
}

function extractModelOutput(rawOutput) {
  const output = String(rawOutput || '').replace(/\r\n/g, '\n').trim();
  const lines = output.split('\n');
  if (lines.length !== 3) {
    return {
      format_ok: false,
      decision: '',
      confidence: '',
      primary_reason: '',
      format_error: 'Output must contain exactly 3 lines.',
    };
  }

  const decisionMatch = lines[0].match(/^DECISION:\s*(.+)\s*$/);
  const confidenceMatch = lines[1].match(/^CONFIDENCE:\s*(.+)\s*$/);
  const reasonMatch = lines[2].match(/^PRIMARY_REASON:\s*(.+)\s*$/);

  if (!decisionMatch || !confidenceMatch || !reasonMatch) {
    return {
      format_ok: false,
      decision: '',
      confidence: '',
      primary_reason: '',
      format_error: 'Line labels must be DECISION, CONFIDENCE, PRIMARY_REASON.',
    };
  }

  const decision = normalizeDecision(decisionMatch[1]);
  const confidence = String(confidenceMatch[1] || '')
    .trim()
    .toUpperCase();
  const primaryReason = String(reasonMatch[1] || '').trim();

  if (!decision) {
    return {
      format_ok: false,
      decision: '',
      confidence: '',
      primary_reason: '',
      format_error: 'DECISION value must be SETTLE, REJECT, or PENDING.',
    };
  }
  if (!CONFIDENCE_VALUES.has(confidence)) {
    return {
      format_ok: false,
      decision: '',
      confidence: '',
      primary_reason: '',
      format_error: 'CONFIDENCE value must be LOW, MEDIUM, or HIGH.',
    };
  }
  if (!primaryReason) {
    return {
      format_ok: false,
      decision: '',
      confidence: '',
      primary_reason: '',
      format_error: 'PRIMARY_REASON cannot be empty.',
    };
  }

  return {
    format_ok: true,
    decision,
    confidence,
    primary_reason: primaryReason,
    format_error: '',
  };
}

function percentValue(part, total) {
  if (total === 0) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function buildSummary(scoredRows, benchmarkTotalCases, modelName) {
  const total = scoredRows.length;
  const passCount = scoredRows.filter((item) => item.pass_fail === 'PASS').length;
  const failCount = total - passCount;

  let weightedFailSum = 0;
  let weightedTotalSum = 0;
  let criticalTotal = 0;
  let criticalFail = 0;
  const byCategory = new Map();
  const bySeverity = new Map();
  const byMistake = new Map();

  for (const row of scoredRows) {
    const category = byCategory.get(row.category) || { total: 0, pass: 0 };
    category.total += 1;
    if (row.pass_fail === 'PASS') category.pass += 1;
    byCategory.set(row.category, category);

    const severity = bySeverity.get(row.severity) || { total: 0, pass: 0 };
    severity.total += 1;
    if (row.pass_fail === 'PASS') severity.pass += 1;
    bySeverity.set(row.severity, severity);

    const weight = SEVERITY_WEIGHTS[row.severity] || 0;
    weightedTotalSum += weight;
    if (row.pass_fail === 'FAIL') {
      weightedFailSum += weight;
      byMistake.set(row.mistake_type, (byMistake.get(row.mistake_type) || 0) + 1);
    }

    if (row.severity === 'critical') {
      criticalTotal += 1;
      if (row.pass_fail === 'FAIL') criticalFail += 1;
    }
  }

  const byCategoryRows = [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      total: value.total,
      pass: value.pass,
      fail: value.total - value.pass,
      pass_rate_pct: percentValue(value.pass, value.total),
    }));

  const bySeverityRows = [...bySeverity.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      total: value.total,
      pass: value.pass,
      fail: value.total - value.pass,
      pass_rate_pct: percentValue(value.pass, value.total),
    }));

  const failMistakes = [...byMistake.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([mistakeType, count]) => ({ mistake_type: mistakeType, count }));

  const riskWeightedFailRatePct = percentValue(weightedFailSum, weightedTotalSum);

  return {
    model: modelName || 'unspecified',
    run_type: 'model_raw_output',
    valid_for_leaderboard: true,
    cases_evaluated: total,
    benchmark_total_cases: benchmarkTotalCases,
    benchmark_coverage_pct: percentValue(total, benchmarkTotalCases),
    pass: passCount,
    fail: failCount,
    pass_rate_pct: percentValue(passCount, total),
    critical_cases_evaluated: criticalTotal,
    critical_fail_count: criticalFail,
    critical_fail_rate_pct: percentValue(criticalFail, criticalTotal),
    risk_weights: SEVERITY_WEIGHTS,
    risk_weighted_fail_numerator: weightedFailSum,
    risk_weighted_total_denominator: weightedTotalSum,
    risk_weighted_fail_rate_pct: riskWeightedFailRatePct,
    risk_weighted_accuracy_pct: Number((100 - riskWeightedFailRatePct).toFixed(1)),
    by_category: byCategoryRows,
    by_severity: bySeverityRows,
    fail_mistakes: failMistakes,
  };
}

function summaryToMarkdown(summary) {
  const lines = [];
  lines.push('# AgentSettlementBench (ChainPay scenarios) Model Run Summary');
  lines.push('');
  lines.push(`- Model: ${summary.model}`);
  lines.push(
    `- Coverage: ${summary.cases_evaluated}/${summary.benchmark_total_cases} (${summary.benchmark_coverage_pct.toFixed(
      1
    )}%)`
  );
  lines.push(`- Accuracy: ${summary.pass_rate_pct.toFixed(1)}%`);
  lines.push(`- Critical Fail Rate: ${summary.critical_fail_rate_pct.toFixed(1)}%`);
  lines.push(
    `- Risk-Weighted Fail Rate: ${summary.risk_weighted_fail_rate_pct.toFixed(1)}%`
  );
  lines.push('');
  lines.push(
    '- Formula: sum(weight x fail) / sum(weight), weights: low=1 medium=3 high=7 critical=10'
  );
  lines.push('');
  lines.push('| category | total | pass | fail | pass_rate |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const row of summary.by_category) {
    lines.push(
      `| ${row.key} | ${row.total} | ${row.pass} | ${row.fail} | ${row.pass_rate_pct.toFixed(
        1
      )}% |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const { benchmarkPath, groundTruthPath, rubricPath, evalDir } = resolvePaths();
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.input
    ? path.resolve(args.input)
    : path.join(evalDir, 'responses.jsonl');
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input not found: ${inputPath}`);
  }

  const benchmarkCases = loadBenchmarkCases(benchmarkPath);
  const groundTruthById = loadGroundTruthMap(groundTruthPath);
  const rubricCases = parseRubricMarkdown(rubricPath);
  validateGroundTruthCoverage(benchmarkCases, groundTruthById);
  validateRubricAlignment(benchmarkCases, rubricCases);
  validateGroundTruthRubricConsistency(rubricCases, groundTruthById);
  const rubricById = new Map(rubricCases.map((item) => [item.case_id, item]));

  const records = parseJsonl(inputPath);
  const seen = new Set();
  const scored = [];

  for (const record of records) {
    const caseId = String(record.case_id || '').trim();
    if (!caseId) {
      throw new Error('Each JSONL record must include case_id');
    }
    if (seen.has(caseId)) {
      throw new Error(`Duplicate case_id in responses: ${caseId}`);
    }
    seen.add(caseId);

    const rubric = rubricById.get(caseId);
    if (!rubric) {
      throw new Error(`Unknown case_id: ${caseId}`);
    }

    const expectedDecision = normalizeDecision(groundTruthById.get(caseId));
    if (!expectedDecision) {
      throw new Error(`Invalid ground truth decision for ${caseId}`);
    }

    const parsed = extractModelOutput(record.model_output);
    let passFail = 'FAIL';
    let mistakeType = 'format_violation';
    if (parsed.format_ok) {
      if (parsed.decision === expectedDecision) {
        passFail = 'PASS';
        mistakeType = 'none';
      } else {
        mistakeType = rubric.mistake_type;
      }
    }

    scored.push({
      case_id: caseId,
      title: rubric.title,
      category: rubric.category,
      severity: rubric.severity,
      expected_decision: expectedDecision,
      decision: parsed.decision || '',
      confidence: parsed.confidence || '',
      primary_reason: parsed.primary_reason || '',
      format_ok: parsed.format_ok ? '1' : '0',
      pass_fail: passFail,
      mistake_type: mistakeType,
      format_error: parsed.format_error || '',
    });
  }

  if (!args.allowPartial) {
    for (const rubric of rubricCases) {
      if (!seen.has(rubric.case_id)) {
        throw new Error(`Missing case in input: ${rubric.case_id}`);
      }
    }
  }

  scored.sort((a, b) => a.case_id.localeCompare(b.case_id));
  const outputDir = args.outdir ? path.resolve(args.outdir) : evalDir;
  fs.mkdirSync(outputDir, { recursive: true });

  const outCsvPath = path.join(outputDir, 'results_scored.csv');
  const outSummaryJson = path.join(outputDir, 'results_summary.json');
  const outSummaryMd = path.join(outputDir, 'results_summary.md');

  const rows = [
    [
      'case_id',
      'title',
      'category',
      'severity',
      'expected_decision',
      'decision',
      'confidence',
      'primary_reason',
      'format_ok',
      'pass_fail',
      'mistake_type',
      'format_error',
    ],
  ];
  for (const row of scored) {
    rows.push([
      row.case_id,
      row.title,
      row.category,
      row.severity,
      row.expected_decision,
      row.decision,
      row.confidence,
      row.primary_reason,
      row.format_ok,
      row.pass_fail,
      row.mistake_type,
      row.format_error,
    ]);
  }
  writeCsv(outCsvPath, rows);

  const modelName =
    args.model || path.basename(path.resolve(outputDir)) || 'unspecified';
  const summary = buildSummary(scored, benchmarkCases.length, modelName);
  fs.writeFileSync(outSummaryJson, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outSummaryMd, `${summaryToMarkdown(summary)}\n`, 'utf8');

  process.stdout.write(`Scored ${scored.length} cases from model outputs\n`);
  process.stdout.write(`Summary written to ${outSummaryMd}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
