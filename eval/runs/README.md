# Run Registry

- `gpt5_round1_sample`
  - Type: manual sample (not leaderboard eligible)
  - Coverage: 10/20 cases
  - Source: `ai_benchmark/agentsettlement_eval_round1.md`

- `rule_strong_baseline`
  - Type: deterministic strong policy baseline (not leaderboard eligible)
  - Policy: `PENDING` for `{C07,C11,C15,C16,C19}`, otherwise `REJECT`
  - Coverage: 20/20 cases

- `always_settle_baseline`
  - Type: deterministic weak/open baseline (not leaderboard eligible)
  - Policy: always `SETTLE`
  - Coverage: 20/20 cases

- `autonomous_prompt_all20`
  - Type: self-evaluation policy consistency check (not leaderboard eligible)
  - Coverage: 20/20 cases

- `gpt5_live_manual_prompt`
  - Type: live assistant-generated model output run (not leaderboard eligible)
  - Coverage: 20/20 cases
