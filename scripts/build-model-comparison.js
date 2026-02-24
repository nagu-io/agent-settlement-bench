const fs = require('fs');
const path = require('path');
const {
  loadBenchmarkCases,
  resolvePaths,
} = require('./lib/agentsettlementRubric');

function discoverRuns(runsDir) {
  if (!fs.existsSync(runsDir)) return [];
  const dirs = fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name);

  const runs = [];
  for (const dir of dirs) {
    const summaryPath = path.join(runsDir, dir, 'results_summary.json');
    if (!fs.existsSync(summaryPath)) continue;
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const metaPath = path.join(runsDir, dir, 'run_meta.json');
    const meta = fs.existsSync(metaPath)
      ? JSON.parse(fs.readFileSync(metaPath, 'utf8'))
      : {};
    runs.push({
      run_id: dir,
      ...summary,
      ...meta,
    });
  }
  return runs;
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    if (a.risk_weighted_fail_rate_pct !== b.risk_weighted_fail_rate_pct) {
      return a.risk_weighted_fail_rate_pct - b.risk_weighted_fail_rate_pct;
    }
    return b.pass_rate_pct - a.pass_rate_pct;
  });
}

function toMdTable(rows) {
  const lines = [];
  lines.push(
    '| Run ID | Model | Cases | Accuracy | Critical Fail Rate | Risk-Weighted Fail Rate |'
  );
  lines.push('|---|---|---:|---:|---:|---:|');
  for (const row of rows) {
    lines.push(
      `| ${row.run_id} | ${row.model} | ${row.cases_evaluated}/${row.benchmark_total_cases} | ${row.pass_rate_pct.toFixed(
        1
      )}% | ${row.critical_fail_rate_pct.toFixed(1)}% | ${row.risk_weighted_fail_rate_pct.toFixed(
        1
      )}% |`
    );
  }
  return lines.join('\n');
}

function isLeaderboardRun(run) {
  return (
    run.run_type === 'model_raw_output' &&
    run.valid_for_leaderboard === true &&
    run.benchmark_coverage_pct === 100
  );
}

function validateRunConsistency(runs, benchmarkTotalCases) {
  for (const run of runs) {
    if (run.run_type === 'manual_sample') {
      if (run.benchmark_total_cases !== benchmarkTotalCases) {
        throw new Error(
          `manual_sample "${run.run_id}" must use benchmark_total_cases=${benchmarkTotalCases}`
        );
      }
      const expectedCoverage = Number(
        ((run.cases_evaluated / benchmarkTotalCases) * 100).toFixed(1)
      );
      if (Math.abs(run.benchmark_coverage_pct - expectedCoverage) > 0.1) {
        throw new Error(
          `manual_sample "${run.run_id}" has invalid benchmark_coverage_pct (expected ${expectedCoverage}, found ${run.benchmark_coverage_pct})`
        );
      }
    }
  }
}

function main() {
  const { benchmarkPath, benchmarkRoot } = resolvePaths();
  const benchmarkTotalCases = loadBenchmarkCases(benchmarkPath).length;
  const evalDir = path.join(benchmarkRoot, 'eval');
  const runsDir = path.join(evalDir, 'runs');
  const runs = discoverRuns(runsDir);
  if (runs.length === 0) {
    throw new Error(`No run summaries found under ${runsDir}`);
  }
  validateRunConsistency(runs, benchmarkTotalCases);

  const leaderboard = sortRows(runs.filter((run) => isLeaderboardRun(run)));
  const reference = sortRows(runs.filter((run) => !isLeaderboardRun(run)));

  const outJsonPath = path.join(evalDir, 'model_comparison.json');
  const outMdPath = path.join(evalDir, 'model_comparison.md');

  const payload = {
    leaderboard,
    reference,
  };
  fs.writeFileSync(outJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const md = [];
  md.push('# Model Comparison');
  md.push('');
  md.push('Metrics:');
  md.push('- `Accuracy` = pass_rate_pct');
  md.push('- `Critical Fail Rate` = critical_fail_rate_pct');
  md.push(
    '- `Risk-Weighted Fail Rate` = sum(weight x fail) / sum(weight), weights: low=1 medium=3 high=7 critical=10'
  );
  md.push('');
  md.push('## Leaderboard (Valid Model Runs)');
  if (leaderboard.length === 0) {
    md.push('No valid full-coverage model runs yet.');
  } else {
    md.push(toMdTable(leaderboard));
  }
  md.push('');
  md.push('## Reference Runs (Not Leaderboard Eligible)');
  if (reference.length === 0) {
    md.push('None.');
  } else {
    md.push(toMdTable(reference));
  }
  md.push('');

  fs.writeFileSync(outMdPath, md.join('\n'), 'utf8');
  process.stdout.write(`Wrote ${outMdPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
