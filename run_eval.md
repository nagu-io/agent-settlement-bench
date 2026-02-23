# Run Evaluation

This protocol avoids self-evaluation bias.

Valid benchmark pipeline:
- `Scenario -> Model response -> Decision extraction -> Rubric compare -> PASS/FAIL`

Invalid pipeline:
- `Rubric logic -> Decision -> Rubric compare`

## 1) Generate Standard Inputs

```powershell
node ai_benchmark/scripts/export-benchmark-rubric-json.js
node ai_benchmark/scripts/generate-benchmark-prompts.js
node ai_benchmark/scripts/generate-response-template.js
```

Outputs:
- `ai_benchmark/eval/prompts.jsonl`
- `ai_benchmark/eval/responses_template.jsonl`
- `ai_benchmark/rubric/agentsettlement_rules.json`

## 2) Fixed Prompt Contract (All Models)

Use prompt fields from each `prompts.jsonl` row:
- `system_prompt`
- `user_prompt`
- `output_contract`

Required model output format:

```text
DECISION: SETTLE | REJECT | PENDING
CONFIDENCE: LOW | MEDIUM | HIGH
PRIMARY_REASON: one short sentence
```

## 3) Collect Raw Model Outputs

Copy template and fill `model_output` from the model, case by case:

```powershell
Copy-Item ai_benchmark/eval/responses_template.jsonl ai_benchmark/eval/responses.jsonl
```

Each JSONL row must include:
- `case_id`
- `model_output`

## 4) Score Raw Outputs (Leaderboard-Eligible)

```powershell
node ai_benchmark/scripts/score-model-responses.js --input ai_benchmark/eval/responses.jsonl --outdir ai_benchmark/eval/runs/<run_id> --model <MODEL_NAME>
```

Outputs:
- `ai_benchmark/eval/runs/<run_id>/results_scored.csv`
- `ai_benchmark/eval/runs/<run_id>/results_summary.json`
- `ai_benchmark/eval/runs/<run_id>/results_summary.md`

## 5) Risk-Weighted Metric

Weights:
- `low=1`
- `medium=3`
- `high=7`
- `critical=10`

Formula:

```text
risk_weighted_fail_rate = sum(weight x fail) / sum(weight)
```

## 6) Build Comparison Table

```powershell
node ai_benchmark/scripts/build-model-comparison.js
```

Generated:
- `ai_benchmark/eval/model_comparison.md`
- `ai_benchmark/eval/model_comparison.json`

`build-model-comparison` places only `run_type=model_raw_output` and full coverage runs on the leaderboard.

## 7) Reference Runs

Non-leaderboard runs (baselines, manual samples, self-checks) are tracked in:
- `ai_benchmark/eval/runs/README.md`
