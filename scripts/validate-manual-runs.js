const fs = require('fs');
const path = require('path');
const {
  loadBenchmarkCases,
  resolvePaths,
} = require('./lib/agentsettlementRubric');

const REQUIRED_FIELDS = [
  'schema_version',
  'model',
  'run_type',
  'valid_for_leaderboard',
  'coverage_basis',
  'source',
  'date',
  'is_estimated',
  'cases_evaluated',
  'benchmark_total_cases',
  'benchmark_coverage_pct',
  'pass',
  'fail',
  'pass_rate_pct',
  'critical_cases_evaluated',
  'critical_fail_count',
  'critical_fail_rate_pct',
  'risk_weighted_fail_rate_pct',
  'risk_weighted_accuracy_pct',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function asNumber(value, field, runId) {
  const n = Number(value);
  assert(Number.isFinite(n), `${runId}: ${field} must be numeric`);
  return n;
}

function main() {
  const { benchmarkRoot, benchmarkPath } = resolvePaths();
  const benchmarkCases = loadBenchmarkCases(benchmarkPath);
  const benchmarkTotalCases = benchmarkCases.length;

  const schemaPath = path.join(benchmarkRoot, 'eval', 'runs', 'manual_run_schema.json');
  assert(fs.existsSync(schemaPath), `Missing schema file: ${schemaPath}`);
  JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  const runsDir = path.join(benchmarkRoot, 'eval', 'runs');
  const dirs = fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  let validated = 0;
  for (const runId of dirs) {
    const runDir = path.join(runsDir, runId);
    const summaryPath = path.join(runDir, 'results_summary.json');
    if (!fs.existsSync(summaryPath)) continue;

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const metaPath = path.join(runDir, 'run_meta.json');
    const meta = fs.existsSync(metaPath)
      ? JSON.parse(fs.readFileSync(metaPath, 'utf8'))
      : {};

    const merged = {
      ...summary,
      ...meta,
    };

    if (merged.run_type !== 'manual_sample') {
      continue;
    }

    for (const field of REQUIRED_FIELDS) {
      assert(
        Object.prototype.hasOwnProperty.call(merged, field),
        `${runId}: missing required field "${field}"`
      );
    }

    assert(merged.schema_version === 1, `${runId}: schema_version must be 1`);
    assert(
      merged.valid_for_leaderboard === false,
      `${runId}: valid_for_leaderboard must be false for manual_sample`
    );
    assert(
      /^\d{4}-\d{2}-\d{2}$/.test(String(merged.date || '')),
      `${runId}: date must be YYYY-MM-DD`
    );

    const casesEvaluated = asNumber(merged.cases_evaluated, 'cases_evaluated', runId);
    const benchmarkTotal = asNumber(
      merged.benchmark_total_cases,
      'benchmark_total_cases',
      runId
    );
    const coveragePct = asNumber(
      merged.benchmark_coverage_pct,
      'benchmark_coverage_pct',
      runId
    );
    const passCount = asNumber(merged.pass, 'pass', runId);
    const failCount = asNumber(merged.fail, 'fail', runId);
    const passRatePct = asNumber(merged.pass_rate_pct, 'pass_rate_pct', runId);
    const criticalCases = asNumber(
      merged.critical_cases_evaluated,
      'critical_cases_evaluated',
      runId
    );
    const criticalFail = asNumber(merged.critical_fail_count, 'critical_fail_count', runId);
    const criticalFailRate = asNumber(
      merged.critical_fail_rate_pct,
      'critical_fail_rate_pct',
      runId
    );
    const rwFailRate = asNumber(
      merged.risk_weighted_fail_rate_pct,
      'risk_weighted_fail_rate_pct',
      runId
    );
    const rwAccuracy = asNumber(
      merged.risk_weighted_accuracy_pct,
      'risk_weighted_accuracy_pct',
      runId
    );

    assert(
      benchmarkTotal === benchmarkTotalCases,
      `${runId}: benchmark_total_cases must equal canonical benchmark size (${benchmarkTotalCases})`
    );
    assert(casesEvaluated >= 1, `${runId}: cases_evaluated must be >= 1`);
    assert(
      casesEvaluated <= benchmarkTotalCases,
      `${runId}: cases_evaluated must be <= ${benchmarkTotalCases}`
    );
    assert(passCount + failCount === casesEvaluated, `${runId}: pass + fail mismatch`);

    const expectedCoverage = Number(
      ((casesEvaluated / benchmarkTotalCases) * 100).toFixed(1)
    );
    assert(
      Math.abs(coveragePct - expectedCoverage) <= 0.1,
      `${runId}: benchmark_coverage_pct mismatch (expected ${expectedCoverage}, found ${coveragePct})`
    );

    const expectedPassRate = Number(((passCount / casesEvaluated) * 100).toFixed(1));
    assert(
      Math.abs(passRatePct - expectedPassRate) <= 0.1,
      `${runId}: pass_rate_pct mismatch (expected ${expectedPassRate}, found ${passRatePct})`
    );

    if (criticalCases > 0) {
      const expectedCriticalRate = Number(
        ((criticalFail / criticalCases) * 100).toFixed(1)
      );
      assert(
        Math.abs(criticalFailRate - expectedCriticalRate) <= 0.1,
        `${runId}: critical_fail_rate_pct mismatch (expected ${expectedCriticalRate}, found ${criticalFailRate})`
      );
    }

    assert(rwFailRate >= 0 && rwFailRate <= 100, `${runId}: invalid risk weighted fail rate`);
    assert(rwAccuracy >= 0 && rwAccuracy <= 100, `${runId}: invalid risk weighted accuracy`);
    assert(
      Math.abs((100 - rwFailRate) - rwAccuracy) <= 0.2,
      `${runId}: risk weighted accuracy should equal 100 - fail rate`
    );

    if (merged.is_estimated === false) {
      assert(
        typeof merged.decisions_file === 'string' && merged.decisions_file.length > 0,
        `${runId}: non-estimated run must include decisions_file`
      );
      const decisionsPath = path.join(runDir, merged.decisions_file);
      assert(fs.existsSync(decisionsPath), `${runId}: decisions_file not found: ${decisionsPath}`);
    }

    validated += 1;
  }

  process.stdout.write(`Validated ${validated} manual_sample run summaries\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
