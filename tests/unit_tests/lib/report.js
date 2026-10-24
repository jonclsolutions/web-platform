/**
 * @file report.js
 * @path tests/unit_tests/lib/report.js
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Shared report writer for the erp and api unit test runners. Turns one normalized
 *   run result into `report.html` (summary block + numbered table: test name / pass|fail) and
 *   `report.xml` (JUnit-compatible; every failure carries its category, message, expected and
 *   actual value and the source location).
 * @dependencies
 * - Node.js built-ins only (fs, path).
 *
 * @note Normalized run shape (produced by erp/lib/run.js and api/lib/run.js):
 *   {
 *     target: 'erp' | 'api', group: 'Admin core', command: 'run_admin_core.sh',
 *     startedAt: ISO string, durationMs: number,
 *     tests: [{ suite, name, status: 'passed'|'failed'|'skipped', timeMs,
 *               category?, message?, expected?, actual?, location?, details? }],
 *     coverage?: Coverage | Coverage[]   (array in the combined run - one entry per part)
 *       Coverage = { label?: 'erp' | 'api', metrics?: string[], html?: 'coverage/index.html',
 *                    totals: { <metric>: { covered, total, pct } }, allLoaded,
 *                    files: [{ file, loaded, <metric>: {…}, uncoveredLines }] }
 *               | { label?, unavailable: 'reason' }   (no coverage driver, e.g. pcov missing)
 *       metrics default to statements/branches/functions/lines (erp, istanbul); the api
 *       (PHPUnit + pcov/Xdebug) reports lines and methods - see erp/lib/run.js, api/lib/run.js.
 *     parts?: [{ target, command, total, passed, failed, skipped, durationMs, exitCode }]
 *                (combined run only, see lib/run_all.js)
 *   }
 */

'use strict';

const fs = require('fs');
const path = require('path');

/** Order in which failure categories are listed in the summary. */
const CATEGORY_ORDER = [
  'syntax error', 'parameter mismatch', 'type mismatch', 'missing member or import',
  'compile error', 'build error', 'assertion failed', 'runtime error', 'angular error', 'timeout'
];

/**
 * @description Escapes a value for use in HTML/XML text and attributes.
 * @param {*} value Any value; null/undefined become an empty string.
 * @returns {string} Escaped string.
 */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    // characters that are not allowed in XML 1.0 (e.g. ANSI escape codes from tool output)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

/**
 * @description Counts the run: totals per status and failures per category.
 * @param {object} run Normalized run.
 * @returns {{total:number, passed:number, failed:number, skipped:number, categories:Array<[string, number]>}}
 */
function summarize(run) {
  const s = { total: run.tests.length, passed: 0, failed: 0, skipped: 0, categories: [] };
  const byCategory = new Map();
  for (const t of run.tests) {
    s[t.status] += 1;
    if (t.status === 'failed') {
      const c = t.category || 'runtime error';
      byCategory.set(c, (byCategory.get(c) || 0) + 1);
    }
  }
  const rank = c => (CATEGORY_ORDER.indexOf(c) === -1 ? 99 : CATEGORY_ORDER.indexOf(c));
  s.categories = [...byCategory.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  return s;
}

/**
 * @description Formats milliseconds as a short human readable duration (e.g. "1 min 05 s").
 * @param {number} ms Duration in milliseconds.
 * @returns {string} Formatted duration.
 */
function formatDuration(ms) {
  const sec = Math.round((ms || 0) / 1000);
  if (sec < 60) return `${sec} s`;
  return `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, '0')} s`;
}

/**
 * @description Full name of a test as shown in the report ("Suite › sub-suite › test").
 * @param {object} t Normalized test.
 * @returns {string} Display name.
 */
function fullName(t) {
  return [t.suite, t.name].filter(Boolean).join(' › ');
}

/** Default coverage metrics in display order (istanbul / erp). */
const COVERAGE_METRICS = ['statements', 'branches', 'functions', 'lines'];

/**
 * @description The coverage entries of a run as an array (a single run has one or none,
 *   the combined run one per part).
 * @param {object} run Normalized run.
 * @returns {object[]} Coverage entries.
 */
function coverageList(run) {
  return [].concat(run.coverage || []);
}

/**
 * @description Metrics of one coverage entry in display order.
 * @param {object} cov Coverage entry.
 * @returns {string[]} Metric names.
 */
function metricsOf(cov) {
  return cov.metrics || COVERAGE_METRICS;
}

/**
 * @description Formats one coverage metric, e.g. "97.5 % (39/40)".
 * @param {{covered:number, total:number, pct:number}} m Metric.
 * @returns {string} Formatted metric.
 */
function formatMetric(m) {
  return `${m.pct} % (${m.covered}/${m.total})`;
}

/**
 * @description Compresses line numbers into ranges, e.g. [3,4,5,9] → "3-5, 9".
 * @param {number[]} lines Sorted line numbers.
 * @returns {string} Ranges.
 */
function lineRanges(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let j = i;
    while (j + 1 < lines.length && lines[j + 1] === lines[j] + 1) j++;
    out.push(i === j ? `${lines[i]}` : `${lines[i]}-${lines[j]}`);
    i = j;
  }
  return out.join(', ');
}

