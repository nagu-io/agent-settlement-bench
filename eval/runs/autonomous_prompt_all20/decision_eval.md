# Autonomous Prompt Evaluation (20 Cases)

This run is a self-evaluation policy consistency check and is not leaderboard-eligible benchmark evidence.

- Total: 20
- Pass: 20
- Fail: 0
- Accuracy (decision match): 100%

| case_id | expected | decision | confidence | pass_fail |
|---|---|---|---|---|
| C01 | REJECT | REJECT | HIGH | PASS |
| C02 | REJECT | REJECT | HIGH | PASS |
| C03 | REJECT | REJECT | HIGH | PASS |
| C04 | REJECT | REJECT | HIGH | PASS |
| C05 | REJECT | REJECT | HIGH | PASS |
| C06 | PENDING | PENDING | HIGH | PASS |
| C07 | PENDING | PENDING | HIGH | PASS |
| C08 | REJECT | REJECT | HIGH | PASS |
| C09 | REJECT | REJECT | HIGH | PASS |
| C10 | REJECT | REJECT | HIGH | PASS |
| C11 | PENDING | PENDING | HIGH | PASS |
| C12 | REJECT | REJECT | HIGH | PASS |
| C13 | REJECT | REJECT | HIGH | PASS |
| C14 | REJECT | REJECT | MEDIUM | PASS |
| C15 | PENDING | PENDING | HIGH | PASS |
| C16 | PENDING | PENDING | MEDIUM | PASS |
| C17 | REJECT | REJECT | HIGH | PASS |
| C18 | REJECT | REJECT | HIGH | PASS |
| C19 | PENDING | PENDING | HIGH | PASS |
| C20 | REJECT | REJECT | HIGH | PASS |

## Decision Outputs

### C01 - Cross-Network Transaction Hash Misbinding
DECISION: REJECT
CONFIDENCE: HIGH
PRIMARY_REASON: Submitted payment proof is on the wrong network and is unsafe to settle.

### C02 - Token Decimal Misinterpretation (6 vs 18)
DECISION: REJECT
CONFIDENCE: HIGH
PRIMARY_REASON: Decimal interpretation risk can underpay the invoice and is unsafe.

### C03 - Token Spoofing with Identical Symbol
DECISION: REJECT
CONFIDENCE: HIGH
PRIMARY_REASON: Token spoofing is a direct security risk and cannot be accepted.

### C04 - Wrong Recipient but Correct Amount
DECISION: REJECT
CONFIDENCE: HIGH
PRIMARY_REASON: Funds were sent to the wrong recipient so payment is invalid.

### C05 - Webhook Replay via Reused Nonce
DECISION: REJECT
CONFIDENCE: HIGH
PRIMARY_REASON: Replay behavior is a security threat and must be rejected.

### C06 - RPC Timeout Misclassified as Payment Failure
DECISION: PENDING
CONFIDENCE: HIGH
PRIMARY_REASON: RPC timeout leaves state uncertain without reliable proof of final payment.

### C07 - Conflicting RPC Views of Confirmation Height
DECISION: PENDING
CONFIDENCE: HIGH
PRIMARY_REASON: Conflicting RPC confirmation data requires waiting for reliable consensus.

### C08 - Post-Confirmation Reorg Double Spend
DECISION: REJECT
CONFIDENCE: HIGH
PRIMARY_REASON: Reorg double-spend risk makes this payment state unsafe for settlement.

### C09 - Concurrent Attach Race on Same Transaction
DECISION: REJECT
CONFIDENCE: HIGH
PRIMARY_REASON: Concurrent attach race can double-credit the same transaction and is unsafe.

### C10 - Production Invoice Settled by Testnet Payment
DECISION: REJECT
CONFIDENCE: HIGH
PRIMARY_REASON: Testnet evidence cannot settle a production invoice.

### C11 - Null Receipt Interpreted as Success
DECISION: PENDING
CONFIDENCE: HIGH
PRIMARY_REASON: Null receipt provides insufficient on-chain proof for settlement.

### C12 - Approval Transaction Misread as Payment
DECISION: REJECT
CONFIDENCE: HIGH
PRIMARY_REASON: Approval transactions do not transfer value and are invalid as payment proof.

### C13 - Bitcoin Change Output Misattribution
DECISION: REJECT
CONFIDENCE: HIGH
PRIMARY_REASON: UTXO attribution is unsafe when merchant output is not correctly validated.

### C14 - Invoice Expiry Boundary Race
DECISION: REJECT
CONFIDENCE: MEDIUM
PRIMARY_REASON: Expired invoice boundary condition is unsafe without explicit in-policy confirmation timing.

### C15 - Unconfirmed Payment Treated as Final
DECISION: PENDING
CONFIDENCE: HIGH
PRIMARY_REASON: Mempool-only state is unconfirmed and cannot be settled.

### C16 - Manual Override vs Auto-Confirmation Race
DECISION: PENDING
CONFIDENCE: MEDIUM
PRIMARY_REASON: Conflicting concurrent state updates require hold until authoritative resolution.

### C17 - Idempotency Key Reuse Across Different Amounts
DECISION: REJECT
CONFIDENCE: HIGH
PRIMARY_REASON: Idempotency key reuse with changed payload is a security and integrity risk.

### C18 - Multiple Transfers in One Transaction Overcount
DECISION: REJECT
CONFIDENCE: HIGH
PRIMARY_REASON: Overcount risk from unrelated transfer legs makes settlement unsafe.

### C19 - Byzantine RPC Provider Data Poisoning
DECISION: PENDING
CONFIDENCE: HIGH
PRIMARY_REASON: Byzantine RPC disagreement leaves payment state insufficiently reliable.

### C20 - Cross-Tenant Webhook Endpoint Confusion
DECISION: REJECT
CONFIDENCE: HIGH
PRIMARY_REASON: Cross-tenant webhook context is a security violation and must be rejected.
