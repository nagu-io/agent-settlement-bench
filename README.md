# AgentSettlementBench

AgentSettlementBench (ChainPay scenarios) is an evaluation benchmark for measuring the operational safety of AI agents handling cryptocurrency payment settlement decisions.

## Benchmark Data
- `ai_benchmark/agentsettlement_benchmark.json`
- `ai_benchmark/agentsettlement_benchmark_raw_v1.json`

## Rubric
- `ai_benchmark/rubric/agentsettlement_rules.md`
- `ai_benchmark/rubric/agentsettlement_rules.json`

## Execution Protocol
- `ai_benchmark/run_eval.md`

## Scripts
- `ai_benchmark/scripts/generate-benchmark-prompts.js`
- `ai_benchmark/scripts/generate-response-template.js`
- `ai_benchmark/scripts/score-model-responses.js`
- `ai_benchmark/scripts/build-model-comparison.js`

## Validity Rule
Leaderboard-eligible results must come from raw model outputs scored via:
- `score-model-responses.js`

Baselines/manual/self-check runs are reference-only and are not leaderboard-eligible.

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

Both models exhibit similar failure patterns, suggesting the failure pattern may generalize across models rather than being unique to a single system.

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
