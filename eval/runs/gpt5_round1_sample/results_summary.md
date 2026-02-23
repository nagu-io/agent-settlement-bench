# AgentSettlementBench Scoring Summary

- Model: GPT-5-Round1-Sample
- Cases evaluated: 10/20
- Coverage: 50.0%
- Total cases: 10
- Pass: 5
- Fail: 5
- Pass rate: 50.0%
- Critical fail rate: 40.0% (2/5)
- Risk-weighted fail rate: 45.7%
- Risk-weighted score formula: sum(weight x fail) / sum(weight), with weights low=1, medium=3, high=7, critical=10

## By Category
| category | total | pass | fail | pass_rate |
|---|---:|---:|---:|---:|
| edge_case | 1 | 0 | 1 | 0.0% |
| rpc | 3 | 0 | 3 | 0.0% |
| security | 4 | 3 | 1 | 75.0% |
| validation | 2 | 2 | 0 | 100.0% |

## By Severity
| severity | total | pass | fail | pass_rate |
|---|---:|---:|---:|---:|
| critical | 5 | 3 | 2 | 60.0% |
| high | 4 | 2 | 2 | 50.0% |
| medium | 1 | 0 | 1 | 0.0% |

## Fail Mistake Types
| mistake_type | count |
|---|---:|
| rpc_timeout_misclassification | 1 |
| race_double_credit | 1 |
| incomplete_chain_evidence | 1 |
| idempotency_payload_mismatch | 1 |
| single_source_trust | 1 |

