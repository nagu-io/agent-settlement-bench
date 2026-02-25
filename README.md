# AgentSettlementBench

Safety benchmark for AI agents making irreversible financial decisions.

It evaluates whether LLMs correctly refuse unsafe blockchain payments under adversarial conditions (reorgs, spoofed tokens, RPC disagreement, race conditions).

![Status](https://img.shields.io/badge/benchmark-active-brightgreen)
![Domain](https://img.shields.io/badge/domain-AI%20Safety-blue)

## Run in 60 seconds

```powershell
git clone https://github.com/nagu-io/agent-settlement-bench
cd agent-settlement-bench
npm install
npm run benchmark
```

Optional arguments:

```powershell
npm run benchmark -- --model openai --key YOUR_OPENAI_KEY
npm run benchmark -- --model gemini --key YOUR_GEMINI_KEY
npm run benchmark -- --model local --api-model qwen2.5:7b --base-url http://localhost:11434/v1/chat/completions
```

Notes:
- `--model` supports: `mock`, `openai`, `gemini`, `local`
- `--api-model` chooses provider model id (defaults are built in)
- `--key` can be omitted if `.env` has `OPENAI_API_KEY` or `GEMINI_API_KEY`

## Public Leaderboard

| Model | Accuracy | Critical Fail Rate | Risk-Weighted Fail |
|:---|---:|---:|---:|
| Codex | 50.0% | 30.0% | 40.0% |
| Gemini 3.1 | 55.0% | 28.6% | 39.9% |
| Claude Haiku (subset 13/20) | 84.6% | 0.0% | 15.0% |
| ChatGPT-4.1 (subset 10/20) | 90.0% | 0.0% | 9.0% |
| MiniMax-2.5 (subset 10/20) | 80.0% | 20.0% | 24.0% |

Subset rows are reference-only and not leaderboard-eligible.

## Evaluation Modes

| Mode | Description |
|---|---|
| v0 | Open reasoning (raw LLM) |
| v1 | Strict policy prompt |
| v3 | Tool-verified / state machine bounded |

## Small Models Welcome

This benchmark intentionally supports:
- Local LLaMA / Qwen / Mistral
- Quantized models
- Ensemble voting setups

Reliability is architecture-dependent, not size-dependent.

### Repo Purpose
- Evaluate AI agent settlement safety under adversarial crypto payment scenarios.
- Compare single-run model behavior vs architecture-level controls (strict prompts, verification tools, ensembles).
- Provide reproducible scoring and model comparison artifacts.

Visibility operations (topics, discussions, release, starter issue): `docs/github-visibility.md`

## Quick Start
1) Generate prompts
```powershell
node scripts/generate-benchmark-prompts.js
```

2) Run model manually and save outputs to:
- `eval/responses.jsonl`

3) Score results
```powershell
node scripts/score-model-responses.js eval/responses.jsonl
```

4) Build comparison
```powershell
node scripts/build-model-comparison.js
```

Example Output:
```text
Accuracy: 55%
Critical Fail Rate: 28.6%
Risk Weighted Fail: 39.9%
```

### Ensemble Evaluation Mode (K=7 Strict Majority Vote)
To evaluate whether repeated sampling improves system reliability:
1) Generate `K` responses per case and save to `eval/responses_ensemble.jsonl`.
2) Score the ensemble run with explicit `K`:
```powershell
node scripts/score-ensemble-responses.js --input eval/responses_ensemble.jsonl --k 7
```
3) Review outputs:
- `eval/ensemble_scored.csv`
- `eval/ensemble_summary.json`
- `eval/ensemble_summary.md`

Scoring rules:
- Each case must have exactly `K` responses.
- Decision uses **strict majority** (threshold = `floor(K/2)+1`), not plurality.
- If no strict majority exists, decision is marked `NO_MAJORITY` and scored as fail (`ensemble_no_majority`).
- The report includes both **Single Model Accuracy** (all raw responses) and **Ensemble Majority Accuracy** (case-level strict vote).

Ensemble runs are reference-only and not leaderboard-eligible.

### Ensemble K Sweep (Reliability vs Cost Curve)
To compare multiple ensemble sizes in one run (for example `K=1,3,5,7`):
```powershell
node scripts/run-ensemble-k-sweep.js --input eval/responses_ensemble.jsonl --k-values 1,3,5,7 --cost-per-call-usd 0.002 --latency-per-call-ms 850
```

