const fs = require('fs');
const path = require('path');
const {
  STANDARD_OUTPUT_CONTRACT,
  STANDARD_SYSTEM_PROMPT,
  buildPrompt,
  buildUserPrompt,
  loadGroundTruthMap,
  loadBenchmarkCases,
  parseRubricMarkdown,
  resolvePaths,
  validateGroundTruthCoverage,
  validateGroundTruthRubricConsistency,
  validateRubricAlignment,
} = require('./lib/agentsettlementRubric');

function main() {
  const { benchmarkPath, groundTruthPath, rubricPath, evalDir } = resolvePaths();
  const benchmarkCases = loadBenchmarkCases(benchmarkPath);
  const groundTruthById = loadGroundTruthMap(groundTruthPath);
  const rubricCases = parseRubricMarkdown(rubricPath);
  validateGroundTruthCoverage(benchmarkCases, groundTruthById);
  validateRubricAlignment(benchmarkCases, rubricCases);
  validateGroundTruthRubricConsistency(rubricCases, groundTruthById);

  fs.mkdirSync(evalDir, { recursive: true });

  const lines = benchmarkCases.map((item) => {
    return JSON.stringify({
      case_id: item.case_id,
      title: item.title,
      category: item.category,
      severity: item.severity,
      expected_decision: groundTruthById.get(item.case_id),
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
