const fs = require('fs');
const path = require('path');
const {
  loadBenchmarkCases,
  parseRubricMarkdown,
  resolvePaths,
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
  const { benchmarkPath, rubricPath, evalDir } = resolvePaths();
  const benchmarkCases = loadBenchmarkCases(benchmarkPath);
  const rubricCases = parseRubricMarkdown(rubricPath);
  validateRubricAlignment(benchmarkCases, rubricCases);
  fs.mkdirSync(evalDir, { recursive: true });

  const rubricById = new Map(rubricCases.map((item) => [item.case_id, item]));
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
    const rule = rubricById.get(item.case_id);
    rows.push([
      item.case_id,
      item.title,
      item.category,
      item.severity,
      String(rule.expected_decision || '').toUpperCase(),
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
