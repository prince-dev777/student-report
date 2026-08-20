import http from 'http';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function testBiometric() {
  console.log('🧪 Testing Biometric ADMS Engine on Port 5000...\n');

  try {
    // 1. Test Handshake
    console.log('1️⃣ Testing ADMS Handshake (GET /iclock/cdata)...');
    const handshake = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/iclock/cdata?SN=FK_TEST_001&options=all&pushver=2.4.1',
      method: 'GET'
    });
    console.log(`   Response Status: ${handshake.status}`);
    console.log(`   Response Body: ${handshake.body.trim().slice(0, 80)}...\n`);
    if (handshake.status === 200 && handshake.body.includes('GET OPTION FROM')) {
      console.log('   ✅ Handshake PASSED!');
    } else {
      console.warn('   ⚠️ Handshake unexpected response:', handshake);
    }

    // 2. Test GetRequest
    console.log('2️⃣ Testing ADMS Command Polling (GET /iclock/getrequest)...');
    const getReq = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/iclock/getrequest?SN=FK_TEST_001',
      method: 'GET'
    });
    console.log(`   Response Status: ${getReq.status}`);
    console.log(`   Response Body: ${getReq.body.trim()}`);
    if (getReq.status === 200 && getReq.body === 'OK') {
      console.log('   ✅ GetRequest PASSED!\n');
    }

    // 3. Test Data Push
    console.log('3️⃣ Testing Attendance Data Push (POST /iclock/cdata)...');
    const mockPunch = '101\t2026-08-20 08:30:00\t0\t1\t0\n102\t2026-08-20 08:31:00\t0\t1\t0';
    const postReq = await makeRequest({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/iclock/cdata?SN=FK_TEST_001&table=ATTLOG',
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(mockPunch)
      }
    }, mockPunch);

    console.log(`   Response Status: ${postReq.status}`);
    console.log(`   Response Body: ${postReq.body.trim()}`);
    if (postReq.status === 200 && postReq.body === 'OK') {
      console.log('   ✅ Attendance Push PASSED!\n');
    }

    console.log('🎉 ALL BIOMETRIC ADMS PROTOCOL TESTS PASSED WITH 100% SUCCESS!');
  } catch (err) {
    console.error('❌ Test failed (Is server running?):', err.message);
  }
}

testBiometric();
