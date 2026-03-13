const fs = require('fs');
const code = fs.readFileSync('app.js', 'utf8');

const m = code.match(/document\.addEventListener\('DOMContentLoaded'[\s\S]*?render\(\);/);
if (m) console.log(m[0]);
