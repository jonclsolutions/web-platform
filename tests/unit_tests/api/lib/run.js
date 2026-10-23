/**
 * @file run.js
 * @path tests/unit_tests/api/lib/run.js
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Runs the Laravel (PHPUnit) tests of the api and writes
 *   tests/unit_tests/api/report/report.html + report.xml.
 *   1. PHPUnit writes a JUnit log; this script converts it to the shared report format and
 *      classifies every failure (syntax error, parameter mismatch, assertion failed, …) with
 *      the expected and actual value where PHPUnit reports them.
 *   2. Code coverage (pcov or Xdebug) of the section's source files - lines and methods per
 *      file, uncovered line numbers; line-by-line detail in report/coverage/index.html.
 *      The section → files mapping is ./sections.js. Without a coverage driver the tests
 *      still run and the report says "coverage not available". `--no-coverage` switches
 *      the measurement off.
 * @dependencies
 * - PHP 8.2+, api/vendor (composer install in api/), optional pcov or Xdebug for coverage.
 * - ../../lib/report.js, ./sections.js
 * - env UNIT_TESTS_REPORT_DIR (optional): report folder instead of tests/unit_tests/api/report.
 *
 * @usage node run.js --group "Core" --command run_core.sh --suite Core [--no-coverage]
 *        node run.js --group "All" --command run_all_api.sh        (every test suite)
 * @note The suites (Core, Web, Shop, Other) are defined in api/phpunit.xml. For coverage the
 *   runner writes a temporary copy of phpunit.xml whose <source> lists only the section's
 *   files (absolute paths), so the HTML report shows exactly the measured files.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { writeReport, esc } = require('../../lib/report');
const { SECTIONS } = require('./sections');

const REPO = path.resolve(__dirname, '../../../..');
const API = path.join(REPO, 'api');
// UNIT_TESTS_REPORT_DIR: set by the combined runner (tests/unit_tests/lib/run_all.js)
const REPORT_DIR = process.env.UNIT_TESTS_REPORT_DIR || path.resolve(__dirname, '../report');
const TMP_DIR = path.join(REPORT_DIR, '.tmp');
const COVERAGE_DIR = path.join(REPORT_DIR, 'coverage');

/**
 * @description Parses --group, --command, --suite and --no-coverage from the command line.
 * @returns {{group:string, command:string, suite:string|null, coverage:boolean}}
 */
function parseArgs() {
  const a = process.argv.slice(2);
  const out = { group: 'All', command: 'run_all_api.sh', suite: null, coverage: true };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--no-coverage') out.coverage = false;
    else if (a[i] === '--group') out.group = a[++i];
    else if (a[i] === '--command') out.command = a[++i];
    else if (a[i] === '--suite') out.suite = a[++i];
  }
  return out;
}

/**
 * @description Decodes the XML entities PHPUnit uses in its JUnit log.
 * @param {string} s Encoded text.
 * @returns {string} Decoded text.
 */
function decode(s) {
  return String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
}

/**
 * @description Reads the attributes of one XML start tag.
 * @param {string} tag Start tag text.
 * @returns {Object<string,string>} Attribute map (decoded).
 */
function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out[m[1]] = decode(m[2]);
  return out;
}

/**
 * @description Classifies a PHPUnit failure/error and extracts expected/actual values.
 * @param {string} type Exception class reported by PHPUnit.
 * @param {string} text Failure text (message + stack).
 * @returns {{category:string, message:string, expected?:string, actual?:string}}
 */
function classify(type, text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const message = lines.find(l => !/::test/.test(l)) || lines[0] || type;
  let m;
  if (/ParseError/.test(type)) return { category: 'syntax error', message };
  if (/ArgumentCountError/.test(type)) {
    m = /(\d+) passed .* (?:exactly|at least) (\d+) expected/.exec(text);
    return { category: 'parameter mismatch', message, ...(m ? { expected: `${m[2]} argument(s)`, actual: `${m[1]} argument(s)` } : {}) };
  }
  if (/TypeError/.test(type)) {
    m = /must be of type ([^,]+), (.+?) given/.exec(text);
    return { category: 'parameter mismatch', message, ...(m ? { expected: m[1], actual: m[2] } : {}) };
  }
  if (/ExpectationFailedException|AssertionFailedError/.test(type)) {
    m = /Failed asserting that ([\s\S]+?) (?:is identical to|matches expected|is equal to) ([\s\S]+?)\.\s*$/m.exec(text);
    return { category: 'assertion failed', message, ...(m ? { expected: m[2], actual: m[1] } : {}) };
  }
  return { category: 'runtime error', message };
}

/**
 * @description Converts the PHPUnit JUnit log into normalized tests.
 * @param {string} xml JUnit XML written by PHPUnit.
 * @returns {object[]} Normalized tests.
 */
