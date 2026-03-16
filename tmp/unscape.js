const fs = require('fs');
const authPath = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\components\\AuthPage.js';
let content = fs.readFileSync(authPath, 'utf8');

content = content.replace(/\\\`/g, '`');
content = content.replace(/\\\$/g, '$');

fs.writeFileSync(authPath, content, 'utf8');
console.log('Fixed escaped characters in AuthPage.js');
