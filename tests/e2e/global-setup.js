// Before each browser-test run: deletes the coverage from the previous run (tools/e2e-coverage.js).
const fs = require('fs');
const { RAW_DIR } = require('../../tools/e2e-coverage');

module.exports = () => {
  fs.rmSync(RAW_DIR, { recursive: true, force: true });
};
