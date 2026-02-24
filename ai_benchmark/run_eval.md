# Run Evaluation

This protocol avoids self-evaluation bias.

Valid benchmark pipeline:
- `Scenario -> Model response -> Decision extraction -> Rubric compare -> PASS/FAIL`

Invalid pipeline:
- `Rubric logic -> Decision -> Rubric compare`

## 1) Generate Standard Inputs

```powershell
node scripts/export-benchmark-rubric-json.js
node scripts/generate-benchmark-prompts.js
node scripts/generate-response-template.js
```

Outputs:
- `eval/prompts.jsonl`
- `eval/responses_template.jsonl`
- `rubric/agentsettlement_rules.json`
- `ai_benchmark/ground_truth.json` (canonical expected decisions)

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
Copy-Item eval/responses_template.jsonl eval/responses.jsonl
```

Each JSONL row must include:
- `case_id`
- `model_output`

## 4) Score Raw Outputs (Leaderboard-Eligible)

```powershell
node scripts/score-model-responses.js --input eval/responses.jsonl --outdir eval/runs/<run_id> --model <MODEL_NAME>
```

Outputs:
- `eval/runs/<run_id>/results_scored.csv`
- `eval/runs/<run_id>/results_summary.json`
- `eval/runs/<run_id>/results_summary.md`

Scoring compares model decisions against `ai_benchmark/ground_truth.json`.

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
node scripts/build-model-comparison.js
```

Generated:
- `eval/model_comparison.md`
- `eval/model_comparison.json`

`build-model-comparison` places only `run_type=model_raw_output` and full coverage runs on the leaderboard.

## 7) Reference Runs

Non-leaderboard runs (baselines, manual samples, self-checks) are tracked in:
- `eval/runs/README.md`

## 8) Manual Subset Scoring (Computed, Non-Estimated)

Prepare a decision file (`JSON` or `CSV`) with at least:
- `case_id`
- `decision` (`SETTLE|REJECT|PENDING`)
- `notes` (optional)

Example:

```powershell
node scripts/score-manual-decisions.js --input eval/runs/manual_decisions_template.json --outdir eval/runs/<run_id> --model "<MODEL_NAME>" --source "<SOURCE_DESC>"
```

Validate manual run metadata and coverage consistency:

```powershell
node scripts/validate-manual-runs.js
```
