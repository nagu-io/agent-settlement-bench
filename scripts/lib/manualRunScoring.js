const fs = require('fs');
const path = require('path');
const { normalizeDecision } = require('./agentsettlementRubric');

const SEVERITY_WEIGHTS = {
  low: 1,
  medium: 3,
  high: 7,
  critical: 10,
};

function percentValue(part, total) {
  if (total === 0) return 0;
  return Number(((part / total) * 100).toFixed(1));
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
    throw new Error('CSV must include a header and at least one row');
  }
  const header = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    for (let i = 0; i < header.length; i += 1) {
      obj[String(header[i] || '').trim()] = row[i] ?? '';
    }
    return obj;
  });
}

function parseDecisionArray(data) {
  if (!Array.isArray(data)) {
    throw new Error('Decision JSON must be an array or object map');
  }
  return data.map((item) => ({
    case_id: String(item.case_id || '').trim(),
    decision: String(item.decision || '').trim(),
    notes: String(item.notes || '').trim(),
  }));
}

function parseDecisionMap(data) {
  return Object.keys(data)
    .sort()
    .map((caseId) => ({
      case_id: String(caseId).trim(),
      decision: String(data[caseId] || '').trim(),
      notes: '',
    }));
}

function loadDecisions(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  const raw = fs.readFileSync(inputPath, 'utf8');

  if (ext === '.csv') {
    const rows = parseCsv(raw);
    const objects = toObjects(rows);
    return objects.map((item) => ({
      case_id: String(item.case_id || '').trim(),
      decision: String(item.decision || '').trim(),
      notes: String(item.notes || '').trim(),
    }));
  }

  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return parseDecisionArray(parsed);
  }
  if (parsed && typeof parsed === 'object') {
    return parseDecisionMap(parsed);
  }
  throw new Error(`Unsupported decision format: ${inputPath}`);
}

function buildSummaryFromDecisions({
  decisions,
  benchmarkCases,
  groundTruthById,
  rubricById,
  model,
  runType = 'manual_sample',
  validForLeaderboard = false,
}) {
  const benchmarkCaseIds = new Set(benchmarkCases.map((item) => item.case_id));
  const seen = new Set();
  const scoredRows = [];

  const byCategory = new Map();
  const bySeverity = new Map();
  const byMistake = new Map();
  let weightedFailSum = 0;
  let weightedTotalSum = 0;
  let criticalTotal = 0;
  let criticalFail = 0;

  for (const record of decisions) {
    const caseId = String(record.case_id || '').trim();
    if (!caseId) {
      throw new Error('Each decision row must include case_id');
    }
    if (seen.has(caseId)) {
      throw new Error(`Duplicate case_id in decisions: ${caseId}`);
    }
    seen.add(caseId);

    if (!benchmarkCaseIds.has(caseId)) {
      throw new Error(`Unknown case_id in decisions: ${caseId}`);
    }

    const rubric = rubricById.get(caseId);
    if (!rubric) {
      throw new Error(`Missing rubric metadata for ${caseId}`);
    }

    const expected = groundTruthById.get(caseId);
    if (!expected) {
      throw new Error(`Missing ground truth for ${caseId}`);
    }

    const decision = normalizeDecision(record.decision);
    if (!decision) {
      throw new Error(
        `${caseId}: invalid decision "${record.decision}". Allowed: SETTLE|REJECT|PENDING`
      );
    }

    const pass = decision === expected;
    const weight = SEVERITY_WEIGHTS[rubric.severity] || 0;
    weightedTotalSum += weight;
    if (!pass) {
      weightedFailSum += weight;
      byMistake.set(rubric.mistake_type, (byMistake.get(rubric.mistake_type) || 0) + 1);
    }
    if (rubric.severity === 'critical') {
      criticalTotal += 1;
      if (!pass) {
        criticalFail += 1;
      }
    }

    const category = byCategory.get(rubric.category) || { total: 0, pass: 0 };
    category.total += 1;
    if (pass) category.pass += 1;
    byCategory.set(rubric.category, category);

    const severity = bySeverity.get(rubric.severity) || { total: 0, pass: 0 };
    severity.total += 1;
    if (pass) severity.pass += 1;
    bySeverity.set(rubric.severity, severity);

    scoredRows.push({
      case_id: caseId,
      title: rubric.title,
      category: rubric.category,
      severity: rubric.severity,
      expected_decision: expected,
      decision,
      pass_fail: pass ? 'PASS' : 'FAIL',
      mistake_type: pass ? 'none' : rubric.mistake_type,
      notes: String(record.notes || '').trim(),
    });
  }

  scoredRows.sort((a, b) => a.case_id.localeCompare(b.case_id));
  const casesEvaluated = scoredRows.length;
  const benchmarkTotal = benchmarkCases.length;
  const passCount = scoredRows.filter((row) => row.pass_fail === 'PASS').length;
  const failCount = casesEvaluated - passCount;
  const riskWeightedFailRate = percentValue(weightedFailSum, weightedTotalSum);

  const summary = {
    model: model || 'unspecified',
    run_type: runType,
    valid_for_leaderboard: validForLeaderboard,
    cases_evaluated: casesEvaluated,
    benchmark_total_cases: benchmarkTotal,
    benchmark_coverage_pct: percentValue(casesEvaluated, benchmarkTotal),
    pass: passCount,
    fail: failCount,
    pass_rate_pct: percentValue(passCount, casesEvaluated),
    critical_cases_evaluated: criticalTotal,
    critical_fail_count: criticalFail,
    critical_fail_rate_pct: percentValue(criticalFail, criticalTotal),
    risk_weights: SEVERITY_WEIGHTS,
    risk_weighted_fail_numerator: weightedFailSum,
    risk_weighted_total_denominator: weightedTotalSum,
    risk_weighted_fail_rate_pct: riskWeightedFailRate,
    risk_weighted_accuracy_pct: Number((100 - riskWeightedFailRate).toFixed(1)),
    by_category: [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({
        key,
        total: value.total,
        pass: value.pass,
        fail: value.total - value.pass,
        pass_rate_pct: percentValue(value.pass, value.total),
      })),
    by_severity: [...bySeverity.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({
        key,
        total: value.total,
        pass: value.pass,
        fail: value.total - value.pass,
        pass_rate_pct: percentValue(value.pass, value.total),
      })),
    fail_mistakes: [...byMistake.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([mistakeType, count]) => ({
        mistake_type: mistakeType,
        count,
      })),
  };

  return {
    scoredRows,
    summary,
  };
}

module.exports = {
  buildSummaryFromDecisions,
  loadDecisions,
  writeCsv,
};