function parseJunit(xml) {
  const tests = [];
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let m;
  while ((m = re.exec(xml))) {
    const a = attrs(m[1]);
    const body = m[3] || '';
    const file = a.file ? path.relative(REPO, a.file) : undefined;
    const t = { suite: a.class || a.classname || '', name: a.name, timeMs: Math.round(parseFloat(a.time || '0') * 1000),
      status: 'passed', location: file ? `${file}:${a.line || ''}` : undefined };
    const f = /<(failure|error)\b([^>]*)>([\s\S]*?)<\/\1>/.exec(body);
    if (f) {
      const text = decode(f[3]);
      Object.assign(t, { status: 'failed', details: text.trim() }, classify(attrs(f[2]).type || f[1], text));
      const loc = /([^\s]+\.php):(\d+)\s*$/m.exec(text);
      if (loc) t.location = `${path.relative(REPO, loc[1])}:${loc[2]}`;
    } else if (/<skipped\b/.test(body)) {
      t.status = 'skipped';
    }
    tests.push(t);
  }
  return tests;
}

/**
 * @description Builds failure entries from PHPUnit's console output when it crashed before
 *   writing a JUnit log (e.g. a syntax error in a test file).
 * @param {string} output Combined stdout/stderr.
 * @returns {object[]} Normalized failed tests.
 */
function crashErrors(output) {
  // PHPUnit 10+: "An error occurred inside PHPUnit. Message: … Location: file.php:12"
  const inner = /Message:\s+(.+)\s*\nLocation:\s+(\S+?\.php):(\d+)/.exec(output);
  if (inner) {
    const file = path.relative(REPO, inner[2]);
    return [{ suite: file, name: `load (line ${inner[3]})`, status: 'failed', timeMs: 0,
      category: /syntax error/i.test(inner[1]) ? 'syntax error' : 'runtime error', message: inner[1].trim(),
      location: `${file}:${inner[3]}`, details: output.trim().split('\n').slice(0, 20).join('\n') }];
  }
  const m = /(PHP )?(Parse error|Fatal error)[^:]*:\s*(.+?) in (\S+?\.php)(?: on line |:)(\d+)/.exec(output);
  if (m) {
    return [{ suite: path.relative(REPO, m[4]), name: `load (line ${m[5]})`, status: 'failed', timeMs: 0,
      category: /Parse/.test(m[2]) ? 'syntax error' : 'runtime error', message: m[3],
      location: `${path.relative(REPO, m[4])}:${m[5]}`, details: output.trim().split('\n').slice(-40).join('\n') }];
  }
  return [{ suite: 'PHPUnit', name: 'test run', status: 'failed', timeMs: 0, category: 'build error',
    message: 'PHPUnit did not write a result log – see details.', details: output.trim().split('\n').slice(-60).join('\n') }];
}

/**
 * @description Which coverage driver the local PHP has.
 * @returns {'pcov'|'xdebug'|null} Driver name, null when none is installed.
 */
function coverageDriver() {
  const r = spawnSync('php', ['-r', "echo extension_loaded('pcov') ? 'pcov' : (extension_loaded('xdebug') ? 'xdebug' : '');"], { encoding: 'utf8' });
  return (r.stdout || '').trim() || null;
}

/**
 * @description The <source> element of the temporary phpunit config: the files of the
 *   section (core/web/shop), everything outside those three (other), or all of app/ (All).
 * @param {string|null} section Lower-case section name, null = all.
 * @returns {string} XML of the <source> element.
 */
function sourceXml(section) {
  const entry = p => (p.endsWith('/')
    ? `<directory suffix=".php">${esc(path.join(API, p))}</directory>`
    : `<file>${esc(path.join(API, p))}</file>`);
  if (section && SECTIONS[section]) {
    return `<source><include>${SECTIONS[section].map(entry).join('')}</include></source>`;
  }
  const exclude = section === 'other'
    ? `<exclude>${['core', 'web', 'shop'].flatMap(n => SECTIONS[n]).map(entry).join('')}</exclude>` : '';
  return `<source><include>${entry('app/')}</include>${exclude}</source>`;
}

/**
 * @description Writes a copy of api/phpunit.xml with absolute paths and the section's
 *   <source>, so the coverage (clover + html) covers exactly the measured files.
 * @param {string|null} section Lower-case section name, null = all.
 * @returns {string} Path of the temporary config.
 */
function writeCoverageConfig(section) {
  let xml = fs.readFileSync(path.join(API, 'phpunit.xml'), 'utf8');
  xml = xml
    .replace(/bootstrap="([^"]+)"/, (_, p) => `bootstrap="${esc(path.join(API, p))}"`)
    .replace(/xsi:noNamespaceSchemaLocation="([^"]+)"/, (_, p) => `xsi:noNamespaceSchemaLocation="${esc(path.join(API, p))}"`)
    .replace(/<(directory|exclude|file)>([^<]+)<\/\1>/g, (_, tag, p) => `<${tag}>${esc(path.join(API, p))}</${tag}>`)
    .replace(/<source>[\s\S]*?<\/source>/, sourceXml(section));
  const file = path.join(TMP_DIR, 'phpunit.coverage.xml');
  fs.writeFileSync(file, xml);
  return file;
}

