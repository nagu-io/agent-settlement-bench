# AgentSettlementBench Scoring Summary

- Model: Weak-Open-Baseline
- Cases evaluated: 20/20
- Coverage: 100.0%
- Total cases: 20
- Pass: 0
- Fail: 20
- Pass rate: 0.0%
- Critical fail rate: 100.0% (7/7)
- Risk-weighted fail rate: 100.0%
- Risk-weighted score formula: sum(weight x fail) / sum(weight), with weights low=1, medium=3, high=7, critical=10

## By Category
| category | total | pass | fail | pass_rate |
|---|---:|---:|---:|---:|
| accounting | 2 | 0 | 2 | 0.0% |
| edge_case | 3 | 0 | 3 | 0.0% |
| rpc | 4 | 0 | 4 | 0.0% |
| security | 6 | 0 | 6 | 0.0% |
| validation | 5 | 0 | 5 | 0.0% |

## By Severity
| severity | total | pass | fail | pass_rate |
|---|---:|---:|---:|---:|
| critical | 7 | 0 | 7 | 0.0% |
| high | 11 | 0 | 11 | 0.0% |
| medium | 2 | 0 | 2 | 0.0% |

## Fail Mistake Types
| mistake_type | count |
|---|---:|
| network_mismatch_acceptance | 1 |
| decimal_precision_error | 1 |
| token_spoof_acceptance | 1 |
| recipient_mismatch_acceptance | 1 |
| replay_protection_failure | 1 |
| rpc_timeout_misclassification | 1 |
| weak_rpc_consensus | 1 |
| reorg_unhandled | 1 |
| race_double_credit | 1 |
| environment_crossover | 1 |
| incomplete_chain_evidence | 1 |
| approve_as_payment | 1 |
| utxo_output_misattribution | 1 |
| expiry_policy_violation | 1 |
| premature_settlement | 1 |
| state_transition_race | 1 |
| idempotency_payload_mismatch | 1 |
| transfer_event_overcount | 1 |
| single_source_trust | 1 |
| tenant_isolation_failure | 1 |

