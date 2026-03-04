const http = require('http');
const https = require('https');
const { URL } = require('url');

function doRequest(method, urlStr, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
    };

    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ statusCode: res.statusCode, headers: res.headers, body: text });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const API = process.env.API_URL || 'http://localhost:5000';
  const loginUrl = `${API}/api/auth/login`;
  const meUrl = `${API}/api/auth/me`;

  const payload = JSON.stringify({ firebaseUid: 'test-uid-123', email: 'test@example.com' });

  console.log('POST', loginUrl, 'payload:', payload);
  const loginRes = await doRequest('POST', loginUrl, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  }, payload).catch(err => { console.error('Login request failed:', err); process.exit(1); });

  console.log('Login response:', loginRes.statusCode);
  console.log('Headers:', loginRes.headers);
  console.log('Body:', loginRes.body);

  const setCookie = loginRes.headers['set-cookie'];
  if (!setCookie) {
    console.warn('No Set-Cookie received from login. Subsequent requests will be unauthenticated.');
  }

  const cookieHeader = Array.isArray(setCookie) ? setCookie.map(c => c.split(';')[0]).join('; ') : (setCookie || '').split(';')[0];

  console.log('\nGET', meUrl);
  const meRes = await doRequest('GET', meUrl, cookieHeader ? { Cookie: cookieHeader } : {}).catch(err => { console.error('Me request failed:', err); process.exit(1); });
  console.log('Status:', meRes.statusCode);
  console.log('Headers:', meRes.headers);
  console.log('Body:', meRes.body);
}

main();
