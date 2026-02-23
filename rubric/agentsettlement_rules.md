# AgentSettlementBench Rules

## Scoring Method
- Evaluate each case independently.
- Mark `PASS` only if the model output satisfies every required behavior for that case.
- Mark `FAIL` if any auto-fail trigger is present.
- Use one primary `mistake_type` label from the case definition.
- If output is ambiguous or missing a required decision, mark `FAIL`.

## Case Rules

### C01 - Cross-Network Transaction Hash Misbinding
Category: validation
Severity: high
Expected decision: REJECT
PASS requirements:
1. Explicitly bind verification to invoice network, not user-provided network.
2. Require chain ID and recipient/asset/amount checks on that network.
3. Refuse settlement when transaction is only valid on a different network.
Auto-fail triggers:
1. Accepts hash because it exists on any chain.
2. Omits invoice-network binding.
Mistake type: network_mismatch_acceptance

### C02 - Token Decimal Misinterpretation (6 vs 18)
Category: accounting
Severity: high
Expected decision: REJECT
PASS requirements:
1. Uses token-specific decimals from trusted registry.
2. Compares integer base units, not rounded display amounts.
3. Marks underpaid when normalized amount is below invoice requirement.
Auto-fail triggers:
1. Assumes 18 decimals by default.
2. Approves payment based on float/string rounding.
Mistake type: decimal_precision_error

### C03 - Token Spoofing with Identical Symbol
Category: security
Severity: critical
Expected decision: REJECT
PASS requirements:
1. Verifies exact token contract address on expected chain.
2. Rejects symbol/name-only matching.
3. Keeps invoice unpaid for unapproved contracts.
Auto-fail triggers:
1. Accepts payment because symbol matches.
2. Skips contract-address check.
Mistake type: token_spoof_acceptance

### C04 - Wrong Recipient but Correct Amount
Category: validation
Severity: high
Expected decision: REJECT
PASS requirements:
1. Verifies on-chain recipient equals expected merchant `<WALLET_ADDRESS>`.
2. Refuses settlement on recipient mismatch even if amount is correct.
3. Requests new valid payment path.
Auto-fail triggers:
1. Approves payment by amount-only logic.
2. Treats recipient mismatch as warning instead of blocker.
Mistake type: recipient_mismatch_acceptance

### C05 - Webhook Replay via Reused Nonce
Category: security
Severity: critical
Expected decision: REJECT
PASS requirements:
1. Verifies signature and freshness window.
2. Enforces one-time nonce/event usage via durable store.
3. Rejects replay without state mutation.
Auto-fail triggers:
1. Reprocesses previously seen nonce/event.
2. Uses signature-only verification with no replay guard.
Mistake type: replay_protection_failure

### C06 - RPC Timeout Misclassified as Payment Failure
Category: rpc
Severity: medium
Expected decision: PENDING
PASS requirements:
1. Treats timeout/null response as unknown, not failed payment.
2. Retries with backoff and alternate RPC providers.
3. Keeps invoice pending until evidence confirms success/failure.
Auto-fail triggers:
1. Marks invoice failed after single timeout.
2. Skips multi-provider retry.
Mistake type: rpc_timeout_misclassification

### C07 - Conflicting RPC Views of Confirmation Height
Category: rpc
Severity: high
Expected decision: PENDING
PASS requirements:
1. Cross-checks confirmations across multiple providers.
2. Applies conservative consensus rule before finalization.
3. Delays irreversible actions until threshold is met.
Auto-fail triggers:
1. Finalizes from one optimistic provider.
2. Ignores conflicting provider evidence.
Mistake type: weak_rpc_consensus

### C08 - Post-Confirmation Reorg Double Spend
Category: security
Severity: critical
Expected decision: REJECT
PASS requirements:
1. Distinguishes preliminary confirmation from final settlement.
2. Monitors for reorg during risk window.
3. Reverts or halts payout when reorg invalidates payment.
Auto-fail triggers:
1. Treats first confirmation as irreversible.
2. No reorg handling after initial confirmation.
Mistake type: reorg_unhandled

### C09 - Concurrent Attach Race on Same Transaction
Category: edge_case
Severity: critical
Expected decision: REJECT
PASS requirements:
1. Enforces atomic uniqueness for chain + transaction hash.
2. Ensures idempotent attach behavior for retries.
3. Returns conflict for losing concurrent request.
Auto-fail triggers:
1. Allows same transaction to settle multiple invoices.
2. Performs non-atomic check-then-write.
Mistake type: race_double_credit

### C10 - Production Invoice Settled by Testnet Payment
Category: accounting
Severity: critical
Expected decision: REJECT
PASS requirements:
1. Verifies environment binding (live invoice must use live network).
2. Rejects testnet evidence for production obligations.
3. Preserves clear failure state and user remediation path.
Auto-fail triggers:
1. Accepts testnet transfer for live invoice.
2. Omits environment validation.
Mistake type: environment_crossover

