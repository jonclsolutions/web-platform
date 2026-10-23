/**
 * @file run.js
 * @path tests/unit_tests/erp/lib/run.js
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Runs the Angular (Karma + Jasmine) unit tests of the given erp folders and writes
 *   tests/unit_tests/erp/report/report.html + report.xml.
 *   1. Finds every *.spec.ts under the given folders.
 *   2. Type-checks all specs once (tsc). A spec that does not compile is NOT sent to Karma –
 *      each of its compiler errors becomes a failed entry in the report (syntax error,
 *      parameter mismatch, …) so one broken spec never blocks the others.
 *   3. Runs Karma only for the compiling specs (temporary tsconfig limited to those files).
 *   4. Classifies every failed spec (assertion / runtime error / timeout …) and extracts the
 *      expected and actual value and the spec file location from Jasmine's message.
 *   5. Measures code coverage (istanbul via karma-coverage) of the source files in the tested
 *      folders – statements, branches, functions, lines per file. A source file that no spec
 *      loads counts as 0 %. Line-by-line detail: report/coverage/index.html.
 *      `--no-coverage` switches the measurement off.
 * @dependencies
 * - erp/node_modules (Angular CLI, TypeScript, Karma) – run `npm install` in erp first.
 * - Chrome/Chromium – taken from CHROME_BIN, otherwise looked up on PATH.
 * - ../../lib/report.js, ./karma.conf.js
 * - env UNIT_TESTS_REPORT_DIR (optional): report folder instead of tests/unit_tests/erp/report.
 *
 * @usage node run.js --group "Admin core" --command run_admin_core.sh [--no-coverage] src/app/admin/core-pages src/app/admin/components
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { writeReport, classifyTsError } = require('../../lib/report');

const REPO = path.resolve(__dirname, '../../../..');
const ERP = path.join(REPO, 'erp');
// UNIT_TESTS_REPORT_DIR: set by the combined runner (tests/unit_tests/lib/run_all.js)
const REPORT_DIR = process.env.UNIT_TESTS_REPORT_DIR || path.resolve(__dirname, '../report');
const TMP_DIR = path.join(REPORT_DIR, '.tmp');
const COVERAGE_DIR = path.join(REPORT_DIR, 'coverage');

/**
 * @description Parses the command line: --group, --command and the folders (relative to erp/).
 * @returns {{group:string, command:string, coverage:boolean, dirs:string[]}}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const out = { group: 'All', command: 'run_all_erp.sh', coverage: true, dirs: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-coverage') out.coverage = false;
    else if (args[i] === '--group') out.group = args[++i];
    else if (args[i] === '--command') out.command = args[++i];
    else out.dirs.push(args[i]);
  }
  if (!out.dirs.length) out.dirs.push('src');
  return out;
}

/**
 * @description Recursively lists *.spec.ts files below the given erp-relative folders.
 * @param {string[]} dirs Folders relative to erp/.
 * @returns {string[]} Sorted, erp-relative POSIX paths.
 */
function findSpecs(dirs) {
  return findFiles(dirs, name => name.endsWith('.spec.ts'));
}

/**
 * @description Lists source files whose coverage is measured: *.ts below the folders, without
 *   specs, declaration files and files with no runtime code (only interfaces / types, or an
 *   index.ts that only re-exports) – those compile to nothing, so there is nothing to cover.
 * @param {string[]} dirs Folders relative to erp/.
 * @returns {string[]} Sorted, erp-relative POSIX paths.
 */
function findSources(dirs) {
  const ts = require(path.join(ERP, 'node_modules', 'typescript'));
  return findFiles(dirs, name => name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.endsWith('.d.ts'))
    .filter(file => {
      const js = ts.transpileModule(fs.readFileSync(path.join(ERP, file), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, removeComments: true }
      }).outputText;
      // imports, `export {}` and barrel re-exports (`export * from …`) contain no statements
      return js.replace(/export\s*\{\s*\};?/g, '').replace(/^\s*(import|export\s*\*)\s[^;]*;/gm, '').trim().length > 0;
    });
}

