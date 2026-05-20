// Railway redirect server — replaces the React SPA serve
// Redirects all traffic to https://whisperoo.app preserving path + query string
// so printed QR codes continue to work (e.g. /auth/create?tenant=st-joseph-...)

const http = require('http');

const PORT = process.env.PORT || 3000;
const TARGET = 'https://whisperoo.app';

http.createServer((req, res) => {
  res.writeHead(301, { Location: TARGET + req.url });
  res.end();
}).listen(PORT, () => {
  console.log(`Redirect server on :${PORT} → ${TARGET}`);
});
