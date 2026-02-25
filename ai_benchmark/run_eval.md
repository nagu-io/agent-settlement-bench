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

## 5) Ensemble Reference Run (Strict Majority, Non-Leaderboard)

Prepare `eval/responses_ensemble.jsonl` with exactly `K` responses per case.
Each row uses the same fields as normal model scoring:
- `case_id`
- `model_output`

```powershell
node scripts/score-ensemble-responses.js --input eval/responses_ensemble.jsonl --outdir eval/runs/<run_id> --model <MODEL_NAME> --k 7
```

Notes:
- strict majority threshold is `floor(K/2)+1`
- no strict majority produces `NO_MAJORITY` and is scored as fail (`ensemble_no_majority`)
- ensemble runs are reference-only and not leaderboard-eligible

## 6) Ensemble K Sweep (Reliability vs Cost, Non-Leaderboard)

Use one high-sample ensemble file and compare multiple `K` values in one run:

```powershell
node scripts/run-ensemble-k-sweep.js --input eval/responses_ensemble.jsonl --k-values 1,3,5,7 --cost-per-call-usd 0.002 --latency-per-call-ms 850
```

To average each `K` over random subset trials:

```powershell
node scripts/run-ensemble-k-sweep.js --input eval/responses_ensemble.jsonl --k-values 1,3,5,7 --bootstrap-runs 30 --random-seed 42 --cost-per-call-usd 0.002 --latency-per-call-ms 850
```

Generated:
- `eval/ensemble_k_sweep/ensemble_k_sweep.md`
- `eval/ensemble_k_sweep/ensemble_k_sweep.json`
- `eval/ensemble_k_sweep/ensemble_k_sweep.csv`
- per-K outputs in `eval/ensemble_k_sweep/k*`

`run-ensemble-k-sweep` uses strict-majority ensemble scoring for each K and reports metric deltas versus baseline K (the first K in `--k-values`).
With `--bootstrap-runs > 1`, it reports mean, sample standard deviation, and percentile bands (`p5/p50/p95`) across trials.

## 7) Risk-Weighted Metric

Weights:
- `low=1`
- `medium=3`
- `high=7`
- `critical=10`

Formula:

```text
risk_weighted_fail_rate = sum(weight x fail) / sum(weight)
```

## 8) Build Comparison Table

```powershell
node scripts/build-model-comparison.js
```

Generated:
- `eval/model_comparison.md`
- `eval/model_comparison.json`

`build-model-comparison` places only `run_type=model_raw_output` and full coverage runs on the leaderboard.

## 9) Reference Runs

Non-leaderboard runs (baselines, manual samples, self-checks) are tracked in:
- `eval/runs/README.md`

## 10) Manual Subset Scoring (Computed, Non-Estimated)

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
