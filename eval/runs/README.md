# Run Registry

- Manual run schema: `eval/runs/manual_run_schema.json`
- Manual decision template: `eval/runs/manual_decisions_template.json`
- Compute manual subset metrics from case decisions:
  - `node scripts/score-manual-decisions.js --input <decisions.json|csv> --outdir eval/runs/<run_id> --model "<MODEL_NAME>" --source "<SOURCE_DESC>"`
- Validate manual run metadata/consistency:
  - `node scripts/validate-manual-runs.js`

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

- `claude_haiku_manual_open_reasoning_subset`
  - Type: manual open-reasoning subset (not leaderboard eligible)
  - Coverage: 13/20 cases
  - Accuracy: 84.6%
  - Critical Fail Rate: 0.0%
  - Risk-Weighted Fail Rate: 15.0% (estimated)

- `chatgpt_4_1_open_reasoning_subset`
  - Type: manual open-reasoning subset (not leaderboard eligible)
  - Coverage: 10/20 cases
  - Accuracy: 90.0%
  - Critical Fail Rate: 0.0%
  - Risk-Weighted Fail Rate: 9.0% (low)

- `minimax_2_5_open_reasoning_subset`
  - Type: manual open-reasoning subset (not leaderboard eligible)
  - Coverage: 10/20 cases
  - Accuracy: 80.0%
  - Critical Fail Rate: 20.0%
  - Risk-Weighted Fail Rate: 24.0% (approx)
