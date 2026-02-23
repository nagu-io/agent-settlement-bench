const fs = require('fs');
const path = require('path');
const { resolvePaths } = require('./lib/agentsettlementRubric');

function main() {
  const { evalDir } = resolvePaths();
  const promptsPath = path.join(evalDir, 'prompts.jsonl');
  if (!fs.existsSync(promptsPath)) {
    throw new Error(
      `Missing prompts file at ${promptsPath}. Run generate-benchmark-prompts first.`
    );
  }

  const lines = fs
    .readFileSync(promptsPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));

  const templateLines = lines.map((item) =>
    JSON.stringify({
      case_id: item.case_id,
      title: item.title,
      system_prompt: item.system_prompt,
      user_prompt: item.user_prompt,
      output_contract: item.output_contract,
      model_output: '',
    })
  );

  const outPath = path.join(evalDir, 'responses_template.jsonl');
  fs.writeFileSync(outPath, `${templateLines.join('\n')}\n`, 'utf8');
  process.stdout.write(`Generated response template at ${outPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
