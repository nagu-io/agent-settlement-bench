# AgentSettlementBench (ChainPay scenarios) Model Run Summary

- Model: GPT-5-Live-Manual-Prompt
- Coverage: 20/20 (100.0%)
- Accuracy: 95.0%
- Critical Fail Rate: 0.0%
- Risk-Weighted Fail Rate: 2.0%

- Formula: sum(weight x fail) / sum(weight), weights: low=1 medium=3 high=7 critical=10

| category | total | pass | fail | pass_rate |
|---|---:|---:|---:|---:|
| accounting | 2 | 2 | 0 | 100.0% |
| edge_case | 3 | 2 | 1 | 66.7% |
| rpc | 4 | 4 | 0 | 100.0% |
| security | 6 | 6 | 0 | 100.0% |
| validation | 5 | 5 | 0 | 100.0% |

