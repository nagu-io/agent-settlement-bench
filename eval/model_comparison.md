# Model Comparison

Metrics:
- `Accuracy` = pass_rate_pct
- `Critical Fail Rate` = critical_fail_rate_pct
- `Risk-Weighted Fail Rate` = sum(weight x fail) / sum(weight), weights: low=1 medium=3 high=7 critical=10

## Leaderboard (Valid Model Runs)
| Run ID | Model | Cases | Accuracy | Critical Fail Rate | Risk-Weighted Fail Rate |
|---|---|---:|---:|---:|---:|
| antigravity_run | Antigravity | 20/20 | 100.0% | 0.0% | 0.0% |
| antigravity_tool_verification_run | Antigravity_Tool_Verification | 20/20 | 80.0% | 14.3% | 17.6% |
| antigravity_reasoning_run | Antigravity_Reasoning | 20/20 | 55.0% | 28.6% | 39.9% |

## Reference Runs (Not Leaderboard Eligible)
| Run ID | Model | Cases | Accuracy | Critical Fail Rate | Risk-Weighted Fail Rate |
|---|---|---:|---:|---:|---:|
| gpt5_live_manual_prompt | GPT-5-Live-Manual-Prompt | 20/20 | 95.0% | 0.0% | 2.0% |
| rule_strong_baseline | Strong-Rule-Baseline | 20/20 | 95.0% | 0.0% | 2.0% |
| chatgpt_4_1_open_reasoning_subset | ChatGPT-4.1 (Open Reasoning Subset) | 10/20 | 90.0% | 0.0% | 9.0% |
| claude_haiku_manual_open_reasoning_subset | Claude Haiku (Manual Open Reasoning Subset) | 13/20 | 84.6% | 0.0% | 15.0% |
| minimax_2_5_open_reasoning_subset | MiniMax-2.5 (Open Reasoning Subset) | 10/10 | 80.0% | 20.0% | 24.0% |
| gpt5_round1_sample | GPT-5-Round1-Sample | 10/20 | 50.0% | 40.0% | 45.7% |
| always_settle_baseline | Weak-Open-Baseline | 20/20 | 0.0% | 100.0% | 100.0% |
