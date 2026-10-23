/**
 * @file karma.conf.js
 * @path tests/unit_tests/erp/lib/karma.conf.js
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Karma configuration used by the unit test runners. It reuses erp/karma.conf.js
 *   (browser, frameworks, plugins) and adds a reporter that writes every spec result to a JSON
 *   file, which run.js then turns into report.html / report.xml.
 * @dependencies
 * - erp/karma.conf.js: the project's own Karma configuration.
 * - env RESULT_JSON: absolute path of the JSON file to write (set by run.js).
 * - env COVERAGE_DIR: when set (run.js passes --code-coverage), karma-coverage writes
 *   coverage-final.json (read by run.js) and an HTML line-by-line report into this folder.
 */

const path = require('path');
const fs = require('fs');
const baseConfig = require(path.resolve(__dirname, '../../../../erp/karma.conf.js'));

/**
 * @description Karma reporter collecting spec results (suite, name, status, time, failure log).
 * @param {Function} baseReporterDecorator Karma base reporter decorator.
 * @note Errors outside of any spec (e.g. a crash in a top-level describe) are collected from
 *   onBrowserError so they are not lost from the report.
 */
function JsonResultReporter(baseReporterDecorator) {
  baseReporterDecorator(this);
  const results = [];
  const browserErrors = [];

  this.onSpecComplete = (browser, result) => {
    results.push({
      suite: result.suite,
      name: result.description,
      status: result.skipped || result.disabled ? 'skipped' : (result.success ? 'passed' : 'failed'),
      timeMs: result.time,
      log: result.log || []
    });
  };

  this.onBrowserError = (browser, error) => {
    browserErrors.push(typeof error === 'string' ? error : (error && (error.message || JSON.stringify(error))));
  };

  this.onRunComplete = () => {
    const out = process.env.RESULT_JSON;
    if (out) fs.writeFileSync(out, JSON.stringify({ results, browserErrors }, null, 1));
  };
}
JsonResultReporter.$inject = ['baseReporterDecorator'];

module.exports = function (config) {
  baseConfig(config);
  config.set({
    plugins: [...(config.plugins || []), { 'reporter:json-result': ['type', JsonResultReporter] }],
    reporters: process.env.COVERAGE_DIR ? ['dots', 'json-result', 'coverage'] : ['dots', 'json-result'],
    coverageReporter: {
      dir: process.env.COVERAGE_DIR || require('os').tmpdir(),
      subdir: '.',
      reporters: [{ type: 'json', file: 'coverage-final.json' }, { type: 'html' }]
    },
    // desktop-sized window, so layout code that checks window.innerWidth (> 768 px) runs its desktop branch
    customLaunchers: {
      ChromeHeadlessCustom: {
        base: 'ChromeHeadless',
        chromeDataDir: require('os').tmpdir() + '/karma-unit-tests',
        flags: ['--no-sandbox', '--disable-gpu', '--headless=new', '--window-size=1280,900']
      }
    },
    singleRun: true,
    // deterministic order, so the numbering in report.html is stable between runs
    client: { ...(config.client || {}), jasmine: { ...((config.client || {}).jasmine || {}), random: false } },
    autoWatch: false,
    browserNoActivityTimeout: 60000
  });
};
