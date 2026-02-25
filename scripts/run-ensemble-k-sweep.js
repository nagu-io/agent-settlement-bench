const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadBenchmarkCases, resolvePaths } = require('./lib/agentsettlementRubric');

function parseArgs(argv) {
  const args = {
    input: null,
    outdir: null,
    model: null,
    kValues: null,
    allowPartial: false,
    costPerCallUsd: 0,
    latencyPerCallMs: 0,
    bootstrapRuns: 1,
    randomSeed: null,
    keepIntermediates: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('-') && !args.input) {
      args.input = argv[i];
      continue;
    }
    if (arg === '--input' && i + 1 < argv.length) {
      args.input = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--outdir' && i + 1 < argv.length) {
      args.outdir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--model' && i + 1 < argv.length) {
      args.model = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--k-values' && i + 1 < argv.length) {
      args.kValues = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--cost-per-call-usd' && i + 1 < argv.length) {
      args.costPerCallUsd = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--latency-per-call-ms' && i + 1 < argv.length) {
      args.latencyPerCallMs = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--bootstrap-runs' && i + 1 < argv.length) {
      args.bootstrapRuns = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--random-seed' && i + 1 < argv.length) {
      args.randomSeed = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--allow-partial') {
      args.allowPartial = true;
      continue;
    }
    if (arg === '--keep-intermediates') {
      args.keepIntermediates = true;
    }
  }
  return args;
}

function parseJsonl(pathname) {
  const lines = fs
    .readFileSync(pathname, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON on line ${i + 1}: ${error.message}`);
    }
  });
}

function writeJsonl(pathname, records) {
  const payload = records.map((item) => JSON.stringify(item)).join('\n');
  fs.writeFileSync(pathname, `${payload}\n`, 'utf8');
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsv(pathname, rows) {
  const csv = rows.map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\n');
  fs.writeFileSync(pathname, `${csv}\n`, 'utf8');
}

function parseKValues(raw) {
  const source = raw || '1,3,5,7';
  const tokens = source
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (tokens.length === 0) {
    throw new Error(`--k-values must contain positive integers. Received: ${source}`);
  }

  const parsed = tokens.map((token) => {
    const value = Number.parseInt(token, 10);
    if (!/^\d+$/.test(token) || !Number.isInteger(value) || value <= 0) {
      throw new Error(`Invalid K value "${token}" in --k-values`);
    }
    return value;
  });

  const unique = [...new Set(parsed)].sort((a, b) => a - b);
  if (unique.length === 0) {
    throw new Error(`--k-values must contain positive integers. Received: ${source}`);
  }
  return unique;
}

function parseNonNegativeNumber(raw, fieldName) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number. Received: ${raw}`);
  }
  return parsed;
}

function parsePositiveInteger(raw, fieldName) {
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer. Received: ${raw}`);
  }
  return parsed;
}

function parseIntegerOrDefault(raw, defaultValue, fieldName) {
  if (raw === null || raw === undefined || String(raw).trim().length === 0) {
    return defaultValue;
  }
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be an integer. Received: ${raw}`);
  }
  return parsed;
}

function round1(value) {
  return Number(Number(value).toFixed(1));
}

function round2(value) {
  return Number(Number(value).toFixed(2));
}

function roundN(value, decimals) {
  return Number(Number(value).toFixed(decimals));
}

function formatUsd(value) {
  if (value >= 1) return value.toFixed(2);
  return value.toFixed(6);
}

function mean(values) {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

function sampleStdDev(values) {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((acc, v) => acc + (v - avg) * (v - avg), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];

  const clamped = Math.max(0, Math.min(1, p));
  const index = clamped * (sorted.length - 1);
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];

  const weight = index - low;
  return sorted[low] + (sorted[high] - sorted[low]) * weight;
}

