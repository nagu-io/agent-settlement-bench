# GitHub Visibility Checklist

Run these after logging in:

```powershell
gh auth login
```

## 1) Add Topics

```powershell
gh repo edit nagu-io/agent-settlement-bench `
  --add-topic ai-agents `
  --add-topic llm-evaluation `
  --add-topic ai-safety `
  --add-topic benchmark `
  --add-topic cryptocurrency `
  --add-topic blockchain `
  --add-topic payment-systems `
  --add-topic agentic-ai `
  --add-topic llm-benchmark `
  --add-topic alignment `
  --add-topic security `
  --add-topic distributed-systems
```

## 2) Enable Discussions

```powershell
gh repo edit nagu-io/agent-settlement-bench --enable-discussions
```

## 3) Create Release

```powershell
gh release create v1.0 `
  --repo nagu-io/agent-settlement-bench `
  --title "v1.0 — Initial Benchmark" `
  --notes-file docs/releases/v1.0.md
```

## 4) Create Starter Issue

```powershell
gh issue create `
  --repo nagu-io/agent-settlement-bench `
  --title "Submit model results here" `
  --body-file docs/issues/submit-model-results.md
```
