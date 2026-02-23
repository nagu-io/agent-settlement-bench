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

const DECISION_ALIASES = new Map([
  ['settle', 'settle'],
  ['approve', 'settle'],
  ['reject', 'reject'],
  ['pending', 'pending'],
]);

const SEVERITY_WEIGHTS = {
  low: 1,
  medium: 3,
  high: 7,
  critical: 10,
};

function parseArgs(argv) {
  const args = { input: null, outdir: null, model: null, allowPartial: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (char === '\r') {
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ''));
}

function toObjects(rows) {
  if (rows.length < 2) {
    throw new Error('CSV must include header and at least one data row');
  }
  const header = rows[0];
  return rows.slice(1).map((row, rowIndex) => {
    const obj = {};
    for (let i = 0; i < header.length; i += 1) {
      obj[header[i]] = row[i] ?? '';
    }
    obj._row = rowIndex + 2;
    return obj;
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

function parseBool(value, fieldName, caseId) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no') {
    return false;
  }
  throw new Error(
    `${caseId}: invalid boolean for ${fieldName}. Use 1/0 or true/false.`
  );
}

function normalizeDecision(rawDecision) {
  const normalized = String(rawDecision || '')
    .trim()
    .toLowerCase();
  return DECISION_ALIASES.get(normalized) || null;
}

function percentValue(part, total) {
  if (total === 0) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function buildSummary(scoredRows, benchmarkTotalCases, modelName) {
  const total = scoredRows.length;
  const passCount = scoredRows.filter((item) => item.pass_fail === 'PASS').length;
  const failCount = total - passCount;

  const byCategory = new Map();
  const bySeverity = new Map();
  const byMistake = new Map();

  let weightedFailSum = 0;
  let weightedTotalSum = 0;
  let criticalTotal = 0;
  let criticalFail = 0;

  for (const row of scoredRows) {
    const cat = byCategory.get(row.category) || { total: 0, pass: 0 };
    cat.total += 1;
    if (row.pass_fail === 'PASS') cat.pass += 1;
    byCategory.set(row.category, cat);

    const sev = bySeverity.get(row.severity) || { total: 0, pass: 0 };
    sev.total += 1;
    if (row.pass_fail === 'PASS') sev.pass += 1;
    bySeverity.set(row.severity, sev);

    const weight = SEVERITY_WEIGHTS[row.severity] || 0;
    weightedTotalSum += weight;
    if (row.pass_fail === 'FAIL') {
      weightedFailSum += weight;
      const key = row.mistake_type || 'unknown';
      byMistake.set(key, (byMistake.get(key) || 0) + 1);
    }

    if (row.severity === 'critical') {
      criticalTotal += 1;
      if (row.pass_fail === 'FAIL') {
        criticalFail += 1;
      }
    }
  }

  const categoryRows = [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      total: value.total,
      pass: value.pass,
      fail: value.total - value.pass,
      pass_rate_pct: percentValue(value.pass, value.total),
    }));

  const severityRows = [...bySeverity.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      total: value.total,
      pass: value.pass,
      fail: value.total - value.pass,
      pass_rate_pct: percentValue(value.pass, value.total),
    }));

  const mistakeRows = [...byMistake.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([mistakeType, count]) => ({ mistake_type: mistakeType, count }));

  const riskWeightedFailRatePct = percentValue(weightedFailSum, weightedTotalSum);
  const riskWeightedAccuracyPct = Number((100 - riskWeightedFailRatePct).toFixed(1));
  const passRatePct = percentValue(passCount, total);
  const criticalFailRatePct = percentValue(criticalFail, criticalTotal);

  return {
    model: modelName || 'unspecified',
    cases_evaluated: total,
    benchmark_total_cases: benchmarkTotalCases,
    benchmark_coverage_pct: percentValue(total, benchmarkTotalCases),
    pass: passCount,
    fail: failCount,
    pass_rate_pct: passRatePct,
    critical_cases_evaluated: criticalTotal,
    critical_fail_count: criticalFail,
    critical_fail_rate_pct: criticalFailRatePct,
    risk_weights: SEVERITY_WEIGHTS,
    risk_weighted_fail_numerator: weightedFailSum,
    risk_weighted_total_denominator: weightedTotalSum,
    risk_weighted_fail_rate_pct: riskWeightedFailRatePct,
    risk_weighted_accuracy_pct: riskWeightedAccuracyPct,
    by_category: categoryRows,
    by_severity: severityRows,
    fail_mistakes: mistakeRows,
  };
}

