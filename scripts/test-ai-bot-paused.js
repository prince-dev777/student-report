import { getBotConfig, updateBotConfig, handleIncomingWhatsAppMessage } from '../server/services/whatsappBotService.js';

async function runTest() {
  console.log('🧪 [TEST 2] Starting AI Assistant Bot Hardcode-Pause Test...');

  // Step 1: Verify Initial Config
  const config = getBotConfig();
  console.log('Initial Bot Config:', { enabled: config.enabled, paused: config.paused });

  if (config.enabled !== false || config.paused !== true) {
    console.error('❌ [FAIL] Bot is not hardcoded to paused state!');
    process.exit(1);
  }

  // Step 2: Attempt to enable via updateBotConfig
  const updated = updateBotConfig({ enabled: true, paused: false });
  console.log('Post-Update Attempt Config:', { enabled: updated.config.enabled, paused: updated.config.paused });

  if (updated.config.enabled !== false || updated.config.paused !== true) {
    console.error('❌ [FAIL] Bot allowed enabling via updateBotConfig!');
    process.exit(1);
  }

  // Step 3: Test message handler short-circuit
  let messageSent = false;
  const mockClient = {
    sendMessage: async () => { messageSent = true; }
  };
  const mockMsg = {
    from: '919673383561@c.us',
    body: 'Hi, what are the fees and admission procedure?'
  };

  await handleIncomingWhatsAppMessage(mockClient, mockMsg);

  if (messageSent) {
    console.error('❌ [FAIL] Bot sent an automated response despite being paused!');
    process.exit(1);
  }

  console.log('🎉 [PASS] AI Assistant Bot Test PASSED: Bot is 100% hardcode paused and rejects all automated incoming replies!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
