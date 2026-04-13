const http = require('http');
http.get('http://localhost:3000/api/games/cm78i9y2a0004b2b2rxyz123', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
}).on('error', err => console.error(err.message));
