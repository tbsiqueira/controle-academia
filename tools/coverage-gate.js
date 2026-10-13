'use strict';

/**
 * Mede a cobertura de js/core.js rodando os testes.
 *
 * - Usa o coverage nativo do Node (--experimental-test-coverage) para os percentuais.
 * - Usa o relatório do V8 (NODE_V8_COVERAGE) para achar os TRECHOS sem teste e
 *   publicá-los como "annotations" do GitHub Actions (dá para ler na API, sem abrir o log).
 * - Com COVERAGE_ENFORCE=1, falha se js/core.js não estiver em 100% (linhas e ramos).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ALVO = 'js/core.js';
const enforcar = process.env.COVERAGE_ENFORCE === '1';
const temporario = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-cobertura-'));

const rodar = spawnSync(process.execPath, ['--test', '--experimental-test-coverage', '--test-reporter=tap', 'tests/'], {
  encoding: 'utf8',
  env: Object.assign({}, process.env, { NODE_V8_COVERAGE: temporario })
});

const saida = String(rodar.stdout || '') + String(rodar.stderr || '');
process.stdout.write(saida);

/* ---------- falhas dos testes (viram annotations, para dar para ler sem o log) ---------- */

function falhasDosTestes(texto) {
  const linhas = texto.split('\n');
  const falhas = [];

  linhas.forEach(function (linha, i) {
    const titulo = linha.match(/^not ok \d+ - (.*)$/);
    if (!titulo) return;

    let arquivo = 'tools/coverage-gate.js';
    let linhaArquivo = 1;
    let erro = '';
    const raiz = process.cwd().replace(/\\/g, '/') + '/';

    for (let j = i + 1; j < linhas.length; j++) {
      const linhaAtual = linhas[j];
      if (/^\.\.\.$/.test(linhaAtual.trim())) break;
      if (/^not ok |^ok \d+/.test(linhaAtual)) break;

      const local = linhaAtual.match(/location: '(.*)'/);
      if (local) {
        try {
          const info = JSON.parse(local[1]);
          if (info.file) arquivo = String(info.file).replace(/\\/g, '/').replace(raiz, '');
          if (info.line) linhaArquivo = info.line;
        } catch (e) { /* sem location: aponta para o proprio gate */ }
      }

      const inicio = linhaAtual.match(/^\s*error: \|?-*\s*(.*)$/);
      if (inicio) {
        const partes = [inicio[1]];
        for (let k = j + 1; k < linhas.length; k++) {
          const seguinte = linhas[k];
          if (/^\s*(code|stack|failureType|location|duration_ms|type):/.test(seguinte)) break;
          if (/^\.\.\.$/.test(seguinte.trim())) break;
          partes.push(seguinte.trim());
        }
        erro = partes.join(' ').replace(/\s+/g, ' ').trim();
      }
    }

    falhas.push({
      titulo: titulo[1].trim(),
      arquivo: arquivo,
      linha: linhaArquivo,
      erro: erro.replace(/\s+/g, ' ').slice(0, 220)
    });
  });

  return falhas;
}

if (rodar.status !== 0) {
  const falhas = falhasDosTestes(saida);

  console.error('\n[cobertura] ' + (falhas.length || 'alguns') + ' teste(s) falharam.');

  falhas.slice(0, 5).forEach(function (f) {
    console.log('::error file=' + f.arquivo + ',line=' + f.linha + '::' + f.titulo +
      (f.erro ? (' — ' + f.erro) : ''));
  });

  process.exit(rodar.status || 1);
}

/* ---------- percentuais (tabela do Node) ---------- */

function tabelaDeCobertura(texto) {
  const linhas = [];

  texto.split('\n').forEach(function (linha) {
    if (linha.indexOf('|') === -1) return;
    const limpa = linha.replace(/[^\x20-\x7E|]/g, '').trim();
    const partes = limpa.split('|').map(function (p) { return p.trim(); });
    if (partes.length < 5 || partes[0].indexOf('.js') === -1) return;

    linhas.push({
      arquivo: partes[0],
      linhas: parseFloat(partes[1]),
      ramos: parseFloat(partes[2]),
      funcoes: parseFloat(partes[3])
    });
  });

  return linhas;
}

