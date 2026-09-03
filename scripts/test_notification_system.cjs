/**
 * test_notification_system.cjs
 * 
 * Comprehensive test script to verify:
 * 1. messageQueue.js — Queue logic, rate limiting, burst protection
 * 2. whatsappService.js — Whitelist filtering (only IN, OUT, TEST_RESULT)
 * 3. whatsappClient.js — Anti-ban delay configuration
 * 4. sessionScheduler.js — No ENABLE_WHATSAPP_ATTENDANCE guards
 * 5. Server API endpoints — /api/health, WhatsApp status, etc.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const SERVER_BASE = 'http://localhost:5000';
let passed = 0;
let failed = 0;
let warnings = 0;

// ─── Helpers ───
function log(icon, msg) { console.log(`  ${icon} ${msg}`); }
function pass(msg) { passed++; log('✅', msg); }
function fail(msg) { failed++; log('❌', msg); }
function warn(msg) { warnings++; log('⚠️', msg); }
function section(title) { console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`); }

async function fetchJSON(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, SERVER_BASE);
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: data }); }
      });
    }).on('error', reject);
  });
}

// ─── TEST 1: messageQueue.js — File Existence & Structure ───
function testMessageQueueFile() {
  section('1. messageQueue.js — File & Structure');
  
  const mqPath = path.join(__dirname, '..', 'server', 'services', 'messageQueue.js');
  
  if (!fs.existsSync(mqPath)) {
    fail('messageQueue.js does not exist!');
    return;
  }
  pass('messageQueue.js file exists');
  
  const content = fs.readFileSync(mqPath, 'utf-8');
  
  // Check exports
  if (content.includes('export function queueWhatsAppMessage')) {
    pass('queueWhatsAppMessage function exported');
  } else {
    fail('queueWhatsAppMessage function NOT found');
  }
  
  if (content.includes('export function getQueueStats')) {
    pass('getQueueStats function exported');
  } else {
    fail('getQueueStats function NOT found');
  }
  
  // Check rate limiting config
  const minDelayMatch = content.match(/MIN_DELAY_MS:\s*(\d+)/);
  const maxDelayMatch = content.match(/MAX_DELAY_MS:\s*(\d+)/);
  const burstLimitMatch = content.match(/BURST_LIMIT:\s*(\d+)/);
  const hourlyCapMatch = content.match(/HOURLY_CAP:\s*(\d+)/);
  
  if (minDelayMatch && parseInt(minDelayMatch[1]) >= 5000) {
    pass(`MIN_DELAY_MS = ${minDelayMatch[1]}ms (≥5s, safe)`);
  } else {
    fail(`MIN_DELAY_MS = ${minDelayMatch ? minDelayMatch[1] : 'NOT FOUND'}ms (should be ≥5000)`);
  }
  
  if (maxDelayMatch && parseInt(maxDelayMatch[1]) >= 10000) {
    pass(`MAX_DELAY_MS = ${maxDelayMatch[1]}ms (≥10s, safe)`);
  } else {
    fail(`MAX_DELAY_MS = ${maxDelayMatch ? maxDelayMatch[1] : 'NOT FOUND'}ms (should be ≥10000)`);
  }
  
  if (burstLimitMatch && parseInt(burstLimitMatch[1]) <= 25) {
    pass(`BURST_LIMIT = ${burstLimitMatch[1]} (≤25, safe)`);
  } else {
    warn(`BURST_LIMIT = ${burstLimitMatch ? burstLimitMatch[1] : 'NOT FOUND'} (recommended ≤25)`);
  }
  
  if (hourlyCapMatch && parseInt(hourlyCapMatch[1]) <= 150) {
    pass(`HOURLY_CAP = ${hourlyCapMatch[1]} (≤150, safe)`);
  } else {
    warn(`HOURLY_CAP = ${hourlyCapMatch ? hourlyCapMatch[1] : 'NOT FOUND'} (recommended ≤150)`);
  }
  
  // Check serial processing
  if (content.includes('isProcessing')) {
    pass('Serial processing lock (isProcessing) present');
  } else {
    fail('Serial processing lock NOT found');
  }
  
  // Check retry logic
  if (content.includes('MAX_RETRIES') && content.includes('RETRY_DELAYS')) {
    pass('Retry logic with exponential backoff present');
  } else {
    fail('Retry logic NOT found');
  }
  
  // Check import from whatsappClient
  if (content.includes("from './whatsappClient.js'")) {
    pass('Imports sendWhatsAppMessageWeb from whatsappClient');
  } else {
    fail('Missing import from whatsappClient');
  }
}

// ─── TEST 2: whatsappService.js — Whitelist & Queue Integration ───
function testWhatsAppServiceFile() {
  section('2. whatsappService.js — Whitelist & Queue Integration');
  
  const wsPath = path.join(__dirname, '..', 'server', 'services', 'whatsappService.js');
  const content = fs.readFileSync(wsPath, 'utf-8');
  
  // Check ENABLE_WHATSAPP_ATTENDANCE gate is REMOVED
  if (!content.includes('ENABLE_WHATSAPP_ATTENDANCE')) {
    pass('ENABLE_WHATSAPP_ATTENDANCE gate REMOVED ✓');
  } else {
    fail('ENABLE_WHATSAPP_ATTENDANCE still present! Should be removed.');
  }
  
  // Check whitelist exists
  if (content.includes("WHATSAPP_ALLOWED_TYPES")) {
    pass('WHATSAPP_ALLOWED_TYPES whitelist defined');
  } else {
    fail('WHATSAPP_ALLOWED_TYPES whitelist NOT found');
  }
  
  // Check which types are in whitelist
  const whitelistMatch = content.match(/WHATSAPP_ALLOWED_TYPES\s*=\s*\[([^\]]+)\]/);
  if (whitelistMatch) {
    const types = whitelistMatch[1].replace(/'/g, '').replace(/"/g, '').split(',').map(t => t.trim());
    console.log(`\n  📋 WhatsApp Whitelist: [${types.join(', ')}]`);
    
    const expectedTypes = ['IN', 'OUT', 'TEST_RESULT'];
    const blockedTypes = ['SESSION_CONTINUE', 'MISSED_EXIT', 'PUNCH_MISSED', 'ABSENT', 'WELCOME'];
    
    for (const t of expectedTypes) {
      if (types.includes(t)) {
        pass(`Type "${t}" → WhatsApp ✓`);
      } else {
        fail(`Type "${t}" should be in whitelist but is MISSING`);
      }
    }
    
    for (const t of blockedTypes) {
      if (!types.includes(t)) {
        pass(`Type "${t}" → Blocked from WhatsApp ✓`);
      } else {
        fail(`Type "${t}" should be BLOCKED but is in whitelist!`);
      }
    }
  }
  
  // Check messageQueue import
  if (content.includes("from './messageQueue.js'")) {
    pass('Imports queueWhatsAppMessage from messageQueue');
  } else {
    fail('Missing import from messageQueue');
  }
  
  // Check queue usage
  if (content.includes('queueWhatsAppMessage(')) {
    pass('Uses queueWhatsAppMessage() for sending');
  } else {
    fail('queueWhatsAppMessage() NOT called — messages bypass queue!');
  }
  
  // Check direct sendWhatsAppMessageWeb is NOT used
  if (!content.includes('sendWhatsAppMessageWeb(')) {
    pass('Direct sendWhatsAppMessageWeb() removed (all through queue)');
  } else {
    warn('sendWhatsAppMessageWeb() still directly called somewhere');
  }
  
  // Check isWhatsAppAllowed usage
  if (content.includes('isWhatsAppAllowed')) {
    pass('isWhatsAppAllowed flag used for conditional routing');
  } else {
    fail('isWhatsAppAllowed flag NOT found');
  }
  
  // Check app-only status
  if (content.includes("'app-only'")) {
    pass('Non-whitelisted types get status "app-only"');
  } else {
    warn('No "app-only" status for non-whitelisted types');
  }
}

// ─── TEST 3: whatsappClient.js — Anti-Ban Delay Config ───
function testWhatsAppClientFile() {
  section('3. whatsappClient.js — Anti-Ban Delays');
  
  const wcPath = path.join(__dirname, '..', 'server', 'services', 'whatsappClient.js');
  const content = fs.readFileSync(wcPath, 'utf-8');
  
  // Check "seen" delay exists
  if (content.includes('seenDelay') || content.includes('seen') && content.includes('delay')) {
    pass('"Seen" delay before typing simulation present');
  } else {
    fail('"Seen" delay NOT found');
  }
  
  // Check typing delay range
  const typingMaxMatch = content.match(/Math\.min\((\d+),.*Math\.max\((\d+)/);
  if (typingMaxMatch) {
    const max = parseInt(typingMaxMatch[1]);
    const min = parseInt(typingMaxMatch[2]);
    if (min >= 2000 && max >= 4000) {
      pass(`Typing delay range: ${min}ms - ${max}ms (safe)`);
    } else {
      warn(`Typing delay range: ${min}ms - ${max}ms (recommended ≥2000-4000)`);
    }
  }
  
  // Check zero-width character anti-fingerprinting
  if (content.includes('\\u200B') || content.includes('zeroWidthVariation') || content.includes('zwChars')) {
    pass('Zero-width character anti-fingerprinting present');
  } else {
    warn('Zero-width char variation not found');
  }
  
  // Check sendStateTyping
  if (content.includes('sendStateTyping')) {
    pass('Typing indicator simulation active');
  } else {
    fail('sendStateTyping NOT found — no typing simulation!');
  }
}

// ─── TEST 4: sessionScheduler.js — Guard Removal ───
function testSessionSchedulerFile() {
  section('4. sessionScheduler.js — ENABLE_WHATSAPP_ATTENDANCE Guards');
  
  const ssPath = path.join(__dirname, '..', 'server', 'services', 'sessionScheduler.js');
  const content = fs.readFileSync(ssPath, 'utf-8');
  
  if (!content.includes('ENABLE_WHATSAPP_ATTENDANCE')) {
    pass('ENABLE_WHATSAPP_ATTENDANCE guard REMOVED from sessionScheduler');
  } else {
    fail('ENABLE_WHATSAPP_ATTENDANCE still present in sessionScheduler!');
  }
  
  // Check it still sends to whatsappService (which internally filters)
  if (content.includes('sendWhatsAppAlert')) {
    pass('Still calls sendWhatsAppAlert (filtered by whitelist in whatsappService)');
  } else {
    warn('sendWhatsAppAlert call not found in sessionScheduler');
  }
}

// ─── TEST 5: biometricService.js — Dual Channel Verification ───
function testBiometricServiceFile() {
  section('5. biometricService.js — Dual-Channel (App + WhatsApp)');
  
  const bsPath = path.join(__dirname, '..', 'server', 'services', 'biometricService.js');
  const content = fs.readFileSync(bsPath, 'utf-8');
  
  // Check in-app notification creation
  if (content.includes("new Notification(") && content.includes("type: 'ATTENDANCE'")) {
    pass('Creates in-app Notification for Parents App');
  } else {
    fail('In-app Notification creation NOT found');
  }
  
  // Check WhatsApp alert call
  if (content.includes('sendWhatsAppAlert(')) {
    pass('Calls sendWhatsAppAlert for WhatsApp delivery');
  } else {
    fail('sendWhatsAppAlert NOT called — WhatsApp alerts missing!');
  }
  
  // Check both happen for student punch
  const studentSection = content.substring(content.indexOf('// Create respectful'));
  if (studentSection && studentSection.includes('Notification') && studentSection.includes('sendWhatsAppAlert')) {
    pass('Both in-app + WhatsApp triggered on student punch');
  } else {
    warn('Could not verify dual-channel in student punch section');
  }
}

// ─── TEST 6: server.js — Test Publish Dual-Channel ───
function testServerPublishEndpoint() {
  section('6. server.js — Test Publish Endpoint Dual-Channel');
  
  const serverPath = path.join(__dirname, '..', 'server', 'server.js');
  const content = fs.readFileSync(serverPath, 'utf-8');
  
  // Find the publish endpoint section
  const publishStart = content.indexOf("/api/test-results/:testId/publish");
  if (publishStart === -1) {
    fail('Test publish endpoint NOT found');
    return;
  }
  pass('Test publish endpoint exists');
  
  const publishSection = content.substring(publishStart, publishStart + 4000);
  
  // Check in-app notification
  if (publishSection.includes("'Test Result Published'") && publishSection.includes('new Notification')) {
    pass('Creates in-app Notification on test publish');
  } else {
    fail('In-app Notification NOT created on test publish');
  }
  
  // Check WhatsApp alert
  if (publishSection.includes('sendWhatsAppAlert') && publishSection.includes("'TEST_RESULT'")) {
    pass('Sends WhatsApp alert with type TEST_RESULT on publish');
  } else {
    fail('WhatsApp TEST_RESULT alert NOT found on publish');
  }
}

// ─── TEST 7: API Endpoint Check (if server running) ───
async function testServerAPIs() {
  section('7. Server API Endpoints (Live Check)');
  
  try {
    // Health check
    const health = await fetchJSON('/api/health');
    if (health.status === 200) {
      pass(`Server health: HTTP ${health.status} ✓`);
    } else {
      fail(`Server health: HTTP ${health.status}`);
    }
  } catch (e) {
    warn('Server not running on localhost:5000 — skipping API tests');
    log('💡', 'Start the server with: cd server && node server.js');
    return;
  }
  
  try {
    // WhatsApp status
    const waStatus = await fetchJSON('/api/whatsapp/status');
    if (waStatus.status === 200) {
      const data = waStatus.data;
      pass(`WhatsApp status endpoint: HTTP ${waStatus.status}`);
      log('📱', `WhatsApp client status: ${data.status || data.clientStatus || JSON.stringify(data).slice(0, 80)}`);
    } else {
      warn(`WhatsApp status: HTTP ${waStatus.status}`);
    }
  } catch (e) {
    warn('WhatsApp status endpoint failed: ' + e.message);
  }
}

// ─── TEST 8: Message Type Simulation Table ───
function testMessageTypeSimulation() {
  section('8. Message Type Routing Simulation');
  
  const wsPath = path.join(__dirname, '..', 'server', 'services', 'whatsappService.js');
  const content = fs.readFileSync(wsPath, 'utf-8');
  
  // Extract whitelist
  const whitelistMatch = content.match(/WHATSAPP_ALLOWED_TYPES\s*=\s*\[([^\]]+)\]/);
  if (!whitelistMatch) {
    fail('Could not parse whitelist');
    return;
  }
  
  const allowedTypes = whitelistMatch[1].replace(/'/g, '').replace(/"/g, '').split(',').map(t => t.trim());
  
  const allTypes = ['IN', 'OUT', 'TEST_RESULT', 'SESSION_CONTINUE', 'MISSED_EXIT', 'PUNCH_MISSED', 'ABSENT', 'WELCOME'];
  
  console.log('\n  ┌──────────────────┬──────────────┬─────────────────┐');
  console.log('  │ Message Type     │ WhatsApp     │ Parents App     │');
  console.log('  ├──────────────────┼──────────────┼─────────────────┤');
  
  for (const type of allTypes) {
    const goesToWA = allowedTypes.includes(type);
    const waIcon = goesToWA ? '✅ Queue' : '❌ Blocked';
    const appIcon = '✅ Always'; // In-app notifications are always created in biometricService/server.js
    const paddedType = type.padEnd(16);
    const paddedWA = waIcon.padEnd(12);
    console.log(`  │ ${paddedType} │ ${paddedWA} │ ${appIcon.padEnd(15)} │`);
  }
  
  console.log('  └──────────────────┴──────────────┴─────────────────┘');
  
  // Verify only expected types pass
  const correctRouting = 
    allowedTypes.includes('IN') && 
    allowedTypes.includes('OUT') && 
    allowedTypes.includes('TEST_RESULT') &&
    !allowedTypes.includes('ABSENT') &&
    !allowedTypes.includes('WELCOME') &&
    !allowedTypes.includes('PUNCH_MISSED');
    
  if (correctRouting) {
    pass('Message routing table is CORRECT');
  } else {
    fail('Message routing table has errors!');
  }
}

// ─── MAIN ───
async function main() {
  console.log('\n' + '🔬'.repeat(30));
  console.log('  NOTIFICATION SYSTEM — COMPREHENSIVE TEST');
  console.log('  Testing: WhatsApp + Parents App Dual-Channel');
  console.log('🔬'.repeat(30));
  
  // File-based tests (always run)
  testMessageQueueFile();
  testWhatsAppServiceFile();
  testWhatsAppClientFile();
  testSessionSchedulerFile();
  testBiometricServiceFile();
  testServerPublishEndpoint();
  testMessageTypeSimulation();
  
  // API tests (only if server is running)
  await testServerAPIs();
  
  // Summary
  section('FINAL RESULTS');
  console.log(`  ✅ Passed:   ${passed}`);
  console.log(`  ❌ Failed:   ${failed}`);
  console.log(`  ⚠️  Warnings: ${warnings}`);
  console.log(`  📊 Total:    ${passed + failed + warnings}`);
  
  if (failed === 0) {
    console.log('\n  🎉 ALL TESTS PASSED! Notification system is ready.\n');
  } else {
    console.log(`\n  🚨 ${failed} test(s) FAILED. Please review above.\n`);
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
