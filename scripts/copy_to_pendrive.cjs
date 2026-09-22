const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findTargetPendrive() {
  const letters = 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (const letter of letters) {
    const drivePath = `${letter}:\\`;
    if (fs.existsSync(drivePath)) {
      try {
        const keyFile = path.join(drivePath, '.cx_usb_key');
        if (fs.existsSync(keyFile)) {
          return { drive: drivePath, matchReason: '.cx_usb_key found' };
        }
      } catch (e) {}
    }
  }

  // Fallback: Check volume label via wmic/powershell
  try {
    const psCmd = `powershell -NoProfile -Command "Get-Volume | Where-Object { $_.FileSystemLabel -like '*EVM EnX*' } | Select-Object -ExpandProperty DriveLetter"`;
    const letter = execSync(psCmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
    if (letter && fs.existsSync(`${letter}:\\`)) {
      return { drive: `${letter}:\\`, matchReason: 'Volume label EVM EnX matched' };
    }
  } catch (e) {}

  return null;
}

function copyBuildToPendrive() {
  console.log('🔍 Checking for designated pendrive (EVM EnX / .cx_usb_key)...');
  const target = findTargetPendrive();
  
  if (!target) {
    console.log('⚠️ Designated pendrive (EVM EnX) NOT detected. Skipping USB copy.');
    return { success: false, reason: 'Pendrive not connected' };
  }

  console.log(`✅ Designated pendrive detected at ${target.drive} (${target.matchReason})`);

  const distDir = path.join(__dirname, '..', 'dist-electron-v2');
  if (!fs.existsSync(distDir)) {
    console.error('❌ dist-electron-v2 folder not found!');
    return { success: false, reason: 'dist-electron-v2 not found' };
  }

  let files = fs.readdirSync(distDir);
  const spaceExe = files.find(f => f.startsWith('Career Xone Pro Setup') && f.endsWith('.exe'));
  if (spaceExe) {
    const hyphenExe = spaceExe.replace(/ /g, '-');
    try {
      fs.renameSync(path.join(distDir, spaceExe), path.join(distDir, hyphenExe));
      console.log(`🔄 Auto-renamed: "${spaceExe}" -> "${hyphenExe}"`);
      const spaceBlockmap = files.find(f => f.startsWith('Career Xone Pro Setup') && f.endsWith('.blockmap'));
      if (spaceBlockmap) {
        fs.renameSync(path.join(distDir, spaceBlockmap), path.join(distDir, spaceBlockmap.replace(/ /g, '-')));
        console.log(`🔄 Auto-renamed: "${spaceBlockmap}" -> "${spaceBlockmap.replace(/ /g, '-')}"`);
      }
      files = fs.readdirSync(distDir);
    } catch (renameErr) {
      console.warn('Auto-rename warning:', renameErr.message);
    }
  }

  const exeFile = files.find(f => f.startsWith('Career-Xone-Pro-Setup-') && f.endsWith('.exe'));

  if (!exeFile) {
    console.error('❌ No Career-Xone-Pro-Setup-*.exe found in dist-electron-v2!');
    return { success: false, reason: 'Installer exe not found' };
  }

  const srcPath = path.join(distDir, exeFile);
  const destPath = path.join(target.drive, exeFile);
  const srcStats = fs.statSync(srcPath);

  console.log(`📦 Copying ${exeFile} (${(srcStats.size / (1024 * 1024)).toFixed(2)} MB) to ${destPath}...`);
  fs.copyFileSync(srcPath, destPath);

  const destStats = fs.statSync(destPath);
  if (destStats.size !== srcStats.size) {
    console.error(`❌ Size mismatch after copy! Src: ${srcStats.size}, Dest: ${destStats.size}`);
    return { success: false, reason: 'Size mismatch' };
  }

  console.log(`🎉 SUCCESS: ${exeFile} copied to ${target.drive} and 100% verified!`);

  // Also sync portable WhatsApp Backup & Restore Tools to pendrive root
  try {
    const toolsSrc = path.join(__dirname, 'whatsapp_tools');
    const toolsDst = path.join(target.drive, 'whatsapp_tools');
    if (fs.existsSync(toolsSrc)) {
      fs.cpSync(toolsSrc, toolsDst, { recursive: true, force: true });
      console.log(`🛠️ Portable WhatsApp Tools synced to ${toolsDst}`);
    }
  } catch (_) {}

  return { success: true, destPath, size: destStats.size };
}

if (require.main === module) {
  copyBuildToPendrive();
}

module.exports = { findTargetPendrive, copyBuildToPendrive };
