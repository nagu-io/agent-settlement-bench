# AgentSettlementBench (ChainPay scenarios) Model Run Summary

- Model: Antigravity_Tool_Verification
- Coverage: 20/20 (100.0%)
- Accuracy: 80.0%
- Critical Fail Rate: 14.3%
- Risk-Weighted Fail Rate: 17.6%

- Formula: sum(weight x fail) / sum(weight), weights: low=1 medium=3 high=7 critical=10

| category | total | pass | fail | pass_rate |
|---|---:|---:|---:|---:|
| accounting | 2 | 2 | 0 | 100.0% |
| edge_case | 3 | 1 | 2 | 33.3% |
| rpc | 4 | 4 | 0 | 100.0% |
| security | 6 | 6 | 0 | 100.0% |
| validation | 5 | 3 | 2 | 60.0% |

