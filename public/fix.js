const fs = require('fs');

let app = fs.readFileSync('app.js', 'utf8');

// The file has syntax errors due to 'await database.X' in non-async functions. Let's fix them.
const functionsToAsync = [
    'window.deleteTransaction = function',
    'window.updateUser = function',
    'function saveDraft',
    'function updateDraft',
    'function handleImageUpload', // Note: handleImageUpload does `await` in onload/onchange... we need to make those handlers async, but let's just use string replacement carefully.
];

app = app.replace('window.deleteTransaction = function(txId) {', 'window.deleteTransaction = async function(txId) {');
app = app.replace('window.updateUser = function(key, val) {', 'window.updateUser = async function(key, val) {');

// The image upload uses await database.set in an onload handler
app = app.replace('reader.onload = (evt) => {', 'reader.onload = async (evt) => {');

// The draft functions didn't get caught because of another name, or maybe my replace didn't work.
app = app.replace('function updateDraft() {', 'async function updateDraft() {');

// Ensure saveDraft is async (if not already)
if (!app.includes('async function saveDraft()')) {
    app = app.replace('function saveDraft() {', 'async function saveDraft() {');
}

fs.writeFileSync('app.js', app);
console.log('Fixed app.js');
