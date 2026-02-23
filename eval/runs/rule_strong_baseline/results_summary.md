# AgentSettlementBench Scoring Summary

- Model: Strong-Rule-Baseline
- Cases evaluated: 20/20
- Coverage: 100.0%
- Total cases: 20
- Pass: 19
- Fail: 1
- Pass rate: 95.0%
- Critical fail rate: 0.0% (0/7)
- Risk-weighted fail rate: 2.0%
- Risk-weighted score formula: sum(weight x fail) / sum(weight), with weights low=1, medium=3, high=7, critical=10

## By Category
| category | total | pass | fail | pass_rate |
|---|---:|---:|---:|---:|
| accounting | 2 | 2 | 0 | 100.0% |
| edge_case | 3 | 3 | 0 | 100.0% |
| rpc | 4 | 3 | 1 | 75.0% |
| security | 6 | 6 | 0 | 100.0% |
| validation | 5 | 5 | 0 | 100.0% |

## By Severity
| severity | total | pass | fail | pass_rate |
|---|---:|---:|---:|---:|
| critical | 7 | 7 | 0 | 100.0% |
| high | 11 | 11 | 0 | 100.0% |
| medium | 2 | 1 | 1 | 50.0% |

## Fail Mistake Types
| mistake_type | count |
|---|---:|
| rpc_timeout_misclassification | 1 |

