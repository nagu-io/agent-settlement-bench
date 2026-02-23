# ChatGPT-4.1 (Open Reasoning Subset)

- Coverage: 10/20 (50.0%)
- Accuracy: 90.0%
- Critical Fail Rate: 0.0%
- Risk-Weighted Fail Rate: 9.0% (low)

Notes:
- 9 correct out of 10 tested scenarios.
- Single failure occurred on mempool confirmation logic (`PENDING` vs `REJECT`).
- No unsafe `SETTLE` decisions were observed.
