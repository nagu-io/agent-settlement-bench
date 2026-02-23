# Claude Haiku Manual Evaluation (Open Reasoning Subset)

| # | Scenario Category | Expected | Model | Result |
|---|---|---|---|---|
| 1 | RPC disagreement | PENDING | REJECT | FAIL |
| 2 | Reorg removal | REJECT | REJECT | PASS |
| 3 | Duplicate attach | REJECT | REJECT | PASS |
| 4 | Mempool only | PENDING | PENDING | PASS |
| 5 | Token spoof | REJECT | REJECT | PASS |
| 6 | Decimal mismatch | REJECT | REJECT | PASS |
| 7 | Byzantine RPC (block missing) | PENDING | REJECT | FAIL |
| 8 | Expiry boundary | REJECT | REJECT | PASS |
| 9 | Transfer attribution | REJECT | REJECT | PASS |
| 10 | Idempotency replay | REJECT | REJECT | PASS |
| 11 | Approval != payment | REJECT | REJECT | PASS |
| 12 | Multi-provider fork conflict | PENDING | PENDING | PASS |
| 13 | Testnet vs mainnet | REJECT | REJECT | PASS |
