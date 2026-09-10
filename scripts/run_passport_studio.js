import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Find Python executable (prefer virtualenv server/myenv)
const candidates = [
  path.join(rootDir, 'server', 'myenv', 'Scripts', 'python.exe'),
  path.join(rootDir, 'server', 'myenv', 'bin', 'python'),
  'python'
];

let pythonExe = 'python';
for (const p of candidates) {
  if (p === 'python' || fs.existsSync(p)) {
    pythonExe = p;
    break;
  }
}

const scriptPath = path.join(rootDir, 'scripts', 'ai_passport_photo_studio.py');
const args = [scriptPath, ...process.argv.slice(2)];

console.log(`[PassportStudio] Executing with Python: ${pythonExe}`);
const child = spawn(pythonExe, args, {
  stdio: 'inherit',
  cwd: rootDir,
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