/**
 * @description One-line coverage totals, e.g. "lines 100 %, methods 98.5 %".
 * @param {object} cov Coverage entry (not unavailable).
 * @returns {string} Totals text.
 */
function totalsText(cov) {
  return metricsOf(cov).map(k => `${k} ${cov.totals[k].pct} %`).join(', ');
}

/**
 * @description HTML of the coverage summary lines and the per-file coverage tables.
 * @param {object} run Normalized run.
 * @returns {{summary:string, table:string}} Empty strings when the run has no coverage.
 */
function coverageHtml(run) {
  const covs = coverageList(run);
  let summary = '';
  let table = '';
  for (const cov of covs) {
    const title = cov.label ? `Coverage (${esc(cov.label)})` : 'Coverage';
    if (cov.unavailable) {
      summary += `
    <div class="bad"><strong>${title}</strong> – not available: ${esc(cov.unavailable)}</div>`;
      continue;
    }
    const metrics = metricsOf(cov);
    const total = metrics.map(k => `<strong>${k}:</strong> ${esc(formatMetric(cov.totals[k]))}`).join(' &nbsp; ');
    const notLoaded = cov.files.filter(f => !f.loaded).length;
    summary += `
    <div><strong>${title}</strong> – ${total}</div>${notLoaded ? `
    <div class="bad"><strong>Not loaded by any test${cov.label ? ` (${esc(cov.label)})` : ''}:</strong> ${notLoaded} file(s) (0 %)</div>` : ''}
    <div>Line-by-line coverage: ${esc(cov.html || 'coverage/index.html')}</div>`;
    const cell = m => `<td class="${m.pct === 100 ? 'ok' : 'bad'}">${esc(formatMetric(m))}</td>`;
    const rows = cov.files.map(f => f.loaded ? `
      <tr><td>${esc(f.file)}</td>${metrics.map(k => cell(f[k])).join('')}<td>${esc(lineRanges(f.uncoveredLines))}</td></tr>` : `
      <tr><td>${esc(f.file)}</td><td class="bad" colspan="${metrics.length}">not loaded by any test – 0 %</td><td></td></tr>`).join('');
    table += `
  <h2>Coverage per file${cov.label ? ` – ${esc(cov.label)}` : ''}</h2>
  <table class="coverage">
    <thead><tr><th>File</th>${metrics.map(k => `<th>${k[0].toUpperCase()}${k.slice(1)}</th>`).join('')}<th>Uncovered lines</th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>`;
  }
  return { summary, table };
}

/**
 * @description Builds the very simple HTML report.
 * @param {object} run Normalized run.
 * @param {object} s Summary from summarize().
 * @returns {string} HTML document.
 */
