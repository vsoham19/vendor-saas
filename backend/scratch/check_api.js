const https = require('https');

function check(url) {
  https.get(url, (res) => {
    console.log(`URL: ${url}`);
    console.log(`Status Code: ${res.statusCode}`);
    console.log('Headers:', res.headers);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Body snippet:', data.substring(0, 500));
      console.log('---');
    });
  }).on('error', (err) => {
    console.error(`Error for ${url}:`, err.message);
  });
}

check('https://vendor-saas-backend.vercel.app/');
check('https://vendor-saas-backend.vercel.app/api/health');