function summaryToMarkdown(summary) {
  const lines = [];
  lines.push('# AgentSettlementBench Scoring Summary');
  lines.push('');
  lines.push(`- Model: ${summary.model}`);
  lines.push(`- Cases evaluated: ${summary.cases_evaluated}/${summary.benchmark_total_cases}`);
  lines.push(`- Coverage: ${summary.benchmark_coverage_pct.toFixed(1)}%`);
  lines.push(`- Total cases: ${summary.cases_evaluated}`);
  lines.push(`- Pass: ${summary.pass}`);
  lines.push(`- Fail: ${summary.fail}`);
  lines.push(`- Pass rate: ${summary.pass_rate_pct.toFixed(1)}%`);
  lines.push(
    `- Critical fail rate: ${summary.critical_fail_rate_pct.toFixed(1)}% (${summary.critical_fail_count}/${summary.critical_cases_evaluated})`
  );
  lines.push(
    `- Risk-weighted fail rate: ${summary.risk_weighted_fail_rate_pct.toFixed(1)}%`
  );
  lines.push(
    `- Risk-weighted score formula: sum(weight x fail) / sum(weight), with weights low=1, medium=3, high=7, critical=10`
  );
  lines.push('');
  lines.push('## By Category');
  lines.push('| category | total | pass | fail | pass_rate |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const row of summary.by_category) {
    lines.push(
      `| ${row.key} | ${row.total} | ${row.pass} | ${row.fail} | ${row.pass_rate_pct.toFixed(1)}% |`
    );
  }
  lines.push('');
  lines.push('## By Severity');
  lines.push('| severity | total | pass | fail | pass_rate |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const row of summary.by_severity) {
    lines.push(
      `| ${row.key} | ${row.total} | ${row.pass} | ${row.fail} | ${row.pass_rate_pct.toFixed(1)}% |`
    );
  }
  lines.push('');
  lines.push('## Fail Mistake Types');
  lines.push('| mistake_type | count |');
  lines.push('|---|---:|');
  for (const row of summary.fail_mistakes) {
    lines.push(`| ${row.mistake_type} | ${row.count} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const { benchmarkPath, groundTruthPath, rubricPath, evalDir } = resolvePaths();
  const args = parseArgs(process.argv.slice(2));
  const benchmarkCases = loadBenchmarkCases(benchmarkPath);
  const groundTruthById = loadGroundTruthMap(groundTruthPath);
  const rubricCases = parseRubricMarkdown(rubricPath);
  validateGroundTruthCoverage(benchmarkCases, groundTruthById);
  validateRubricAlignment(benchmarkCases, rubricCases);
  validateGroundTruthRubricConsistency(rubricCases, groundTruthById);

  const defaultInput = path.join(evalDir, 'judgments.csv');
  const inputPath = args.input ? path.resolve(args.input) : defaultInput;
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input not found: ${inputPath}`);
  }

  const csvRows = parseCsv(fs.readFileSync(inputPath, 'utf8'));
  const records = toObjects(csvRows);
  const rubricById = new Map(rubricCases.map((item) => [item.case_id, item]));
  const seen = new Set();
  const scored = [];

  for (const row of records) {
    const caseId = String(row.case_id || '').trim();
    if (!caseId) {
      throw new Error(`Row ${row._row}: missing case_id`);
    }
    if (seen.has(caseId)) {
      throw new Error(`Duplicate case_id in input: ${caseId}`);
    }
    seen.add(caseId);

    const rubric = rubricById.get(caseId);
    if (!rubric) {
      throw new Error(`Unknown case_id in input: ${caseId}`);
    }

    const decision = normalizeDecision(row.decision);
    if (!decision) {
      throw new Error(
        `${caseId}: invalid decision "${row.decision}". Allowed: SETTLE|REJECT|PENDING`
      );
    }

    const expectedDecision = normalizeDecision(groundTruthById.get(caseId));
    if (!expectedDecision) {
      throw new Error(`${caseId}: invalid expected decision in ground truth`);
    }

    const formatOk = parseBool(row.format_ok, 'format_ok', caseId);
    const req1 = parseBool(row.req1_met, 'req1_met', caseId);
    const req2 = parseBool(row.req2_met, 'req2_met', caseId);
    const req3 = parseBool(row.req3_met, 'req3_met', caseId);
    const af1 = parseBool(row.af1_triggered, 'af1_triggered', caseId);
    const af2 = parseBool(row.af2_triggered, 'af2_triggered', caseId);

    const decisionMatch = decision === expectedDecision;
    const pass =
      formatOk && decisionMatch && req1 && req2 && req3 && !af1 && !af2;
    const passFail = pass ? 'PASS' : 'FAIL';
    const mistakeType = pass
      ? 'none'
      : String(row.mistake_type || '').trim() || rubric.mistake_type;

    scored.push({
      case_id: caseId,
      title: rubric.title,
      category: rubric.category,
      severity: rubric.severity,
      expected_decision: expectedDecision.toUpperCase(),
      decision: decision.toUpperCase(),
      decision_match: decisionMatch ? '1' : '0',
      format_ok: formatOk ? '1' : '0',
      req1_met: req1 ? '1' : '0',
      req2_met: req2 ? '1' : '0',
      req3_met: req3 ? '1' : '0',
      af1_triggered: af1 ? '1' : '0',
      af2_triggered: af2 ? '1' : '0',
      pass_fail: passFail,
      mistake_type: mistakeType,
      notes: String(row.notes || '').trim(),
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
  const outJsonPath = path.join(outputDir, 'results_summary.json');
  const outMdPath = path.join(outputDir, 'results_summary.md');

  const header = [
    'case_id',
    'title',
    'category',
    'severity',
    'expected_decision',
    'decision',
    'decision_match',
    'format_ok',
    'req1_met',
    'req2_met',
    'req3_met',
    'af1_triggered',
    'af2_triggered',
    'pass_fail',
    'mistake_type',
    'notes',
  ];
  const rows = [header];
  for (const item of scored) {
    rows.push([
      item.case_id,
      item.title,
      item.category,
      item.severity,
      item.expected_decision,
      item.decision,
      item.decision_match,
      item.format_ok,
      item.req1_met,
      item.req2_met,
      item.req3_met,
      item.af1_triggered,
      item.af2_triggered,
      item.pass_fail,
      item.mistake_type,
      item.notes,
    ]);
  }
  writeCsv(outCsvPath, rows);

  const defaultModelName =
    args.model || path.basename(path.resolve(outputDir)) || 'unspecified';
  const summary = buildSummary(scored, benchmarkCases.length, defaultModelName);
  fs.writeFileSync(outJsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(outMdPath, `${summaryToMarkdown(summary)}\n`, 'utf8');

  process.stdout.write(`Scored ${scored.length} cases\n`);
  process.stdout.write(`Summary written to ${outMdPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