/**
 * @description Recursively lists files below the given erp-relative folders.
 * @param {string[]} dirs Folders relative to erp/.
 * @param {(name:string) => boolean} accept File name filter.
 * @returns {string[]} Sorted, erp-relative POSIX paths.
 */
function findFiles(dirs, accept) {
  const found = new Set();
  const walk = abs => {
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const p = path.join(abs, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
      else if (accept(e.name)) found.add(path.relative(ERP, p).split(path.sep).join('/'));
    }
  };
  dirs.forEach(d => walk(path.join(ERP, d)));
  return [...found].sort();
}

/**
 * @description Finds the Chrome binary for Karma's ChromeHeadless launcher.
 * @returns {string|undefined} Path or undefined (Karma then reports the missing browser).
 */
function findChrome() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    const r = spawnSync('sh', ['-c', `command -v ${name}`], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return undefined;
}

/**
 * @description Type-checks all specs (tsconfig.spec.json) and groups compiler errors by file.
 * @returns {Map<string, Array<{line:number, col:number, code:string, message:string}>>}
 *   Keys are erp-relative POSIX paths.
 */
function typeCheck() {
  const tsc = path.join(ERP, 'node_modules', 'typescript', 'bin', 'tsc');
  const r = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.spec.json', '--noEmit', '--pretty', 'false'],
    { cwd: ERP, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const byFile = new Map();
  let last = null;
  for (const line of (r.stdout + r.stderr).split('\n')) {
    const m = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line);
    if (m) {
      const file = m[1].split(path.sep).join('/');
      last = { line: +m[2], col: +m[3], code: m[4], message: m[5] };
      if (!byFile.has(file)) byFile.set(file, []);
      byFile.get(file).push(last);
    } else if (last && /^\s+\S/.test(line)) {
      last.message += ' ' + line.trim(); // continuation of a multi-line message
    }
  }
  return byFile;
}

/**
 * @description Splits a Jasmine failure log into category, message, expected/actual and location.
 * @param {string[]} log Failure messages of one spec (one per failed expectation).
 * @returns {{category:string, message:string, expected?:string, actual?:string, location?:string, details:string}}
 */
function classifyFailure(log) {
  const first = String(log[0] || 'Unknown failure');
  const message = first.split('\n')[0].trim();
  const loc = /((?:src\/)?[\w./-]+\.spec\.ts):(\d+):(\d+)/.exec(log.join('\n'));
  const out = { message, location: loc ? `${loc[1]}:${loc[2]}` : undefined, details: log.join('\n\n').trim() };
  let m;
  if (/^(TypeError|ReferenceError|RangeError|SyntaxError)\b/.test(message)) out.category = 'runtime error';
  else if (/Timeout|timed out/i.test(message)) out.category = 'timeout';
  else if (/NG0\d+/.test(message)) out.category = 'angular error';
  else if ((m = /^Expected (?:spy )?([\s\S]*?) (not )?to (have been called with|have been called times|have been called|equal|be greater than or equal to|be less than or equal to|be greater than|be less than|be close to|be defined|be undefined|be null|be truthy|be falsy|be true|be false|be|contain|match|throw an error|throw|have size|have class)(?: ([\s\S]*?))?\.?$/.exec(message))) {
    out.category = 'assertion failed';
    out.actual = m[1];
    out.expected = `${m[2] ? 'not ' : ''}${m[3]}${m[4] ? ' ' + m[4] : ''}`;
  } else if (/^Expected/.test(message)) out.category = 'assertion failed';
  else out.category = 'runtime error';
  return out;
}

/**
 * @description Runs Karma for the given specs and returns the raw JSON results.
 * @param {string[]} specs erp-relative spec paths (all of them compile).
 * @param {boolean} coverage Measure code coverage (writes COVERAGE_DIR).
 * @returns {{results:object[], browserErrors:string[], output:string, status:number}}
 */
