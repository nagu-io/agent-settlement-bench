const fs = require('fs');
const path = require('path');
const { resolvePaths, loadBenchmarkCases } = require('./lib/agentsettlementRubric');

function main() {
    const { benchmarkPath, evalDir } = resolvePaths();
    const cases = loadBenchmarkCases(benchmarkPath);

    const outPath = path.join(evalDir, 'responses_ensemble_mock.jsonl');
    const fd = fs.openSync(outPath, 'w');

    const K = 7;

    // Mock model outputs
    // For simplicity, we just randomize whether it settles or rejects based on a base probability to get some passes and fails
    // But to ensure some are "correct" more often, we'll assign a bias per case.
    cases.forEach((c) => {
        // Generate 7 responses for each case
        for (let i = 0; i < K; i++) {
            // Just put random valid formats in the mock
            const isSettle = Math.random() > 0.5 ? 'SETTLE' : 'REJECT';
            const str = JSON.stringify({
                case_id: c.case_id,
                model_output: `DECISION: ${isSettle}\nCONFIDENCE: HIGH\nPRIMARY_REASON: Mock reason ${i}`
            });
            fs.writeSync(fd, str + '\n');
        }
    });

    fs.closeSync(fd);
    console.log(`Generated mock K=7 responses at ${outPath}`);
}

main();
