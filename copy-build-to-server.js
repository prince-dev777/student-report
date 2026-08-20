import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'dist');
const destDir = path.join(__dirname, 'server', 'public');

if (fs.existsSync(srcDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.cpSync(srcDir, destDir, { recursive: true });
  
  // Fix manifest link in server/public/index.html to always be absolute /manifest.json
  const serverIndexHtml = path.join(destDir, 'index.html');
  if (fs.existsSync(serverIndexHtml)) {
    let content = fs.readFileSync(serverIndexHtml, 'utf8');
    content = content.replace(/href=["'](?:\.\/|\/)?manifest[^"']*["']/g, 'href="/manifest.json"');
    content = content.replace(/href=["']\.\/logo\.png["']/g, 'href="/logo.png"');
    content = content.replace(/href=["']\.\/vite\.svg["']/g, 'href="/vite.svg"');
    fs.writeFileSync(serverIndexHtml, content, 'utf8');
  }
  // Ensure all manifests and sw.js are copied from public/
  const publicDir = path.join(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    const publicFiles = fs.readdirSync(publicDir);
    for (const f of publicFiles) {
      if (f.startsWith('manifest') || f === 'sw.js' || f === 'logo.png') {
        fs.copyFileSync(path.join(publicDir, f), path.join(destDir, f));
      }
    }
  }
  
  console.log('✅ Successfully synced dist/ to server/public/ for cloud deployment!');
} else {
  console.warn('⚠️ dist/ folder not found, skipping sync.');
}