function runKarma(specs, coverage) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const tsconfig = path.join(TMP_DIR, 'tsconfig.json');
  const resultJson = path.join(TMP_DIR, 'karma-result.json');
  fs.rmSync(resultJson, { force: true });
  fs.writeFileSync(tsconfig, JSON.stringify({
    extends: path.join(ERP, 'tsconfig.spec.json'),
    compilerOptions: { typeRoots: [path.join(ERP, 'node_modules', '@types')] },
    files: specs.map(s => path.join(ERP, s)),
    include: [path.join(ERP, 'src', '**', '*.d.ts')]
  }, null, 2));

  const ng = path.join(ERP, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
  const args = [ng, 'test', '--watch=false', `--ts-config=${tsconfig}`,
    `--karma-config=${path.join(__dirname, 'karma.conf.js')}`, ...specs.map(s => `--include=${s}`)];
  const env = { ...process.env, RESULT_JSON: resultJson, NG_CLI_ANALYTICS: 'false' };
  delete env.COVERAGE_DIR;
  if (coverage) {
    args.push('--code-coverage');
    env.COVERAGE_DIR = COVERAGE_DIR;
  }
  const chrome = findChrome();
  if (chrome) env.CHROME_BIN = chrome;

  const r = spawnSync(process.execPath, args, { cwd: ERP, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const output = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(output.split('\n').filter(l => /Executed|SUCCESS|FAILED|ERROR/.test(l)).slice(-5).join('\n') + '\n');
  const data = fs.existsSync(resultJson) ? JSON.parse(fs.readFileSync(resultJson, 'utf8')) : { results: [], browserErrors: [] };
  return { ...data, output, status: r.status };
}

/**
 * @description Extracts build errors from the Angular CLI output when Karma could not start.
 * @param {string} output Combined stdout/stderr of `ng test`.
 * @returns {object[]} Normalized failed tests (one per error), or one generic entry.
 */
function buildErrors(output) {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, '');
  const tests = [];
  const re = /(src\/[\w./-]+):(\d+):(\d+) - error (TS\d+|NG\d+): ([^\n]*)/g;
  let m;
  while ((m = re.exec(clean))) {
    const c = m[4].startsWith('TS') ? classifyTsError(m[4], m[5]) : { category: 'build error' };
    tests.push({ suite: m[1], name: `build (line ${m[2]})`, status: 'failed', timeMs: 0, ...c,
      message: `${m[4]}: ${m[5]}`, location: `${m[1]}:${m[2]}` });
  }
  if (!tests.length) {
    const noBrowser = !findChrome() || /No binary for Chrome|cannot start Chrome|CHROME_BIN/i.test(clean);
    tests.push({ suite: 'Karma', name: 'test run', status: 'failed', timeMs: 0, category: 'build error',
      message: noBrowser
        ? 'Chrome/Chromium not found – install it or set CHROME_BIN=/path/to/chrome.'
        : 'Karma did not report any result – see details.',
      details: clean.split('\n').slice(-60).join('\n') });
  }
  return tests;
}

/**
 * @description Summarizes the istanbul coverage of the given source files.
 * @param {string[]} sources erp-relative source paths of the tested folders.
 * @returns {object|undefined} { totals: {statements, branches, functions, lines},
 *   files: [{ file, loaded, statements, branches, functions, lines, uncoveredLines }] } where
 *   every metric is { covered, total, pct }; undefined when no coverage data was written.
 * @note A file that no spec imports is not in the istanbul data – it is listed with
 *   loaded = false and 0 % (its size is unknown, so it does not change the totals).
 */
function summarizeCoverage(sources) {
  const json = path.join(COVERAGE_DIR, 'coverage-final.json');
  if (!fs.existsSync(json)) return undefined;
  const { createCoverageMap, createCoverageSummary } = require(path.join(ERP, 'node_modules', 'istanbul-lib-coverage'));
  const map = createCoverageMap(JSON.parse(fs.readFileSync(json, 'utf8')));
  const byRel = new Map(map.files().map(f => [path.relative(ERP, f).split(path.sep).join('/'), f]));
  const totals = createCoverageSummary();
  const metric = m => ({ covered: m.covered, total: m.total, pct: m.total ? Math.floor(m.covered / m.total * 10000) / 100 : 100 });
  const zero = { covered: 0, total: 0, pct: 0 };
  const files = sources.map(file => {
    const abs = byRel.get(file);
    if (!abs) return { file, loaded: false, statements: zero, branches: zero, functions: zero, lines: zero, uncoveredLines: [] };
    const fc = map.fileCoverageFor(abs);
    const sum = fc.toSummary();
    totals.merge(sum);
    return { file, loaded: true, statements: metric(sum.statements), branches: metric(sum.branches),
      functions: metric(sum.functions), lines: metric(sum.lines), uncoveredLines: fc.getUncoveredLines().map(Number) };
  });
  return {
    totals: { statements: metric(totals.statements), branches: metric(totals.branches),
      functions: metric(totals.functions), lines: metric(totals.lines) },
    allLoaded: files.every(f => f.loaded),
    files
  };
}

/** Entry point. */
function main() {
  const { group, command, coverage, dirs } = parseArgs();
  const started = Date.now();
  const tests = [];

  if (!fs.existsSync(path.join(ERP, 'node_modules'))) {
    console.error('erp/node_modules is missing – run `npm install` in erp/ first.');
    process.exit(2);
  }

  const specs = findSpecs(dirs);
  console.log(`${group}: ${specs.length} spec file(s), type-checking…`);
  const tsErrors = typeCheck();

  const runnable = [];
  for (const spec of specs) {
    const errs = tsErrors.get(spec);
    if (!errs) { runnable.push(spec); continue; }
    for (const e of errs) {
      tests.push({ suite: spec, name: `compile (line ${e.line})`, status: 'failed', timeMs: 0,
        ...classifyTsError(e.code, e.message), message: `${e.code}: ${e.message}`, location: `${spec}:${e.line}:${e.col}` });
    }
  }
  // compiler errors outside spec files (application code) would break every test build
  for (const [file, errs] of tsErrors) {
    if (file.endsWith('.spec.ts')) continue;
    for (const e of errs) {
      tests.push({ suite: file, name: `compile (line ${e.line})`, status: 'failed', timeMs: 0,
        ...classifyTsError(e.code, e.message), message: `${e.code}: ${e.message}`, location: `${file}:${e.line}:${e.col}` });
    }
  }
  if (specs.length !== runnable.length) {
    console.log(`${specs.length - runnable.length} spec file(s) do not compile – reported as failures, not run.`);
  }

  fs.rmSync(COVERAGE_DIR, { recursive: true, force: true });
  let coverageSummary;
  if (runnable.length) {
    const k = runKarma(runnable, coverage);
    if (coverage) coverageSummary = summarizeCoverage(findSources(dirs));
    if (!k.results.length) tests.push(...buildErrors(k.output));
    for (const r of k.results) {
      const t = { suite: (r.suite || []).join(' › '), name: r.name, status: r.status, timeMs: r.timeMs };
      if (r.status === 'failed') Object.assign(t, classifyFailure(r.log));
      tests.push(t);
    }
    // browser crash / disconnect: the specs that never ran must not silently disappear
    const clean = k.output.replace(/\u001b\[[0-9;]*m/g, '');
    const counts = [...clean.matchAll(/Executed (\d+) of (\d+)[^\n]*/g)].pop();
    const skippedInRun = counts ? +((/skipped (\d+)/.exec(counts[0]) || [0, 0])[1]) : 0;
    if (counts && +counts[1] + skippedInRun < +counts[2]) {
      const reason = /DISCONNECTED/.test(clean) ? 'the browser disconnected' : 'the run was aborted';
      tests.push({ suite: 'Karma', name: `${+counts[2] - +counts[1]} test(s) not executed`, status: 'failed', timeMs: 0,
        category: 'runtime error', message: `Only ${counts[1]} of ${counts[2]} tests ran – ${reason}.`,
        expected: `${counts[2]} executed`, actual: `${counts[1]} executed`,
        details: clean.split('\n').filter(l => /ERROR|DISCONNECTED|Disconnected/.test(l)).slice(-10).join('\n') });
    }
    for (const e of k.browserErrors || []) {
      tests.push({ suite: 'Browser', name: 'error outside of a spec', status: 'failed', timeMs: 0,
        category: 'runtime error', message: String(e).split('\n')[0], details: String(e) });
    }
  }

  const summary = writeReport({
    target: 'erp', group, command, startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started, tests, coverage: coverageSummary
  }, REPORT_DIR);
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  process.exit(summary.failed > 0 ? 1 : 0);
}

main();