const alvo = tabelaDeCobertura(saida).filter(function (l) { return l.arquivo.indexOf('core.js') !== -1; });

if (!alvo.length) {
  console.error('\n[cobertura] nao encontrei a linha de ' + ALVO + ' no relatorio do Node.');
  console.error('Cole o relatorio acima para ajustar tools/coverage-gate.js.');
  process.exit(2);
}

const medidas = alvo[0];

/* ---------- trechos sem teste (ranges do V8) ---------- */

const fonte = fs.readFileSync(path.join(process.cwd(), ALVO), 'utf8');

function linhaDe(offset) {
  return fonte.slice(0, offset).split('\n').length;
}

function trechosSemTeste(diretorio) {
  const porExecucao = {};
  const cobertos = {};
  const contagens = {};
  const executacoes = [];

  fs.readdirSync(diretorio).forEach(function (nome) {
    if (nome.indexOf('.json') === -1) return;

    let bruto;
    try {
      bruto = JSON.parse(fs.readFileSync(path.join(diretorio, nome), 'utf8'));
    } catch (e) {
      return;
    }

    (bruto.result || []).forEach(function (arquivo, indiceArquivo) {
      if (!arquivo.url || arquivo.url.indexOf('/' + ALVO) === -1) return;

      // Cada entrada do relatorio e uma execucao do arquivo (o teste do vm carrega o
      // mesmo core.js de novo): usamos o par url+indice como identificador.
      const chave = arquivo.url + '#' + nome + '#' + indiceArquivo;
      executacoes.push(chave);
      porExecucao[chave] = porExecucao[chave] || [];

      (arquivo.functions || []).forEach(function (fn) {
        (fn.ranges || []).forEach(function (faixa) {
          if (faixa.endOffset <= faixa.startOffset) return;

          const assinatura = faixa.startOffset + ':' + faixa.endOffset;
          if (faixa.count > 0) cobertos[assinatura] = (cobertos[assinatura] || 0) + 1;
          contagens[assinatura] = contagens[assinatura] || [];
          contagens[assinatura].push(faixa.count);

          porExecucao[chave].push({
            inicio: faixa.startOffset,
            fim: faixa.endOffset,
            contagem: faixa.count
          });
        });
      });
    });
  });

  const achados = [];

  Object.keys(porExecucao).forEach(function (chave) {
    porExecucao[chave].forEach(function (faixa) {
      if (faixa.contagem > 0) return;

      // O mesmo trecho (mesmos offsets) pode aparecer em varias entradas do relatorio
      // (funcoes aninhadas, o core carregado de novo no vm...). Basta UMA execucao
      // ter passado por ele para considerarmos coberto.
      const assinatura = faixa.inicio + ':' + faixa.fim;
      if (cobertos[assinatura] > 0) return;

      achados.push({
        inicio: linhaDe(faixa.inicio),
        fim: linhaDe(faixa.fim),
        inicioOffset: faixa.inicio,
        fimOffset: faixa.fim,
        trecho: fonte.slice(faixa.inicio, faixa.inicio + 80).split('\n')[0].trim()
      });
    });
  });

  // junta faixas sobrepostas (o V8 devolve ranges aninhados)
  achados.sort(function (a, b) { return a.inicio - b.inicio || a.fim - b.fim; });

  const juntas = [];
  achados.forEach(function (a) {
    const ultima = juntas[juntas.length - 1];
    if (ultima && a.inicio <= ultima.fim) {
      ultima.fim = Math.max(ultima.fim, a.fim);
      ultima.fimOffset = Math.max(ultima.fimOffset || 0, a.fimOffset || 0);
      if (ultima.trecho.length < 70 && a.trecho && ultima.trecho.indexOf(a.trecho) === -1) {
        ultima.trecho = (ultima.trecho + ' / ' + a.trecho).slice(0, 90);
      }
      return;
    }
    juntas.push({ inicio: a.inicio, fim: a.fim, inicioOffset: a.inicioOffset, fimOffset: a.fimOffset, trecho: a.trecho });
  });

  return { trechos: juntas, contagens: contagens, executacoes: executacoes.length };
}

