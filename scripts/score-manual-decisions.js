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
const {
  buildSummaryFromDecisions,
  loadDecisions,
  writeCsv,
} = require('./lib/manualRunScoring');

function parseArgs(argv) {
  const args = {
    input: null,
    outdir: null,
    model: null,
    source: null,
    date: null,
    coverageBasis: null,
    notes: null,
  };

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
    if (arg === '--source' && i + 1 < argv.length) {
      args.source = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--date' && i + 1 < argv.length) {
      args.date = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--coverage-basis' && i + 1 < argv.length) {
      args.coverageBasis = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--notes' && i + 1 < argv.length) {
      args.notes = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return args;
}

function normalizeDate(rawDate) {
  if (rawDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      throw new Error(`Invalid --date "${rawDate}". Expected YYYY-MM-DD.`);
    }
    return rawDate;
  }
  return new Date().toISOString().slice(0, 10);
}

function markdownFromSummary(summary, scoredRows) {
  const lines = [];
  lines.push(`# ${summary.model}`);
  lines.push('');
  lines.push(`- Coverage: ${summary.cases_evaluated}/${summary.benchmark_total_cases} (${summary.benchmark_coverage_pct.toFixed(1)}%)`);
  lines.push(`- Accuracy: ${summary.pass_rate_pct.toFixed(1)}%`);
  lines.push(`- Critical Fail Rate: ${summary.critical_fail_rate_pct.toFixed(1)}%`);
  lines.push(`- Risk-Weighted Fail Rate: ${summary.risk_weighted_fail_rate_pct.toFixed(1)}%`);
  if (summary.notes) {
    lines.push(`- Notes: ${summary.notes}`);
  }
  lines.push('');
  lines.push('| case_id | expected | decision | pass_fail | mistake_type |');
  lines.push('|---|---|---|---|---|');
  for (const row of scoredRows) {
    lines.push(
      `| ${row.case_id} | ${row.expected_decision} | ${row.decision} | ${row.pass_fail} | ${row.mistake_type} |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    throw new Error('Missing --input <path-to-decisions.json|csv>');
  }
  if (!args.outdir) {
    throw new Error('Missing --outdir <eval/runs/run_id>');
  }
  if (!args.model) {
    throw new Error('Missing --model <model-name>');
  }
  if (!args.source) {
    throw new Error('Missing --source <source-description>');
  }

  const { benchmarkPath, groundTruthPath, rubricPath } = resolvePaths();
  const benchmarkCases = loadBenchmarkCases(benchmarkPath);
  const groundTruthById = loadGroundTruthMap(groundTruthPath);
  const rubricCases = parseRubricMarkdown(rubricPath);
  validateGroundTruthCoverage(benchmarkCases, groundTruthById);
  validateRubricAlignment(benchmarkCases, rubricCases);
  validateGroundTruthRubricConsistency(rubricCases, groundTruthById);
  const rubricById = new Map(rubricCases.map((item) => [item.case_id, item]));

  const inputPath = path.resolve(args.input);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input not found: ${inputPath}`);
  }
  const decisions = loadDecisions(inputPath);

  const { scoredRows, summary } = buildSummaryFromDecisions({
    decisions,
    benchmarkCases,
    groundTruthById,
    rubricById,
    model: args.model,
    runType: 'manual_sample',
    validForLeaderboard: false,
  });

  summary.schema_version = 1;
  summary.coverage_basis = args.coverageBasis || 'manual_subset';
  summary.source = args.source;
  summary.date = normalizeDate(args.date);
  summary.is_estimated = false;
  summary.decisions_file = path.basename(inputPath);
  summary.notes = args.notes ? String(args.notes) : '';

  const outputDir = path.resolve(args.outdir);
  fs.mkdirSync(outputDir, { recursive: true });

  const resultsScoredPath = path.join(outputDir, 'results_scored.csv');
  const resultsSummaryJson = path.join(outputDir, 'results_summary.json');
  const resultsSummaryMd = path.join(outputDir, 'results_summary.md');
  const runMetaPath = path.join(outputDir, 'run_meta.json');

  const scoredCsvRows = [
    [
      'case_id',
      'title',
      'category',
      'severity',
      'expected_decision',
      'decision',
      'pass_fail',
      'mistake_type',
      'notes',
    ],
  ];
  for (const row of scoredRows) {
    scoredCsvRows.push([
      row.case_id,
      row.title,
      row.category,
      row.severity,
      row.expected_decision,
      row.decision,
      row.pass_fail,
      row.mistake_type,
      row.notes,
    ]);
  }
  writeCsv(resultsScoredPath, scoredCsvRows);

  fs.writeFileSync(resultsSummaryJson, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(resultsSummaryMd, `${markdownFromSummary(summary, scoredRows)}`, 'utf8');

  const runMeta = {
    schema_version: 1,
    run_type: 'manual_sample',
    valid_for_leaderboard: false,
    coverage_basis: summary.coverage_basis,
    source: summary.source,
    date: summary.date,
    is_estimated: false,
    decisions_file: summary.decisions_file,
    notes: summary.notes || '',
  };
  fs.writeFileSync(runMetaPath, `${JSON.stringify(runMeta, null, 2)}\n`, 'utf8');

  process.stdout.write(`Scored ${scoredRows.length} manual decisions\n`);
  process.stdout.write(`Wrote ${resultsSummaryJson}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
