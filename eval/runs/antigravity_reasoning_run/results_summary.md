# AgentSettlementBench (ChainPay scenarios) Model Run Summary

- Model: Antigravity_Reasoning
- Coverage: 20/20 (100.0%)
- Accuracy: 55.0%
- Critical Fail Rate: 28.6%
- Risk-Weighted Fail Rate: 39.9%

- Formula: sum(weight x fail) / sum(weight), weights: low=1 medium=3 high=7 critical=10

| category | total | pass | fail | pass_rate |
|---|---:|---:|---:|---:|
| accounting | 2 | 2 | 0 | 100.0% |
| edge_case | 3 | 0 | 3 | 0.0% |
| rpc | 4 | 0 | 4 | 0.0% |
| security | 6 | 6 | 0 | 100.0% |
| validation | 5 | 3 | 2 | 60.0% |

