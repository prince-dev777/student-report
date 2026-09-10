// scripts/postinstall.cjs
// Safe cross-platform postinstall for Desktop & Cloud (Vercel)

if (process.env.VERCEL) {
  console.log('⚡ Vercel serverless environment detected. Skipping desktop postinstall.');
  process.exit(0);
}

const { execSync } = require('child_process');
try {
  console.log('🔧 Running desktop postinstall setup...');
  execSync('cd server && npm install --omit=dev && node download-mongodb.js && cd .. && npm run build', { stdio: 'inherit' });
} catch (err) {
  console.error('Postinstall setup error:', err.message);
  process.exit(1);
}
