const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Server Tes Dasar Berjalan\n');
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Server tes dasar Node.js berjalan di port 3000...');
  console.log('Jika Anda melihat prompt $ lagi, berarti lingkungan OS Anda rusak.');
});