function createRng(seed) {
  let state = seed >>> 0;
  return function rng() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mixSeed(baseSeed, k, trialIndex) {
  let x = baseSeed >>> 0;
  x = (x ^ Math.imul((k + 1) >>> 0, 0x9e3779b1)) >>> 0;
  x = (x ^ Math.imul((trialIndex + 1) >>> 0, 0x85ebca6b)) >>> 0;
  return x >>> 0;
}

function sampleWithoutReplacement(records, k, rng) {
  if (records.length < k) {
    throw new Error(`Cannot sample K=${k} from ${records.length} records`);
  }
  const work = records.slice();
  for (let i = 0; i < k; i += 1) {
    const j = i + Math.floor(rng() * (work.length - i));
    const tmp = work[i];
    work[i] = work[j];
    work[j] = tmp;
  }
  return work.slice(0, k);
}

function groupByCase(records) {
  const map = new Map();
  for (const record of records) {
    const caseId = String(record.case_id || '').trim();
    if (!caseId) {
      throw new Error('Each JSONL record must include case_id');
    }
    if (!map.has(caseId)) map.set(caseId, []);
    map.get(caseId).push(record);
  }
  return map;
}

function ensureCoverage({
  benchmarkCaseIds,
  responsesByCase,
  maxK,
  allowPartial,
}) {
  if (!allowPartial) {
    for (const caseId of benchmarkCaseIds) {
      const records = responsesByCase.get(caseId) || [];
      if (records.length < maxK) {
        throw new Error(
          `Insufficient responses for ${caseId}: need at least ${maxK}, found ${records.length}`
        );
      }
    }
    return benchmarkCaseIds;
  }

  const eligible = benchmarkCaseIds.filter((caseId) => {
    const records = responsesByCase.get(caseId) || [];
    return records.length >= maxK;
  });
  if (eligible.length === 0) {
    throw new Error(
      `No case has enough responses for max K=${maxK}. Use a larger input file or lower --k-values.`
    );
  }
  return eligible;
}

function buildDeterministicSubset(responsesByCase, caseIds, k) {
  const subset = [];
  for (const caseId of caseIds) {
    const records = responsesByCase.get(caseId) || [];
    if (records.length < k) {
      throw new Error(`Insufficient responses for ${caseId}: need ${k}, found ${records.length}`);
    }
    subset.push(...records.slice(0, k));
  }
  return subset;
}

function buildRandomSubset(responsesByCase, caseIds, k, rng) {
  const subset = [];
  for (const caseId of caseIds) {
    const records = responsesByCase.get(caseId) || [];
    if (records.length < k) {
      throw new Error(`Insufficient responses for ${caseId}: need ${k}, found ${records.length}`);
    }
    subset.push(...sampleWithoutReplacement(records, k, rng));
  }
  return subset;
}

function runEnsembleScorer({
  benchmarkRoot,
  scoreScriptPath,
  subsetPath,
  outdir,
  modelName,
  k,
  allowPartial,
}) {
  const args = [
    scoreScriptPath,
    '--input',
    subsetPath,
    '--outdir',
    outdir,
    '--model',
    modelName,
    '--k',
    String(k),
  ];
  if (allowPartial) args.push('--allow-partial');

  const result = spawnSync(process.execPath, args, {
    cwd: benchmarkRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const message = [
      `Scoring failed for K=${k}`,
      result.stderr ? result.stderr.trim() : '',
      result.stdout ? result.stdout.trim() : '',
    ]
      .filter((line) => line.length > 0)
      .join('\n');
    throw new Error(message);
  }

  const summaryPath = path.join(outdir, 'ensemble_summary.json');
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Expected summary file not found: ${summaryPath}`);
  }
  return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
}

function aggregateTrialSummaries(k, trialSummaries) {
  if (trialSummaries.length === 0) {
    throw new Error(`No trial summaries found for K=${k}`);
  }

  const first = trialSummaries[0];
  const casesEvaluated = first.cases_evaluated;
  const strictThreshold = first.strict_majority_threshold;

  for (const summary of trialSummaries) {
    if (summary.cases_evaluated !== casesEvaluated) {
      throw new Error(
        `Inconsistent cases_evaluated for K=${k}: expected ${casesEvaluated}, found ${summary.cases_evaluated}`
      );
    }
    if (summary.strict_majority_threshold !== strictThreshold) {
      throw new Error(
        `Inconsistent strict majority threshold for K=${k}: expected ${strictThreshold}, found ${summary.strict_majority_threshold}`
      );
    }
  }

  const accuracyValues = trialSummaries.map((s) => Number(s.pass_rate_pct));
  const criticalFailValues = trialSummaries.map((s) => Number(s.critical_fail_rate_pct));
  const rwFailValues = trialSummaries.map((s) => Number(s.risk_weighted_fail_rate_pct));
  const noMajorityValues = trialSummaries.map((s) => Number(s.no_majority_cases));
  const formatMajorityValues = trialSummaries.map((s) => Number(s.format_majority_cases));
  const singleModelAccuracyValues = trialSummaries.map((s) =>
    Number(s.single_model_accuracy_pct)
  );

  return {
    k,
    bootstrap_runs: trialSummaries.length,
    strict_majority_threshold: strictThreshold,
    cases_evaluated: casesEvaluated,
    accuracy_pct: round1(mean(accuracyValues)),
    accuracy_std_pct: round1(sampleStdDev(accuracyValues)),
    accuracy_p05_pct: round1(percentile(accuracyValues, 0.05)),
    accuracy_p50_pct: round1(percentile(accuracyValues, 0.5)),
    accuracy_p95_pct: round1(percentile(accuracyValues, 0.95)),
    critical_fail_rate_pct: round1(mean(criticalFailValues)),
    critical_fail_rate_std_pct: round1(sampleStdDev(criticalFailValues)),
    critical_fail_rate_p05_pct: round1(percentile(criticalFailValues, 0.05)),
    critical_fail_rate_p50_pct: round1(percentile(criticalFailValues, 0.5)),
    critical_fail_rate_p95_pct: round1(percentile(criticalFailValues, 0.95)),
    risk_weighted_fail_rate_pct: round1(mean(rwFailValues)),
    risk_weighted_fail_rate_std_pct: round1(sampleStdDev(rwFailValues)),
    risk_weighted_fail_rate_p05_pct: round1(percentile(rwFailValues, 0.05)),
    risk_weighted_fail_rate_p50_pct: round1(percentile(rwFailValues, 0.5)),
    risk_weighted_fail_rate_p95_pct: round1(percentile(rwFailValues, 0.95)),
    no_majority_cases: round2(mean(noMajorityValues)),
    format_majority_cases: round2(mean(formatMajorityValues)),
    single_model_accuracy_pct: round1(mean(singleModelAccuracyValues)),
    trial_summary_paths: trialSummaries.map((s) => s.summary_path),
  };
}

function buildSweepRows({
  aggregateRows,
  costPerCallUsd,
  latencyPerCallMs,
}) {
  const base = aggregateRows[0];
  return aggregateRows.map((row) => {
    const estimatedCostPerCaseUsd = row.k * costPerCallUsd;
    const estimatedTotalCostUsd = row.cases_evaluated * estimatedCostPerCaseUsd;
    const estimatedLatencyPerCaseMs = row.k * latencyPerCallMs;

    return {
      ...row,
      accuracy_delta_vs_base_pct: round1(row.accuracy_pct - base.accuracy_pct),
      risk_weighted_fail_improvement_vs_base_pct: round1(
        base.risk_weighted_fail_rate_pct - row.risk_weighted_fail_rate_pct
      ),
      estimated_cost_per_case_usd: roundN(estimatedCostPerCaseUsd, 6),
      estimated_total_cost_usd: roundN(estimatedTotalCostUsd, 6),
      estimated_latency_per_case_ms: round1(estimatedLatencyPerCaseMs),
    };
  });
}

function formatMeanStd(meanValue, stdValue) {
  return `${meanValue.toFixed(1)}% +/- ${stdValue.toFixed(1)}%`;
}

function formatPercentileBand(p05, p50, p95) {
  return `${p05.toFixed(1)}/${p50.toFixed(1)}/${p95.toFixed(1)}%`;
}

function toMarkdown({
  modelName,
  inputPath,
  kValues,
  baselineK,
  rows,
  allowPartial,
  benchmarkTotalCases,
  eligibleCases,
  costPerCallUsd,
  latencyPerCallMs,
  bootstrapRuns,
  randomSeed,
}) {
  const lines = [];
  lines.push('# Ensemble K Sweep');
  lines.push('');
  lines.push(`- Model: ${modelName}`);
  lines.push(`- Input: ${inputPath}`);
  lines.push(`- K values: ${kValues.join(', ')}`);
  lines.push(`- Baseline K: ${baselineK}`);
  lines.push(`- Cases included: ${eligibleCases}/${benchmarkTotalCases}`);
  lines.push(`- Allow partial: ${allowPartial ? 'true' : 'false'}`);
  lines.push(`- Bootstrap runs per K: ${bootstrapRuns}`);
  lines.push(`- Random seed: ${randomSeed}`);
  lines.push(`- Cost per call (USD): ${costPerCallUsd}`);
  lines.push(`- Latency per call (ms): ${latencyPerCallMs}`);
  lines.push('');
  lines.push(
    `Delta columns are relative to K=${baselineK}. Positive risk improvement means lower risk-weighted fail rate.`
  );
  if (bootstrapRuns > 1) {
    lines.push('Std dev uses sample standard deviation across random subset trials.');
    lines.push('Percentile band format is p5/p50/p95.');
  }
  lines.push('');
  lines.push(
    '| K | Trials | Cases | Accuracy (mean+/-sd) | Accuracy p5/p50/p95 | Delta Accuracy | RW Fail (mean+/-sd) | RW Fail p5/p50/p95 | RW Fail Improvement | Critical Fail (mean+/-sd) | Critical p5/p50/p95 | No Majority (mean) | Cost/Case (USD) | Total Cost (USD) | Latency/Case (ms) |'
  );
  lines.push('|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');

  for (const row of rows) {
    lines.push(
      `| ${row.k} | ${row.bootstrap_runs} | ${row.cases_evaluated} | ${formatMeanStd(
        row.accuracy_pct,
        row.accuracy_std_pct
      )} | ${formatPercentileBand(
        row.accuracy_p05_pct,
        row.accuracy_p50_pct,
        row.accuracy_p95_pct
      )} | ${row.accuracy_delta_vs_base_pct.toFixed(1)}% | ${formatMeanStd(
        row.risk_weighted_fail_rate_pct,
        row.risk_weighted_fail_rate_std_pct
      )} | ${formatPercentileBand(
        row.risk_weighted_fail_rate_p05_pct,
        row.risk_weighted_fail_rate_p50_pct,
        row.risk_weighted_fail_rate_p95_pct
      )} | ${row.risk_weighted_fail_improvement_vs_base_pct.toFixed(
        1
      )}% | ${formatMeanStd(
        row.critical_fail_rate_pct,
        row.critical_fail_rate_std_pct
      )} | ${formatPercentileBand(
        row.critical_fail_rate_p05_pct,
        row.critical_fail_rate_p50_pct,
        row.critical_fail_rate_p95_pct
      )} | ${row.no_majority_cases.toFixed(2)} | ${formatUsd(
        row.estimated_cost_per_case_usd
      )} | ${formatUsd(row.estimated_total_cost_usd)} | ${row.estimated_latency_per_case_ms.toFixed(
        1
      )} |`
    );
  }

  lines.push('');
  return lines.join('\n');
}

function main() {
  const { benchmarkRoot, benchmarkPath, evalDir } = resolvePaths();
  const args = parseArgs(process.argv.slice(2));

  const inputPath = args.input
    ? path.resolve(args.input)
    : path.join(evalDir, 'responses_ensemble.jsonl');
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input not found: ${inputPath}`);
  }

  const outdir = args.outdir
    ? path.resolve(args.outdir)
    : path.join(evalDir, 'ensemble_k_sweep');
  fs.mkdirSync(outdir, { recursive: true });

  const kValues = parseKValues(args.kValues);
  const baselineK = kValues[0];
  const maxK = kValues[kValues.length - 1];
  const bootstrapRuns = parsePositiveInteger(args.bootstrapRuns, '--bootstrap-runs');
  const randomSeed = parseIntegerOrDefault(args.randomSeed, 1337, '--random-seed');
  const costPerCallUsd = parseNonNegativeNumber(
    args.costPerCallUsd,
    '--cost-per-call-usd'
  );
  const latencyPerCallMs = parseNonNegativeNumber(
    args.latencyPerCallMs,
    '--latency-per-call-ms'
  );

  const benchmarkCases = loadBenchmarkCases(benchmarkPath);
  const benchmarkCaseIds = benchmarkCases.map((item) => item.case_id);
  const records = parseJsonl(inputPath);
  const responsesByCase = groupByCase(records);
  const includedCaseIds = ensureCoverage({
    benchmarkCaseIds,
    responsesByCase,
    maxK,
    allowPartial: args.allowPartial,
  });

  const scoreScriptPath = path.join(benchmarkRoot, 'scripts', 'score-ensemble-responses.js');
  const modelName = args.model || path.basename(path.resolve(outdir)) || 'unspecified';
  const aggregateRows = [];

  for (const k of kValues) {
    if (k % 2 === 0) {
      process.stderr.write(
        `Warning: K=${k} is even. Strict-majority failures from ties/no-majority are more likely.\n`
      );
    }

    const kOutdir = path.join(outdir, `k${k}`);
    fs.mkdirSync(kOutdir, { recursive: true });
    const trialSummaries = [];

    for (let trialIndex = 0; trialIndex < bootstrapRuns; trialIndex += 1) {
      const trialNum = trialIndex + 1;
      const trialId = `trial_${String(trialNum).padStart(3, '0')}`;
      const trialOutdir =
        bootstrapRuns === 1 ? kOutdir : path.join(kOutdir, 'trials', trialId);
      fs.mkdirSync(trialOutdir, { recursive: true });

      const subset =
        bootstrapRuns === 1
          ? buildDeterministicSubset(responsesByCase, includedCaseIds, k)
          : buildRandomSubset(
              responsesByCase,
              includedCaseIds,
              k,
              createRng(mixSeed(randomSeed, k, trialIndex))
            );

      const subsetPath = path.join(trialOutdir, 'responses_input.jsonl');
      writeJsonl(subsetPath, subset);

      const summary = runEnsembleScorer({
        benchmarkRoot,
        scoreScriptPath,
        subsetPath,
        outdir: trialOutdir,
        modelName,
        k,
        allowPartial: args.allowPartial,
      });
      summary.summary_path = path.join(trialOutdir, 'ensemble_summary.json');
      summary.trial = trialNum;
      trialSummaries.push(summary);

      if (!args.keepIntermediates && fs.existsSync(subsetPath)) {
        fs.unlinkSync(subsetPath);
      }
    }

    const aggregate = aggregateTrialSummaries(k, trialSummaries);
    if (bootstrapRuns === 1) {
      aggregate.summary_path = trialSummaries[0].summary_path;
    } else {
      const aggregateSummaryPath = path.join(kOutdir, 'aggregate_summary.json');
      const aggregatePayload = {
        ...aggregate,
        trials: trialSummaries.map((s) => ({
          trial: s.trial,
          pass_rate_pct: s.pass_rate_pct,
          critical_fail_rate_pct: s.critical_fail_rate_pct,
          risk_weighted_fail_rate_pct: s.risk_weighted_fail_rate_pct,
          no_majority_cases: s.no_majority_cases,
          format_majority_cases: s.format_majority_cases,
          single_model_accuracy_pct: s.single_model_accuracy_pct,
          summary_path: s.summary_path,
        })),
      };
      fs.writeFileSync(
        aggregateSummaryPath,
        `${JSON.stringify(aggregatePayload, null, 2)}\n`,
        'utf8'
      );
      aggregate.summary_path = aggregateSummaryPath;
    }
    aggregateRows.push(aggregate);
  }

  aggregateRows.sort((a, b) => a.k - b.k);
  const rows = buildSweepRows({
    aggregateRows,
    costPerCallUsd,
    latencyPerCallMs,
  });

  const outJsonPath = path.join(outdir, 'ensemble_k_sweep.json');
  const outMdPath = path.join(outdir, 'ensemble_k_sweep.md');
  const outCsvPath = path.join(outdir, 'ensemble_k_sweep.csv');

  const payload = {
    model: modelName,
    input: inputPath,
    k_values: kValues,
    baseline_k: baselineK,
    allow_partial: args.allowPartial,
    bootstrap_runs: bootstrapRuns,
    random_seed: randomSeed,
    benchmark_total_cases: benchmarkCases.length,
    cases_included: includedCaseIds.length,
    cost_per_call_usd: costPerCallUsd,
    latency_per_call_ms: latencyPerCallMs,
    rows,
  };
  fs.writeFileSync(outJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const md = toMarkdown({
    modelName,
    inputPath,
    kValues,
    baselineK,
    rows,
    allowPartial: args.allowPartial,
    benchmarkTotalCases: benchmarkCases.length,
    eligibleCases: includedCaseIds.length,
    costPerCallUsd,
    latencyPerCallMs,
    bootstrapRuns,
    randomSeed,
  });
  fs.writeFileSync(outMdPath, `${md}\n`, 'utf8');

  const csvRows = [
    [
      'k',
      'bootstrap_runs',
      'strict_majority_threshold',
      'cases_evaluated',
      'accuracy_pct',
      'accuracy_std_pct',
      'accuracy_p05_pct',
      'accuracy_p50_pct',
      'accuracy_p95_pct',
      'accuracy_delta_vs_base_pct',
      'critical_fail_rate_pct',
      'critical_fail_rate_std_pct',
      'critical_fail_rate_p05_pct',
      'critical_fail_rate_p50_pct',
      'critical_fail_rate_p95_pct',
      'risk_weighted_fail_rate_pct',
      'risk_weighted_fail_rate_std_pct',
      'risk_weighted_fail_rate_p05_pct',
      'risk_weighted_fail_rate_p50_pct',
      'risk_weighted_fail_rate_p95_pct',
      'risk_weighted_fail_improvement_vs_base_pct',
      'no_majority_cases',
      'format_majority_cases',
      'single_model_accuracy_pct',
      'estimated_cost_per_case_usd',
      'estimated_total_cost_usd',
      'estimated_latency_per_case_ms',
      'summary_path',
    ],
  ];
  for (const row of rows) {
    csvRows.push([
      row.k,
      row.bootstrap_runs,
      row.strict_majority_threshold,
      row.cases_evaluated,
      row.accuracy_pct,
      row.accuracy_std_pct,
      row.accuracy_p05_pct,
      row.accuracy_p50_pct,
      row.accuracy_p95_pct,
      row.accuracy_delta_vs_base_pct,
      row.critical_fail_rate_pct,
      row.critical_fail_rate_std_pct,
      row.critical_fail_rate_p05_pct,
      row.critical_fail_rate_p50_pct,
      row.critical_fail_rate_p95_pct,
      row.risk_weighted_fail_rate_pct,
      row.risk_weighted_fail_rate_std_pct,
      row.risk_weighted_fail_rate_p05_pct,
      row.risk_weighted_fail_rate_p50_pct,
      row.risk_weighted_fail_rate_p95_pct,
      row.risk_weighted_fail_improvement_vs_base_pct,
      row.no_majority_cases,
      row.format_majority_cases,
      row.single_model_accuracy_pct,
      row.estimated_cost_per_case_usd,
      row.estimated_total_cost_usd,
      row.estimated_latency_per_case_ms,
      row.summary_path,
    ]);
  }
  writeCsv(outCsvPath, csvRows);

  process.stdout.write(`K sweep complete for ${rows.length} K values\n`);
  process.stdout.write(`Bootstrap runs per K: ${bootstrapRuns}\n`);
  process.stdout.write(`Random seed: ${randomSeed}\n`);
  process.stdout.write(`Markdown: ${outMdPath}\n`);
  process.stdout.write(`JSON: ${outJsonPath}\n`);
  process.stdout.write(`CSV: ${outCsvPath}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
