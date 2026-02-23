const fs = require('fs');
const path = require('path');
const {
  STANDARD_OUTPUT_CONTRACT,
  STANDARD_SYSTEM_PROMPT,
  buildPrompt,
  buildUserPrompt,
  loadBenchmarkCases,
  parseRubricMarkdown,
  resolvePaths,
  validateRubricAlignment,
} = require('./lib/agentsettlementRubric');

function main() {
  const { benchmarkPath, rubricPath, evalDir } = resolvePaths();
  const benchmarkCases = loadBenchmarkCases(benchmarkPath);
  const rubricCases = parseRubricMarkdown(rubricPath);
  validateRubricAlignment(benchmarkCases, rubricCases);

  fs.mkdirSync(evalDir, { recursive: true });
  const rubricById = new Map(rubricCases.map((item) => [item.case_id, item]));

  const lines = benchmarkCases.map((item) => {
    const rule = rubricById.get(item.case_id);
    return JSON.stringify({
      case_id: item.case_id,
      title: item.title,
      category: item.category,
      severity: item.severity,
      expected_decision: String(rule.expected_decision || '').toUpperCase(),
      system_prompt: STANDARD_SYSTEM_PROMPT,
      user_prompt: buildUserPrompt(item),
      output_contract: STANDARD_OUTPUT_CONTRACT,
      prompt: buildPrompt(item),
    });
  });

  const outPath = path.join(evalDir, 'prompts.jsonl');
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
  process.stdout.write(`Generated ${lines.length} prompts at ${outPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