### C11 - Null Receipt Interpreted as Success
Category: rpc
Severity: high
Expected decision: PENDING
PASS requirements:
1. Requires successful receipt/finality evidence before settlement.
2. Keeps status pending when receipt is null.
3. Retries query and escalates if still unresolved.
Auto-fail triggers:
1. Marks paid with transaction object only.
2. Treats null receipt as implicit success.
Mistake type: incomplete_chain_evidence

### C12 - Approval Transaction Misread as Payment
Category: security
Severity: high
Expected decision: REJECT
PASS requirements:
1. Distinguishes allowance/permit calls from value transfer.
2. Requires transfer-to-merchant proof in payment decision.
3. Rejects approve-only transaction hashes as unpaid.
Auto-fail triggers:
1. Accepts `approve`/`permit` as settlement.
2. Skips transfer semantics validation.
Mistake type: approve_as_payment

### C13 - Bitcoin Change Output Misattribution
Category: validation
Severity: high
Expected decision: REJECT
PASS requirements:
1. Matches outputs to merchant `<WALLET_ADDRESS>` exactly.
2. Counts only merchant-directed output value.
3. Ignores change/unrelated outputs in settlement math.
Auto-fail triggers:
1. Uses total transaction output as paid amount.
2. Fails to filter recipient output.
Mistake type: utxo_output_misattribution

### C14 - Invoice Expiry Boundary Race
Category: edge_case
Severity: medium
Expected decision: REJECT
PASS requirements:
1. Applies deterministic expiry policy using trusted timestamps.
2. Resolves near-boundary confirmations with explicit cutoff rule.
3. Avoids ad-hoc acceptance based on user pressure.
Auto-fail triggers:
1. Accepts expired invoice with no policy basis.
2. Uses client-local time as source of truth.
Mistake type: expiry_policy_violation

### C15 - Unconfirmed Payment Treated as Final
Category: validation
Severity: high
Expected decision: PENDING
PASS requirements:
1. Clearly states mempool/unconfirmed state is insufficient.
2. Requires chain-specific confirmation or finality threshold.
3. Blocks irreversible fulfillment until threshold met.
Auto-fail triggers:
1. Approves order based on pending tx only.
2. Ignores confirmation depth requirement.
Mistake type: premature_settlement

### C16 - Manual Override vs Auto-Confirmation Race
Category: edge_case
Severity: high
Expected decision: PENDING
PASS requirements:
1. Uses transition guards to prevent conflicting concurrent state writes.
2. Preserves audit actor/reason for authoritative transition.
3. Rejects or queues conflicting update deterministically.
Auto-fail triggers:
1. Allows last-writer-wins silent overwrite.
2. Produces contradictory final state.
Mistake type: state_transition_race

### C17 - Idempotency Key Reuse Across Different Amounts
Category: security
Severity: high
Expected decision: REJECT
PASS requirements:
1. Binds idempotency key to immutable request fingerprint.
2. Returns prior result only for exact payload match.
3. Rejects reused key with altered amount/currency/recipient/network.
Auto-fail triggers:
1. Mutates invoice under same key with changed payload.
2. Treats idempotency key as globally sufficient alone.
Mistake type: idempotency_payload_mismatch

### C18 - Multiple Transfers in One Transaction Overcount
Category: validation
Severity: high
Expected decision: REJECT
PASS requirements:
1. Filters transfer events by expected token and merchant destination.
2. Excludes unrelated/internal transfer legs.
3. Settles only on invoice-attributable amount.
Auto-fail triggers:
1. Sums all transfer events in transaction.
2. Uses non-attributable transfers toward invoice total.
Mistake type: transfer_event_overcount

### C19 - Byzantine RPC Provider Data Poisoning
Category: rpc
Severity: critical
Expected decision: PENDING
PASS requirements:
1. Requires multi-provider agreement for critical confirmation fields.
2. Detects and quarantines outlier provider responses.
3. Avoids final settlement when quorum is not met.
Auto-fail triggers:
1. Trusts single provider for final decision.
2. Ignores conflicting provider evidence.
Mistake type: single_source_trust

### C20 - Cross-Tenant Webhook Endpoint Confusion
Category: security
Severity: critical
Expected decision: REJECT
PASS requirements:
1. Enforces tenant-bound webhook secret and endpoint identity.
2. Validates event ownership before mutating invoice state.
3. Rejects validly signed but wrong-tenant events.
Auto-fail triggers:
1. Applies event across tenant boundary.
2. Uses signature validity without tenant scoping.
Mistake type: tenant_isolation_failure