For research-grade stability, average each `K` across random subset trials:
```powershell
node scripts/run-ensemble-k-sweep.js --input eval/responses_ensemble.jsonl --k-values 1,3,5,7 --bootstrap-runs 30 --random-seed 42 --cost-per-call-usd 0.002 --latency-per-call-ms 850
```

Outputs:
- `eval/ensemble_k_sweep/ensemble_k_sweep.md`
- `eval/ensemble_k_sweep/ensemble_k_sweep.json`
- `eval/ensemble_k_sweep/ensemble_k_sweep.csv`
- per-K subfolders: `eval/ensemble_k_sweep/k1`, `k3`, `k5`, `k7`

The sweep report includes:
- accuracy and risk-weighted fail rate per `K`
- standard deviation across bootstrap trials (`mean +/- sd`)
- percentile interval bands (`p5/p50/p95`) for accuracy and fail metrics
- delta vs baseline `K` (first value in `--k-values`)
- strict-majority failure signal (`NO_MAJORITY` count)
- estimated cost/latency from your per-call assumptions

Notes:
- `--bootstrap-runs 1` keeps deterministic first-`K` behavior.
- `--bootstrap-runs > 1` samples random subsets per case and reports averaged metrics.
- `--random-seed` makes bootstrap runs reproducible.


## Benchmark Data
- `ai_benchmark/agentsettlement_benchmark.json`
- `ai_benchmark/agentsettlement_benchmark_raw_v1.json`
- `ai_benchmark/ground_truth.json`

## Rubric
- `rubric/agentsettlement_rules.md`
- `rubric/agentsettlement_rules.json`

## Execution Protocol
- `ai_benchmark/run_eval.md`

## Scripts
- `scripts/run-benchmark.js`
- `scripts/generate-benchmark-prompts.js`
- `scripts/generate-response-template.js`
- `scripts/generate-ensemble-mock.js`
- `scripts/score-model-responses.js`
- `scripts/score-ensemble-responses.js`
- `scripts/run-ensemble-k-sweep.js`
- `scripts/score-manual-decisions.js`
- `scripts/validate-manual-runs.js`
- `scripts/build-model-comparison.js`

## Validity Rule
Leaderboard-eligible results must come from raw model outputs scored via:
- `score-model-responses.js`

Baselines/manual/self-check runs are reference-only and are not leaderboard-eligible.

## Objective Labels
Canonical case decisions are stored in:
- `ai_benchmark/ground_truth.json`

Scoring and prompt-generation scripts enforce consistency between benchmark cases, rubric metadata, and ground-truth labels.

## Key Findings

Evaluation across multiple prompt regimes reveals a critical behavioral law in AI payment validation: **In this benchmark, observed LLM safety behavior depends strongly on operational instruction structure.**

Performance across three distinct evaluation modes highlights this:
- **Strict safety policy**: 100% accuracy (measures *rule execution*)
- **Guided agent prompt**: ~95% accuracy (measures *constrained decision-making*)
- **Open reasoning prompt**: 55% accuracy with a 28.6% critical failure rate (measures *true reasoning capability*)

### Insight Details
Models demonstrate strong semantic understanding of typical financial attacks (e.g., spoofed tokens, wrong recipient). However, under unguided reasoning, they fail on operational distributed-systems logic, such as:
1. **RPC:** finality & consensus reasoning
2. **Edge Cases:** concurrency & timing logic
3. **Boundary Races:** state machine thinking

### Architecture Safety Calibration Curve
| Version | Architecture | Accuracy | Critical Fail Rate | Risk-Weighted Fail |
|:---|:---|:---|:---|:---|
| **v0** | Open Reasoning (Raw LLM) | 55.0% | 28.6% | 39.9% |
| **v1** | Strict Prompt Policy | 100% | 0.0% | 0.0% |
| **v3** | Tool Verification (State Machine) | 80.0% | 14.3% | 17.6% |

By simply altering the architecture to limit the LLM's authority (transitioning from *decision-maker* to *evidentiary analyst* determining recommendations), the architecture reduces high-risk decision exposure on distributed systems errors like RPC timeouts and mempool finality. The accuracy inherently clusters back up strictly because the model explicitly delays boundary evaluations to the deterministic systems layer.

**Core Insight:** *Safety improved not by increasing model correctness, but by reducing model authority.*

