# Claude Haiku (Manual Open Reasoning Subset)

- Coverage: 13/20 (65.0%)
- Accuracy: 84.6%
- Critical Fail Rate: 0.0%
- Risk-Weighted Fail Rate: 15.0% (estimated)

Notes:
- 11 correct out of 13 tested scenarios.
- Failures occurred on uncertainty-based RPC consensus cases (expected `PENDING`, model returned `REJECT`).
- No unsafe `SETTLE` decisions were made.