/**
 * @description Summarizes the clover report: lines (executable statements) and methods per
 *   file. Files without executable code (interfaces, empty base classes) are left out;
 *   a file with code of which no line ran counts as "not loaded by any test".
 * @param {string} cloverFile Clover XML written by PHPUnit.
 * @returns {object|undefined} Coverage entry for report.js, undefined without a clover file.
 */
function summarizeCoverage(cloverFile) {
  if (!fs.existsSync(cloverFile)) return undefined;
  const xml = fs.readFileSync(cloverFile, 'utf8');
  const metric = (covered, total) => ({ covered, total, pct: total ? Math.floor(covered / total * 10000) / 100 : 100 });
  const sum = { lines: [0, 0], methods: [0, 0] };
  const files = [];
  for (const m of xml.matchAll(/<file name="([^"]+)">([\s\S]*?)<\/file>/g)) {
    const body = m[2];
    const fm = [...body.matchAll(/<metrics [^>]*?\/>/g)].pop();
    const a = fm ? attrs(fm[0]) : {};
    const statements = +a.statements || 0;
    if (!statements) continue;
    const coveredStatements = +a.coveredstatements || 0;
    const methods = +a.methods || 0;
    const coveredMethods = +a.coveredmethods || 0;
    sum.lines[0] += coveredStatements; sum.lines[1] += statements;
    sum.methods[0] += coveredMethods; sum.methods[1] += methods;
    const uncoveredLines = [...body.matchAll(/<line num="(\d+)" type="stmt"[^>]*count="0"/g)].map(l => +l[1]).sort((x, y) => x - y);
    files.push({
      file: path.relative(API, decode(m[1])).split(path.sep).join('/'),
      loaded: coveredStatements > 0,
      lines: metric(coveredStatements, statements),
      methods: metric(coveredMethods, methods),
      uncoveredLines
    });
  }
  files.sort((x, y) => x.file.localeCompare(y.file));
  return {
    metrics: ['lines', 'methods'],
    totals: { lines: metric(...sum.lines), methods: metric(...sum.methods) },
    allLoaded: files.every(f => f.loaded),
    files
  };
}

/** Entry point. */
function main() {
  const { group, command, suite, coverage } = parseArgs();
  const started = Date.now();
  const phpunit = path.join(API, 'vendor', 'bin', 'phpunit');
  if (!fs.existsSync(phpunit)) {
    console.error('api/vendor is missing – run `composer install` in api/ first.');
    process.exit(2);
  }

  fs.mkdirSync(TMP_DIR, { recursive: true });
  const junit = path.join(TMP_DIR, 'junit.xml');
  fs.rmSync(junit, { force: true });
  const args = [phpunit, '--colors=never', '--log-junit', junit, ...(suite ? ['--testsuite', suite] : [])];
  const phpArgs = [];
  const env = { ...process.env };
  const clover = path.join(TMP_DIR, 'clover.xml');
  let coverageEntry;
  if (coverage) {
    const driver = coverageDriver();
    if (!driver) {
      coverageEntry = { unavailable: 'no coverage driver in PHP – install pcov (Fedora: `sudo dnf install php-pecl-pcov`, Debian/Ubuntu: `sudo apt install php-pcov`) or Xdebug.' };
    } else {
      fs.rmSync(COVERAGE_DIR, { recursive: true, force: true });
      args.push('--configuration', writeCoverageConfig(suite ? suite.toLowerCase() : null),
        '--coverage-clover', clover, '--coverage-html', COVERAGE_DIR);
      if (driver === 'pcov') phpArgs.push('-d', 'pcov.enabled=1', '-d', `pcov.directory=${path.join(API, 'app')}`);
      else env.XDEBUG_MODE = 'coverage';
    }
  }
  console.log(`${group}: running PHPUnit${suite ? ` (suite ${suite})` : ''}${args.includes('--coverage-clover') ? ' with code coverage' : ''}…`);
  const r = spawnSync('php', [...phpArgs, ...args], { cwd: API, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const output = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(output.split('\n').filter(l => /^(OK|Tests:|FAILURES|ERRORS|No tests)/.test(l)).join('\n') + '\n');

  const log = fs.existsSync(junit) ? fs.readFileSync(junit, 'utf8') : '';
  const tests = log.trim() ? parseJunit(log) : crashErrors(output);
  if (log.trim() && r.status !== 0 && !tests.some(t => t.status === 'failed')) tests.push(...crashErrors(output));
  if (args.includes('--coverage-clover')) {
    coverageEntry = summarizeCoverage(clover)
      || { unavailable: 'PHPUnit did not write a coverage report – see the console output.' };
  }

  const summary = writeReport({
    target: 'api', group, command, startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started, tests, coverage: coverageEntry
  }, REPORT_DIR);
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  process.exit(summary.failed > 0 ? 1 : 0);
}

main();
