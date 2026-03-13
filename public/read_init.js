const fs = require('fs');
const code = fs.readFileSync('app.js', 'utf8');

const m = code.match(/async function initState\(\)([\s\S]*?)}(\r?\n|\r|$)/);
if (m) console.log(m[0]);
