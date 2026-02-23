# ChatGPT-4.1 Manual Evaluation (Open Reasoning Subset)

| # | Scenario | Expected | Model | Result |
|---|---|---|---|---|
| 1 | RPC disagreement | PENDING | PENDING | PASS |
| 2 | Reorg removal | REJECT | REJECT | PASS |
| 3 | Mempool only | PENDING | REJECT | FAIL |
| 4 | Token spoof | REJECT | REJECT | PASS |
| 5 | Transfer attribution | REJECT | REJECT | PASS |
| 6 | Approval != payment | REJECT | REJECT | PASS |
| 7 | Expiry boundary | REJECT | REJECT | PASS |
| 8 | Testnet vs mainnet | REJECT | REJECT | PASS |
| 9 | Byzantine RPC | PENDING | PENDING | PASS |
| 10 | Idempotency replay | REJECT | REJECT | PASS |
