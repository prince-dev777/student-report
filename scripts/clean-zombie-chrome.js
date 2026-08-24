import { execSync } from 'child_process';

try {
  const out = execSync('powershell -NoProfile -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Process -Filter \\"Name=\'chrome.exe\'\\" | ForEach-Object { $_.ProcessId.ToString() + \'|\' + $_.CommandLine }"', { encoding: 'utf-8' });
  const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
  let killed = 0;
  for (const line of lines) {
    const [pidStr, ...cmdArr] = line.split('|');
    const cmd = cmdArr.join('|');
    if (cmd && (cmd.includes('wwebjs_auth') || cmd.includes('.wwebjs_cache') || cmd.includes('--headless'))) {
      try {
        execSync(`taskkill /F /PID ${pidStr}`);
        console.log(`✅ Killed zombie headless Chrome PID: ${pidStr}`);
        killed++;
      } catch (err) {}
    }
  }
  console.log(`Cleanup finished. Killed ${killed} zombie Chrome instances.`);
} catch (e) {
  console.log('Cleanup error:', e.message);
}
