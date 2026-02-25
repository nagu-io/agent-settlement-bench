# Contributing

1. Fork this repository.
2. Run the benchmark locally.
3. Include your `responses.jsonl` and `results_summary.json`.
4. Open a PR with your run details.

## Run Locally

```powershell
npm install
npm run benchmark -- -- --model <MODEL_NAME>
```

Examples:

```powershell
npm run benchmark -- -- --model openai --key <OPENAI_API_KEY>
npm run benchmark -- -- --model gemini --key <GEMINI_API_KEY>
npm run benchmark -- -- --model local --api-model qwen2.5:7b --base-url http://localhost:11434/v1/chat/completions
```

## Valid Run Rules

- Must include raw model outputs in JSONL format (`case_id`, `model_output`).
- Must include model name and mode used in the submission notes.
- Must not modify benchmark cases, rubric, or ground truth files.
- Must use the canonical scorer: `scripts/score-model-responses.js`.
- `results_summary.json` must contain `model`, `mode`, and `timestamp`.

## Submission Notes Template

- Model:
- Quantization:
- Prompt mode (strict/guided/reasoning):
- Accuracy:
- Critical fail rate:
