const fs = require('fs');
const lines = fs.readFileSync('app.js', 'utf8').split('\n');
console.log(lines.slice(215, 217).join('\n'));
console.log(lines.slice(350, 356).join('\n'));
console.log(lines.slice(360, 365).join('\n'));
console.log(lines.slice(378, 385).join('\n'));
console.log(lines.slice(395, 402).join('\n'));
