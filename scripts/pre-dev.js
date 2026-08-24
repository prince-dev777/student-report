import { execSync } from 'child_process';

try {
  execSync('taskkill /F /IM electron.exe', { stdio: 'ignore' });
  console.log('✅ Killed running electron.exe processes');
} catch (e) {}

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' });
    const lines = out.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        try {
          execSync(`taskkill /F /PID ${pid}`);
          console.log(`✅ Cleared port ${port} (PID ${pid})`);
        } catch (e) {}
      }
    }
  } catch (e) {}
}

killPort(5173);
killPort(5000);

try {
  const out = execSync('powershell -NoProfile -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Process -Filter \\"Name=\'chrome.exe\'\\" | ForEach-Object { $_.ProcessId.ToString() + \'|\' + $_.CommandLine }"', { encoding: 'utf-8' });
  const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const [pidStr, ...cmdArr] = line.split('|');
    const cmd = cmdArr.join('|');
    if (cmd && (cmd.includes('wwebjs_auth') || cmd.includes('.wwebjs_cache') || cmd.includes('--headless'))) {
      try {
        execSync(`taskkill /F /PID ${pidStr}`);
        console.log(`✅ Killed zombie Chrome PID: ${pidStr}`);
      } catch (err) {}
    }
  }
} catch (e) {}
