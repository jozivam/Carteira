const fs = require('fs');
const code = fs.readFileSync('app.js', 'utf8');

const m = code.match(/function renderDashboard\(\)([\s\S]*?)(?=function)/);
if (m) console.log(m[0]);
