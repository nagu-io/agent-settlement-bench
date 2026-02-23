# AgentSettlementBench (ChainPay scenarios) Model Run Summary

- Model: Smoke
- Coverage: 20/20 (100.0%)
- Accuracy: 100.0%
- Critical Fail Rate: 0.0%
- Risk-Weighted Fail Rate: 0.0%

- Formula: sum(weight x fail) / sum(weight), weights: low=1 medium=3 high=7 critical=10

| category | total | pass | fail | pass_rate |
|---|---:|---:|---:|---:|
| accounting | 2 | 2 | 0 | 100.0% |
| edge_case | 3 | 3 | 0 | 100.0% |
| rpc | 4 | 4 | 0 | 100.0% |
| security | 6 | 6 | 0 | 100.0% |
| validation | 5 | 5 | 0 | 100.0% |

