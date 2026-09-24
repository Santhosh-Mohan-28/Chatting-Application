const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: ClientIO } = require('socket.io-client');
const assert = require('assert');
const { setupSocketHandlers } = require('../server/socketHandler');

const TEST_PORT = 5055;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runE2ETests() {
  console.log('=== Starting Real-Time Socket.IO E2E Integration Tests ===');

  // 1. Create and start test server
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' },
    transports: ['websocket'],
  });

  setupSocketHandlers(io);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test Socket.IO server running on port ${TEST_PORT}`);

  try {
    // Helper to create a connected client socket
    function createClient() {
      return ClientIO(SERVER_URL, {
        transports: ['websocket'],
        forceNew: true,
      });
    }

    // --- TEST 1: Santhosh joins and sends a message ---
    console.log('\n--- Step 1: Santhosh connects and joins ---');
    const client1 = createClient();
    const client1Messages = [];

    await new Promise((resolve) => client1.on('connect', resolve));
    assert.ok(client1.id, 'Client 1 should have a socket ID');

    // Attach message listener
    client1.on('chat_message', (msg) => {
      client1Messages.push(msg);
    });

    // Join with valid name
    const join1Res = await new Promise((resolve) => {
      client1.emit('join', { name: 'Santhosh' }, resolve);
    });
    assert.strictEqual(join1Res.success, true);
    assert.strictEqual(join1Res.user.name, 'Santhosh');
    console.log('✓ Santhosh joined successfully');

    // Wait for user count update
    await sleep(50);

    // Santhosh sends "Hello"
    const send1Res = await new Promise((resolve) => {
      client1.emit('send_message', { message: 'Hello' }, resolve);
    });
    assert.strictEqual(send1Res.success, true);

    await sleep(50);
    assert.strictEqual(client1Messages.length, 1);
    assert.strictEqual(client1Messages[0].name, 'Santhosh');
    assert.strictEqual(client1Messages[0].message, 'Hello');
    console.log('✓ Santhosh sent "Hello" and received broadcast');

    // --- TEST 2: Rahul joins AFTER Santhosh sent message ---
    console.log('\n--- Step 2: Rahul joins after Santhosh sent message ---');
    const client2 = createClient();
    const client2Messages = [];
    let onlineCountReportedToClient2 = 0;

    client2.on('user_count', (data) => {
      onlineCountReportedToClient2 = data.count;
    });

    await new Promise((resolve) => client2.on('connect', resolve));

    client2.on('chat_message', (msg) => {
      client2Messages.push(msg);
    });

    const join2Res = await new Promise((resolve) => {
      client2.emit('join', { name: 'Rahul' }, resolve);
    });
    assert.strictEqual(join2Res.success, true);
    assert.strictEqual(join2Res.user.name, 'Rahul');
    console.log('✓ Rahul joined successfully');

    // CRITICAL REQUIREMENT VERIFICATION:
    // Rahul's chat window must NOT contain Santhosh's previous message!
    await sleep(100);
    assert.strictEqual(
      client2Messages.length,
      0,
      'CRITICAL: Newly joined Rahul MUST NOT receive previous messages!'
    );
    console.log('✓ CRITICAL: Rahul received 0 previous messages (Chat is completely clean)');

    // Verify online user count is now 2
    assert.strictEqual(onlineCountReportedToClient2, 2, 'Online count should be 2');
    console.log(`✓ Online user count verified: ${onlineCountReportedToClient2} users online`);

    // --- TEST 3: Rahul sends "Hi Santhosh" ---
    console.log('\n--- Step 3: Rahul sends "Hi Santhosh" ---');
    const send2Res = await new Promise((resolve) => {
      client2.emit('send_message', { message: 'Hi Santhosh' }, resolve);
    });
    assert.strictEqual(send2Res.success, true);

    await sleep(50);
    // Both Santhosh and Rahul must receive this message
    assert.strictEqual(client1Messages.length, 2);
    assert.strictEqual(client1Messages[1].name, 'Rahul');
    assert.strictEqual(client1Messages[1].message, 'Hi Santhosh');

    assert.strictEqual(client2Messages.length, 1);
    assert.strictEqual(client2Messages[0].name, 'Rahul');
    assert.strictEqual(client2Messages[0].message, 'Hi Santhosh');
    console.log('✓ Both Santhosh and Rahul received "Rahul : Hi Santhosh" immediately');

    // --- TEST 4: Santhosh sends "How are you?" ---
    console.log('\n--- Step 4: Santhosh sends "How are you?" ---');
    const send3Res = await new Promise((resolve) => {
      client1.emit('send_message', { message: 'How are you?' }, resolve);
    });
    assert.strictEqual(send3Res.success, true);

    await sleep(50);
    assert.strictEqual(client1Messages.length, 3);
    assert.strictEqual(client1Messages[2].name, 'Santhosh');
    assert.strictEqual(client1Messages[2].message, 'How are you?');

    assert.strictEqual(client2Messages.length, 2);
    assert.strictEqual(client2Messages[1].name, 'Santhosh');
    assert.strictEqual(client2Messages[1].message, 'How are you?');
    console.log('✓ Both Santhosh and Rahul received "Santhosh : How are you?" immediately');

    // --- TEST 5: Close Rahul's connection and verify count decrements ---
    console.log('\n--- Step 5: Close Rahul and verify user count decrements ---');
    let countAfterRahulLeft = 0;
    client1.on('user_count', (data) => {
      countAfterRahulLeft = data.count;
    });

    client2.disconnect();
    await sleep(100);

    assert.strictEqual(countAfterRahulLeft, 1, 'Online count should decrease to 1');
    console.log(`✓ Rahul disconnected: Online user count decreased to ${countAfterRahulLeft}`);

    // --- TEST 6: Priya joins with 3rd window ---
    console.log('\n--- Step 6: Priya joins as 3rd window ---');
    const client3 = createClient();
    const client3Messages = [];

    await new Promise((resolve) => client3.on('connect', resolve));
    client3.on('chat_message', (msg) => {
      client3Messages.push(msg);
    });

    const join3Res = await new Promise((resolve) => {
      client3.emit('join', { name: 'Priya' }, resolve);
    });
    assert.strictEqual(join3Res.success, true);

    await sleep(100);
    // Priya must see NO previous messages!
    assert.strictEqual(
      client3Messages.length,
      0,
      'Priya must not see any previous messages!'
    );
    console.log('✓ Priya sees 0 previous messages');

    // Priya sends "Hello!"
    await new Promise((resolve) => {
      client3.emit('send_message', { message: 'Hello!' }, resolve);
    });

    await sleep(50);
    assert.strictEqual(client3Messages.length, 1);
    assert.strictEqual(client3Messages[0].name, 'Priya');
    assert.strictEqual(client3Messages[0].message, 'Hello!');

    assert.strictEqual(client1Messages.length, 4);
    assert.strictEqual(client1Messages[3].name, 'Priya');
    assert.strictEqual(client1Messages[3].message, 'Hello!');
    console.log('✓ All active connected users received "Priya : Hello!"');

    // --- TEST 7: Edge Cases and Validation ---
    console.log('\n--- Step 7: Edge Cases and Security Validation ---');
    const testClient = createClient();
    await new Promise((resolve) => testClient.on('connect', resolve));

    // Reject sending message before joining
    const preJoinMsgRes = await new Promise((resolve) => {
      testClient.emit('send_message', { message: 'Unauthorized' }, resolve);
    });
    assert.strictEqual(preJoinMsgRes.success, false);
    console.log('✓ Sending message before joining rejected');

    // Empty name
    const emptyNameRes = await new Promise((resolve) => {
      testClient.emit('join', { name: '' }, resolve);
    });
    assert.strictEqual(emptyNameRes.success, false);
    console.log('✓ Empty name rejected');

    // Spaces-only name
    const spaceNameRes = await new Promise((resolve) => {
      testClient.emit('join', { name: '     ' }, resolve);
    });
    assert.strictEqual(spaceNameRes.success, false);
    console.log('✓ Spaces-only name rejected');

    // Oversized name (> 30 chars)
    const longNameRes = await new Promise((resolve) => {
      testClient.emit('join', { name: 'A'.repeat(31) }, resolve);
    });
    assert.strictEqual(longNameRes.success, false);
    console.log('✓ Oversized name rejected');

    // Duplicate name allowed (e.g. another "Santhosh")
    const dupNameRes = await new Promise((resolve) => {
      testClient.emit('join', { name: 'Santhosh' }, resolve);
    });
    assert.strictEqual(dupNameRes.success, true);
    assert.notStrictEqual(testClient.id, client1.id, 'Must have distinct socket IDs');
    console.log('✓ Duplicate display name allowed under distinct socket IDs');

    // Empty message
    const emptyMsgRes = await new Promise((resolve) => {
      testClient.emit('send_message', { message: '' }, resolve);
    });
    assert.strictEqual(emptyMsgRes.success, false);
    console.log('✓ Empty message rejected');

    // Spaces-only message
    const spaceMsgRes = await new Promise((resolve) => {
      testClient.emit('send_message', { message: '    ' }, resolve);
    });
    assert.strictEqual(spaceMsgRes.success, false);
    console.log('✓ Spaces-only message rejected');

    // Oversized message (> 500 chars)
    const longMsgRes = await new Promise((resolve) => {
      testClient.emit('send_message', { message: 'm'.repeat(501) }, resolve);
    });
    assert.strictEqual(longMsgRes.success, false);
    console.log('✓ Oversized message rejected');

    // Clean up test sockets
    client1.disconnect();
    client3.disconnect();
    testClient.disconnect();

    console.log('\n=== ALL E2E CHAT TESTS PASSED WITH 100% SUCCESS ===\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('✓ Test server closed cleanly');
  }
}

runE2ETests().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