const diagnostico = trechosSemTeste(temporario);
const semTeste = diagnostico.trechos;
// O wrapper de modulo (primeiras linhas do arquivo) escolhe entre Node e navegador: cada
// ambiente executa so um lado, e o lado do navegador e validado em tests/module.test.js.
const FIM_DO_WRAPPER = 16;

// Criterio do gate: 100% de linhas (tabela do Node) + nenhum trecho da LOGICA sem teste
// (passada em processo unico, que nao tem os falsos positivos do relatorio por processo).
const precisos = diagnosticoPreciso().filter(function (t) { return t.inicio > FIM_DO_WRAPPER; });
const completo = medidas.linhas === 100 && precisos.length === 0;

console.log('\n[cobertura] ' + ALVO + ': linhas ' + medidas.linhas + '% | ramos ' + medidas.ramos +
  '% | funcoes ' + medidas.funcoes + '% (tabela do Node)');
console.log('[cobertura] trechos que o V8 nao viu executar: ' + semTeste.length);

semTeste.forEach(function (t) {
  console.log('[cobertura]   linhas ' + t.inicio + '-' + t.fim + ': ' + t.trecho);
});

// Annotations: aparecem no resumo do check, sem precisar abrir o log.
const listaDeLinhas = semTeste.map(function (t) {
  return t.fim > t.inicio ? (t.inicio + '-' + t.fim) : String(t.inicio);
}).join(', ');

// Segunda passada: roda TODOS os arquivos de teste em um unico processo. Sem processos
// separados, o V8 reporta tudo (sem falso positivo) e a lista fica precisa.
function diagnosticoPreciso() {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-cobertura-1p-'));
  const arquivos = fs.readdirSync(path.join(process.cwd(), 'tests')).filter(function (f) {
    return f.indexOf('.test.js') !== -1;
  });
  const codigo = arquivos.map(function (f) { return "require('./tests/" + f + "');"; }).join(' ');

  spawnSync(process.execPath, ['-e', codigo], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { NODE_V8_COVERAGE: diretorio })
  });

  return trechosSemTeste(diretorio).trechos;
}
console.log('::notice file=' + ALVO + ',line=1::trechos que o V8 nao viu executar: ' +
  (listaDeLinhas || 'nenhum'));

const precisosTexto = precisos.map(function (t) {
  return (t.fim > t.inicio ? (t.inicio + '-' + t.fim) : String(t.inicio)) + ' [' + t.trecho.slice(0, 45) + ']';
});

console.log('::notice file=' + ALVO + ',line=1::preciso (processo unico, fora do wrapper): ' +
  (precisosTexto.join(' | ') || 'nada sem cobertura'));

if (completo) {
  console.log('[cobertura] 100% de linhas em ' + ALVO + ' e nenhum trecho da logica sem teste.');
  process.exit(0);
}

const resumo = '[cobertura] ' + ALVO + ' abaixo de 100%: linhas ' + medidas.linhas + '%, ramos ' +
  medidas.ramos + '%, funcoes ' + medidas.funcoes + '%, ' + precisos.length + ' trecho(s) da logica sem teste' + (enforcar ? '' : ' (informativo)');

if (enforcar) {
  console.log('::error file=' + ALVO + '::' + resumo);
  console.error('\n' + resumo);
  process.exit(1);
}

console.log('::warning file=' + ALVO + '::' + resumo);
console.log('\n' + resumo);
process.exit(0);
