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

function main() {
  const { benchmarkPath, groundTruthPath, rubricPath, evalDir } = resolvePaths();
  const benchmarkCases = loadBenchmarkCases(benchmarkPath);
  const groundTruthById = loadGroundTruthMap(groundTruthPath);
  const rubricCases = parseRubricMarkdown(rubricPath);
  validateGroundTruthCoverage(benchmarkCases, groundTruthById);
  validateRubricAlignment(benchmarkCases, rubricCases);
  validateGroundTruthRubricConsistency(rubricCases, groundTruthById);
  fs.mkdirSync(evalDir, { recursive: true });

  const header = [
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
  ];

  const rows = [header];
  for (const item of benchmarkCases) {
    rows.push([
      item.case_id,
      item.title,
      item.category,
      item.severity,
      groundTruthById.get(item.case_id),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
  }

  const outPath = path.join(evalDir, 'judgment_template.csv');
  fs.writeFileSync(outPath, `${toCsv(rows)}\n`, 'utf8');
  process.stdout.write(`Generated judgment template at ${outPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
