/**
 * @file run_all.js
 * @path tests/unit_tests/lib/run_all.js
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Combined unit test run: runs erp/run_all_erp.sh and api/run_all_api.sh one after
 *   the other and writes ONE report for both into tests/unit_tests/report/ – report.html,
 *   report.xml and coverage/erp/ + coverage/api/ (line-by-line code coverage of each part;
 *   the summary and the per-file tables show the coverage of both parts). Every test name is prefixed with its part
 *   ("erp › …", "api › …"); the summary shows the totals and one line per part.
 *   Each part writes into a temporary folder (env UNIT_TESTS_REPORT_DIR) and leaves its
 *   normalized run as JSON (env UNIT_TESTS_RUN_JSON, see report.js) – the per-part report
 *   folders erp/report and api/report are not touched.
 * @dependencies
 * - ./report.js, ../erp/run_all_erp.sh, ../api/run_all_api.sh (and their requirements).
 *
 * @usage node run_all.js [--no-coverage]   (called by tests/unit_tests/run_all.sh)
 * @note Exit code: 0 = all passed, 1 = at least one failure, 2 = a part could not run
 *   (setup problem, e.g. missing node_modules / vendor) – that part is a failed entry in the report.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { writeReport } = require('./report');

const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'report');
const PARTS_DIR = path.join(REPORT_DIR, '.parts');

/** The parts of the combined run, in order. Both get the command line arguments (e.g. --no-coverage). */
const PARTS = [
  { target: 'erp', script: path.join(ROOT, 'erp', 'run_all_erp.sh'), passArgs: true },
  { target: 'api', script: path.join(ROOT, 'api', 'run_all_api.sh'), passArgs: true }
];

/**
 * @description Runs one part and returns its normalized run.
 * @param {{target:string, script:string, passArgs:boolean}} part Part definition.
 * @param {string[]} args Command line arguments of run_all.sh.
 * @returns {{run:object, exitCode:number}} The part's run; when the part wrote no result
 *   (setup problem, crash) a run with one failed "setup" entry.
 */
function runPart(part, args) {
  const dir = path.join(PARTS_DIR, part.target);
  const json = path.join(PARTS_DIR, `${part.target}.json`);
  const started = Date.now();
  console.log(`\n=== ${part.target} (${path.basename(part.script)}) ===`);
  const r = spawnSync('bash', [part.script, ...(part.passArgs ? args : [])], {
    stdio: 'inherit',
    env: { ...process.env, UNIT_TESTS_REPORT_DIR: dir, UNIT_TESTS_RUN_JSON: json }
  });
  const exitCode = r.status === null ? 1 : r.status;
  if (fs.existsSync(json)) return { run: JSON.parse(fs.readFileSync(json, 'utf8')), exitCode, dir };
  return {
    exitCode, dir,
    run: {
      target: part.target, command: path.basename(part.script), durationMs: Date.now() - started,
      tests: [{
        suite: 'setup', name: `${path.basename(part.script)} did not run`, status: 'failed', timeMs: 0,
        category: 'build error', message: exitCode === 2
          ? 'Setup problem (missing node_modules / vendor or tool) – see the console output.'
          : `The part ended with exit code ${exitCode} without a result – see the console output.`
      }]
    }
  };
}

/** Entry point. */
function main() {
  const args = process.argv.slice(2);
  const started = Date.now();
  fs.rmSync(REPORT_DIR, { recursive: true, force: true });
  fs.mkdirSync(PARTS_DIR, { recursive: true });

  const results = PARTS.map(p => runPart(p, args));
  const tests = [];
  const parts = [];
  const coverage = [];
  for (const { run, exitCode, dir } of results) {
    for (const t of run.tests) tests.push({ ...t, suite: [run.target, t.suite].filter(Boolean).join(' › ') });
    const count = s => run.tests.filter(t => t.status === s).length;
    parts.push({ target: run.target, command: run.command, total: run.tests.length, passed: count('passed'),
      failed: count('failed'), skipped: count('skipped'), durationMs: run.durationMs, exitCode });
    // coverage of every part (not only the last) - its html goes to coverage/<part>/
    for (const cov of [].concat(run.coverage || [])) {
      const entry = { ...cov, label: run.target };
      const src = path.join(dir, 'coverage');
      if (!cov.unavailable && fs.existsSync(src)) {
        fs.mkdirSync(path.join(REPORT_DIR, 'coverage'), { recursive: true });
        fs.renameSync(src, path.join(REPORT_DIR, 'coverage', run.target));
        entry.html = `coverage/${run.target}/index.html`;
      }
      coverage.push(entry);
    }
  }

  console.log('\n=== erp + api ===');
  const summary = writeReport({
    target: 'erp + api', group: 'All', command: 'run_all.sh', startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started, tests, coverage: coverage.length ? coverage : undefined, parts
  }, REPORT_DIR);
  fs.rmSync(PARTS_DIR, { recursive: true, force: true });
  if (results.some(r => r.exitCode === 2)) process.exit(2);
  process.exit(summary.failed > 0 ? 1 : 0);
}

main();
