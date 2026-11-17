// Antes de cada execução dos testes de navegador: apaga a cobertura da execução anterior (tools/e2e-coverage.js).
const fs = require('fs');
const { RAW_DIR } = require('../../tools/e2e-coverage');

module.exports = () => {
  fs.rmSync(RAW_DIR, { recursive: true, force: true });
};