function toHtml(run, s) {
  const errors = s.categories.length
    ? s.categories.map(([c, n]) => `${n}× ${esc(c)}`).join(', ')
    : 'none';
  const rows = run.tests.map((t, i) => `
      <tr class="${t.status}">
        <td>${i + 1}</td>
        <td>${esc(fullName(t))}</td>
        <td>${t.status === 'failed' ? 'FAIL' : t.status === 'skipped' ? 'SKIP' : 'PASS'}</td>
      </tr>`).join('');
  const cov = coverageHtml(run);
  const parts = (run.parts || []).map(p => `
    <div><strong>${esc(p.target)}</strong> (${esc(p.command)}): total ${p.total}, passed ${p.passed}, failed ${p.failed}, skipped ${p.skipped}, ${esc(formatDuration(p.durationMs))}</div>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Unit tests – ${esc(run.target)} – ${esc(run.group)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #222; }
  .summary { border: 1px solid #ccc; padding: 12px 16px; margin-bottom: 16px; }
  .summary div { margin: 2px 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; font-size: 14px; }
  th { background: #f2f2f2; }
  td:first-child, td:last-child { width: 1%; white-space: nowrap; }
  tr.failed td:last-child { color: #b00020; font-weight: bold; }
  tr.passed td:last-child { color: #1b7f3b; }
  tr.skipped td:last-child { color: #777; }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  table.coverage td:first-child, table.coverage td:last-child { width: auto; white-space: normal; }
  table.coverage td { white-space: nowrap; }
  .ok { color: #1b7f3b; }
  .bad { color: #b00020; }
</style>
</head>
<body>
  <div class="summary">
    <div><strong>Run:</strong> ${esc(run.target)} – ${esc(run.group)} (${esc(run.command)})</div>
    <div><strong>Started:</strong> ${esc(run.startedAt)}</div>
    <div><strong>Duration:</strong> ${esc(formatDuration(run.durationMs))}</div>
    <div><strong>Total tests:</strong> ${s.total} &nbsp; <strong>Passed:</strong> ${s.passed} &nbsp; <strong>Failed:</strong> ${s.failed} &nbsp; <strong>Skipped:</strong> ${s.skipped}</div>
    <div><strong>Errors:</strong> ${errors}</div>${parts}
    <div>Details of every failure: report.xml</div>${cov.summary}
  </div>
  <table>
    <thead><tr><th>#</th><th>Test</th><th>Result</th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>${cov.table}
</body>
</html>
`;
}

/**
 * @description Builds the JUnit-compatible XML report with failure details.
 * @param {object} run Normalized run.
 * @param {object} s Summary from summarize().
 * @returns {string} XML document.
 */
function toXml(run, s) {
  const secs = ms => ((ms || 0) / 1000).toFixed(3);
  const cases = run.tests.map((t, i) => {
    const head = `    <testcase id="${i + 1}" classname="${esc(t.suite)}" name="${esc(t.name)}" time="${secs(t.timeMs)}"${t.location ? ` file="${esc(t.location)}"` : ''}>`;
    if (t.status === 'skipped') return `${head}\n      <skipped/>\n    </testcase>`;
    if (t.status === 'passed') return `${head}</testcase>`;
    const body = [
      `Category: ${t.category || 'runtime error'}`,
      t.location ? `Location: ${t.location}` : '',
      t.expected !== undefined ? `Expected: ${t.expected}` : '',
      t.actual !== undefined ? `Actual: ${t.actual}` : '',
      t.message ? `Message: ${t.message}` : '',
      t.details ? `\n${t.details}` : ''
    ].filter(Boolean).join('\n');
    return `${head}
      <failure type="${esc(t.category || 'runtime error')}" message="${esc(t.message)}"${t.expected !== undefined ? ` expected="${esc(t.expected)}"` : ''}${t.actual !== undefined ? ` actual="${esc(t.actual)}"` : ''}>${esc(body)}</failure>
    </testcase>`;
  }).join('\n');
  const coverageProps = [];
  for (const cov of coverageList(run)) {
    const prefix = cov.label ? `coverage.${cov.label}` : 'coverage';
    if (cov.unavailable) {
      coverageProps.push(`      <property name="${esc(prefix)}" value="not available: ${esc(cov.unavailable)}"/>`);
      continue;
    }
    const metrics = metricsOf(cov);
    for (const k of metrics) coverageProps.push(`      <property name="${esc(prefix)}.${k}" value="${esc(formatMetric(cov.totals[k]))}"/>`);
    for (const f of cov.files) {
      coverageProps.push(`      <property name="${esc(prefix)}.file ${esc(f.file)}" value="${f.loaded
        ? esc(metrics.map(k => `${k} ${f[k].pct} %`).join(', ') + (f.uncoveredLines.length ? `; uncovered lines ${lineRanges(f.uncoveredLines)}` : ''))
        : 'not loaded by any test – 0 %'}"/>`);
    }
  }
  const categories = s.categories.map(([c, n]) => `      <property name="errors.${esc(c)}" value="${n}"/>`)
    .concat(coverageProps)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="${esc(run.target)} – ${esc(run.group)}" tests="${s.total}" failures="${s.failed}" skipped="${s.skipped}" time="${secs(run.durationMs)}">
  <testsuite name="${esc(run.group)}" tests="${s.total}" failures="${s.failed}" skipped="${s.skipped}" time="${secs(run.durationMs)}" timestamp="${esc(run.startedAt)}">
    <properties>
      <property name="command" value="${esc(run.command)}"/>
      <property name="passed" value="${s.passed}"/>
${categories}
    </properties>
${cases}
  </testsuite>
</testsuites>
`;
}

/**
 * @description Writes report.html and report.xml into the given directory (overwrites the
 *   previous run) and prints the summary, one value per line (total / passed / failed /
 *   skipped / duration; changed 2026-10-24 from a single line). With env UNIT_TESTS_RUN_JSON set, the
 *   normalized run is also written to that file (used by the combined run_all.sh).
 * @param {object} run Normalized run.
 * @param {string} outDir Report directory (created when missing).
 * @returns {object} Summary from summarize().
 */
function writeReport(run, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const s = summarize(run);
  fs.writeFileSync(path.join(outDir, 'report.html'), toHtml(run, s));
  fs.writeFileSync(path.join(outDir, 'report.xml'), toXml(run, s));
  // the combined runner (tests/unit_tests/run_all.sh) merges the parts from these JSON copies
  if (process.env.UNIT_TESTS_RUN_JSON) fs.writeFileSync(process.env.UNIT_TESTS_RUN_JSON, JSON.stringify(run));
  const errors = s.categories.map(([c, n]) => `${n} ${c}`).join(', ');
  // One value per line (easier to read than one long line).
  console.log([
    `\n${run.target} – ${run.group}:`,
    `Total: ${s.total}`,
    `Passed: ${s.passed}`,
    `Failed: ${s.failed}${errors ? ` (${errors})` : ''}`,
    `Skipped: ${s.skipped}`,
    `Duration: ${formatDuration(run.durationMs)}`,
  ].join('\n'));
  for (const cov of coverageList(run)) {
    const label = cov.label ? ` (${cov.label})` : '';
    if (cov.unavailable) { console.log(`Coverage${label}: not available – ${cov.unavailable}`); continue; }
    const notLoaded = cov.files.filter(f => !f.loaded).length;
    console.log(`Coverage${label}: ${totalsText(cov)}${notLoaded ? ` – ${notLoaded} file(s) not loaded by any test` : ''}`);
  }
  // a part of the combined run writes into a temporary folder – the combined runner prints the final path
  if (!process.env.UNIT_TESTS_RUN_JSON) console.log(`Report: ${path.join(outDir, 'report.html')}`);
  return s;
}

/**
 * @description Classifies a TypeScript compiler error and extracts expected/actual values.
 * @param {string} code TS error code, e.g. 'TS2345'.
 * @param {string} message Compiler message.
 * @returns {{category:string, expected?:string, actual?:string}}
 * @note TS1xxx are syntax errors; argument count/type errors are "parameter mismatch" (the
 *   expected parameter type or count vs. what the call actually passes).
 */
function classifyTsError(code, message) {
  const n = Number(String(code).replace(/\D/g, ''));
  let m;
  if (n >= 1000 && n < 2000) return { category: 'syntax error' };
  if ((m = /Argument of type '([\s\S]*?)' is not assignable to parameter of type '([\s\S]*?)'/.exec(message))) {
    return { category: 'parameter mismatch', expected: m[2], actual: m[1] };
  }
  if ((m = /Expected (\S+) arguments?, but got (\S+)/.exec(message))) {
    return { category: 'parameter mismatch', expected: `${m[1]} argument(s)`, actual: `${m[2]} argument(s)` };
  }
  if ((m = /Type '([\s\S]*?)' is not assignable to type '([\s\S]*?)'/.exec(message))) {
    return { category: 'type mismatch', expected: m[2], actual: m[1] };
  }
  if ([2305, 2307, 2339, 2551, 2552, 2304, 2614, 2724].includes(n)) {
    return { category: 'missing member or import' };
  }
  return { category: 'compile error' };
}

module.exports = { writeReport, classifyTsError, summarize, esc };
