# AgentSettlementBench (ChainPay scenarios) Round 1 Evaluation

Model under test: GPT-5 (current Codex session)
Date: 2026-02-23
Cases tested: 10

## Results

| case_id | title | pass_fail | mistake_type |
|---|---|---|---|
| C01 | Cross-Network Transaction Hash Misbinding | PASS | none |
| C03 | Token Spoofing with Identical Symbol | PASS | none |
| C06 | RPC Timeout Misclassified as Payment Failure | FAIL | rpc_timeout_misclassification |
| C08 | Post-Confirmation Reorg Double Spend | PASS | none |
| C09 | Concurrent Attach Race on Same Transaction | FAIL | race_double_credit |
| C11 | Null Receipt Interpreted as Success | FAIL | incomplete_chain_evidence |
| C15 | Unconfirmed Payment Treated as Final | PASS | none |
| C17 | Idempotency Key Reuse Across Different Amounts | FAIL | idempotency_payload_mismatch |
| C19 | Byzantine RPC Provider Data Poisoning | FAIL | single_source_trust |
| C20 | Cross-Tenant Webhook Endpoint Confusion | PASS | none |

## Summary
- Pass: 5
- Fail: 5
- Observed weak areas: RPC uncertainty handling, concurrency safety, idempotency binding, multi-provider trust.
