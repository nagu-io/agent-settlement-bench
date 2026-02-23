# Model Comparison

Metrics:
- `Accuracy` = pass_rate_pct
- `Critical Fail Rate` = critical_fail_rate_pct
- `Risk-Weighted Fail Rate` = sum(weight x fail) / sum(weight), weights: low=1 medium=3 high=7 critical=10

## Leaderboard (Valid Model Runs)
| Run ID | Model | Cases | Accuracy | Critical Fail Rate | Risk-Weighted Fail Rate |
|---|---|---:|---:|---:|---:|
| antigravity_run | Antigravity | 20/20 | 100.0% | 0.0% | 0.0% |

## Reference Runs (Not Leaderboard Eligible)
| Run ID | Model | Cases | Accuracy | Critical Fail Rate | Risk-Weighted Fail Rate |
|---|---|---:|---:|---:|---:|
| gpt5_live_manual_prompt | GPT-5-Live-Manual-Prompt | 20/20 | 95.0% | 0.0% | 2.0% |
| rule_strong_baseline | Strong-Rule-Baseline | 20/20 | 95.0% | 0.0% | 2.0% |
| gpt5_round1_sample | GPT-5-Round1-Sample | 10/20 | 50.0% | 40.0% | 45.7% |
| always_settle_baseline | Weak-Open-Baseline | 20/20 | 0.0% | 100.0% | 100.0% |
