const fs = require('fs');
const path = require('path');
const {
  parseRubricMarkdown,
  resolvePaths,
} = require('./lib/agentsettlementRubric');

function main() {
  const { rubricPath, benchmarkRoot } = resolvePaths();
  const rules = parseRubricMarkdown(rubricPath);
  const outPath = path.join(benchmarkRoot, 'rubric', 'agentsettlement_rules.json');
  fs.writeFileSync(outPath, `${JSON.stringify(rules, null, 2)}\n`, 'utf8');
  process.stdout.write(`Exported rubric JSON to ${outPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
