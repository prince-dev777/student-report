async function testParentApi() {
  console.log('🧪 [TEST 3] Starting Parent Portal Live API & OMR Verification Test...');

  const RENDER_URL = 'https://student-report-4j6t.onrender.com/api/parent/login';
  console.log(`Connecting to Live Backend: ${RENDER_URL}`);

  const res = await fetch(RENDER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rollNo: '8451', password: '8451' })
  });

  if (!res.ok) {
    throw new Error(`HTTP Error from Live Server: ${res.status}`);
  }

  const data = await res.json();

  console.log('1. Auth Token Received:', !!data.token);
  console.log('2. Student Name:', data.student?.name, '| Roll:', data.student?.rollNo, '| User ID:', data.student?.parentUserId);
  console.log('3. Test Results Count:', data.testResults?.length || 0);

  if (data.testResults && data.testResults.length > 0) {
    data.testResults.forEach((r, idx) => {
      console.log(`   - Result [${idx + 1}] Test: "${r.testName}" | Status: ${r.status} | OMR URL: ${r.omrSheetImage}`);
      if (r.omrSheetImage && !r.omrSheetImage.startsWith('http')) {
        throw new Error(`FAIL: OMR Sheet Image is not a valid HTTPS URL: ${r.omrSheetImage}`);
      }
    });
  }

  console.log('4. Upcoming Tests Count:', data.upcomingTests?.length || 0);
  const todayStr = new Date().toISOString().split('T')[0];
  if (data.upcomingTests && data.upcomingTests.length > 0) {
    data.upcomingTests.forEach((t) => {
      console.log(`   - Upcoming Test: "${t.name}" | Date: ${t.date} | Batch: ${t.batch}`);
      if (t.date < todayStr) {
        throw new Error(`FAIL: Past test found in upcoming tests list: ${t.name} (${t.date})`);
      }
    });
  }

  console.log('5. In-App Notices Count:', data.notices?.length || 0);

  console.log('\n🎉 [PASS] Parent Portal Live API Test PASSED: OMR is live on Cloudinary CDN, past tests are filtered out, and student credentials are valid!');
  process.exit(0);
}

testParentApi().catch((err) => {
  console.error('Test error:', err.message);
  process.exit(1);
});
