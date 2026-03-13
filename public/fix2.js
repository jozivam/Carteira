const fs = require('fs');

let code = fs.readFileSync('app.js', 'utf8');

const patterns = [
  'function setType(type)',
  'window.saveTransaction = function()',
  'window.cancelTransaction = function()',
  'window.deleteTransaction = function(txId)',
  'window.updateStatus = function(id, newStatus)',
  'window.filterTransactions = function(walletId)',
  'window.clearAllData = function()',
  'window.updateUser = function(key, val)',
  'function saveDraft()',
  'function restoreDraft()',
  'function updateDraft()',
  'function addToOfflineQueue(tx)'
];

for (const p of patterns) {
    if (code.includes('async ' + p)) continue;
    let newP = p.replace('function', 'async function');
    code = code.replace(p, newP);
}

// Special cases handles like DOMContentLoaded
code = code.replace(/document\.addEventListener\('DOMContentLoaded', \(\) => \{/, "document.addEventListener('DOMContentLoaded', async () => {");
code = code.replace(/reader\.onload = \(evt\) => \{/, "reader.onload = async (evt) => {");

fs.writeFileSync('app.js', code);