### Model Independence & Next Steps
This curve demonstrates that reliability comes from system design rather than model IQ. 

To prove this methodology generalizes, the benchmark executes this exact Safety Calibration Curve across distinct frontier models. The following initial capability comparison under unguided reasoning (`v0`) illustrates baseline model vulnerabilities:

| Model       | Accuracy | Critical Fail Rate | Risk-Weighted Fail |
|------------|-------:|------------------:|-------------------:|
| Codex      | 50.0%  | 30.0%             | 40.0%              |
| Gemini 3.1 | 55.0%  | 28.6%             | 39.9%              |
| Claude Haiku (Manual Open Reasoning Subset, 13/20) | 84.6% | 0.0% | 15.0% |
| ChatGPT-4.1 (Open Reasoning Subset, 10/20) | 90.0% | 0.0% | 9.0% |
| MiniMax-2.5 (Open Reasoning Subset, 10/20) | 80.0% | 20.0% | 24.0% |

Subset rows are manual samples and are not leaderboard-eligible.
Subset coverage is standardized against the full 20-case benchmark.

Across tested models, distributed-systems uncertainty handling remains a recurring weakness, even when overall accuracy improves.

If the architectural improvement (v0 → v3) persists uniformly across all models as initialized above, the benchmark will formally establish that deterministic state constraints reliably correct LLM financial distributed-systems failures regardless of the underlying model weights.

### Conclusion
On this benchmark, models follow explicit safety rules reliably but show reduced performance under unguided reasoning, especially in distributed-system edge cases such as consensus disagreement and timing races.

This benchmark is intended to serve as a **Safety Calibration Tool**. Its goal is not simply to score baseline models, but to help developers design robust control layers (such as deterministic state machines and tool-verified reasoning architectures) that help reduce high-risk edge-case failures.

## Limitations

### 1. Synthetic Scenarios
The benchmark cases are derived from realistic payment failure patterns but are still simulated descriptions rather than live blockchain execution traces. Therefore, results measure decision-making reliability under structured conditions, not full production behavior under adversarial network latency or real economic incentives.

### 2. Prompt Sensitivity
Model performance varies significantly with instruction framing. The benchmark intentionally exposes this property, but it also means scores should not be interpreted as inherent intelligence or safety capability of the base model. They represent behavior under a specific interaction protocol.

### 3. Not a Complete Payment System Audit
Passing the benchmark does not guarantee a secure payment gateway. The evaluation focuses on settlement decision logic only and does not cover:
- wallet key management
- signing infrastructure
- API authentication
- economic attacks (MEV, bribing, fee manipulation)
- denial-of-service conditions

### 4. Limited Chain Coverage
Scenarios abstract multiple blockchain environments into common patterns (confirmation depth, reorg risk, RPC disagreement). Different networks have unique finality properties, and results may not directly transfer without adapting thresholds.

### 5. Architecture Dependency
The safety improvements observed arise from restricting model authority and introducing deterministic verification layers. The benchmark therefore evaluates system design choices as much as model behavior. It should not be interpreted as a standalone model safety certification.

### 6. Small Sample Size
The benchmark contains 20 high-signal cases rather than a large statistical dataset. Its purpose is adversarial coverage, not probabilistic performance measurement. Future work may expand the case set to improve statistical confidence.

## Future Work

### 1. Multi-Model Validation
Run the full safety calibration curve across multiple independent model families (e.g., frontier, mid-tier, and smaller open models). The goal is to determine whether the observed safety improvements arise from architectural constraints rather than specific model training.

### 2. Expanded Adversarial Coverage
Increase the benchmark set beyond 20 scenarios to include:
- partial chain outages
- delayed finality conditions
- cross-chain bridging inconsistencies
- fee market manipulation
- adversarial timing attacks

This will improve statistical confidence and broaden distributed-systems coverage.

### 3. Live Trace Evaluation
Introduce replay testing using real historical blockchain transactions (sanitized). This will measure behavior under realistic noise rather than structured descriptions.

### 4. Automated Policy Synthesis
Investigate whether benchmark failures can automatically generate new control rules, enabling a feedback loop: `failure → rule → safer agent → re-evaluation`. The goal is to convert the benchmark into a continuous safety hardening pipeline.

### 5. Formal Safety Guarantees
Explore combining LLM reasoning with verifiable checks (deterministic state machines or formal constraints) to move from empirical reliability toward provable safety bounds for financial agents.
