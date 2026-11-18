// Ajudantes só dos testes temporários da refatoração (issue #39, documentation/REFACTOR.md seção 4, item 6).
const { expect, waitForApp } = require('../helpers');

/** Grava registros direto num store do IndexedDB do app (dados antigos ou fora do normal que a tela não cria). */
function putRecords(page, store, records) {
  return page.evaluate(({ storeName, items }) => new Promise((resolve, reject) => {
    const open = indexedDB.open('meu-treino');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(storeName, 'readwrite');
      items.forEach((item) => tx.objectStore(storeName).put(item));
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), { storeName: store, items: records });
}

/** Recarrega a página e espera o app montar de novo. */
async function reloadApp(page) {
  await page.reload();
  await waitForApp(page);
}

/**
 * Daqui em diante, toda gravação (`put`) no store `store` do IndexedDB falha, como num aparelho sem espaço.
 * Simula a falha no próprio navegador, sem tocar nas funções do app.
 */
function failWritesTo(page, store) {
  return page.evaluate((storeName) => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === storeName) throw new DOMException('sem espaço no aparelho', 'QuotaExceededError');
      return original.apply(this, args);
    };
  }, store);
}

/** Toda exclusão (`delete`) no store `store` do IndexedDB falha. */
function failDeletesIn(page, store) {
  return page.evaluate((storeName) => {
    const original = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (...args) {
      if (this.name === storeName) throw new DOMException('falhou', 'UnknownError');
      return original.apply(this, args);
    };
  }, store);
}

/** Junta as mensagens de alert() da página; cada uma é aceita. */
function collectAlerts(page) {
  const messages = [];
  page.on('dialog', (dialog) => {
    if (dialog.type() === 'alert') messages.push(dialog.message());
    dialog.accept();
  });
  return messages;
}

/** Espera o modal sumir de vez (a animação do Bootstrap termina antes do próximo passo). */
async function expectModalClosed(modal) {
  await expect(modal).toBeHidden();
}

module.exports = { putRecords, reloadApp, failWritesTo, failDeletesIn, collectAlerts, expectModalClosed };
