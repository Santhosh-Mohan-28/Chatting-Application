const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: ClientIO } = require('socket.io-client');
const assert = require('assert');
const { setupSocketHandlers } = require('../server/socketHandler');

const TEST_PORT = 5066;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCallingE2ETests() {
  console.log('=== Starting Real-Time WebRTC Calling & Signaling E2E Tests ===');

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
    function createClient() {
      return ClientIO(SERVER_URL, {
        transports: ['websocket'],
        forceNew: true,
      });
    }

    // Connect 4 users: Santhosh, Rahul, Priya, Arun
    const clientSanthosh = createClient();
    const clientRahul = createClient();
    const clientPriya = createClient();
    const clientArun = createClient();

    await Promise.all([
      new Promise((r) => clientSanthosh.on('connect', r)),
      new Promise((r) => clientRahul.on('connect', r)),
      new Promise((r) => clientPriya.on('connect', r)),
      new Promise((r) => clientArun.on('connect', r)),
    ]);

    // Join all 4 users
    await new Promise((r) => clientSanthosh.emit('join', { name: 'Santhosh' }, r));
    await new Promise((r) => clientRahul.emit('join', { name: 'Rahul' }, r));
    await new Promise((r) => clientPriya.emit('join', { name: 'Priya' }, r));
    await new Promise((r) => clientArun.emit('join', { name: 'Arun' }, r));
    console.log('✓ All 4 users connected and joined');

    await sleep(50);

    // --- TEST 1: Santhosh cannot call himself ---
    console.log('\n--- Step 1: Self-call rejection ---');
    const selfCallRes = await new Promise((r) => {
      clientSanthosh.emit('call_user', { targetUserId: clientSanthosh.id, callType: 'audio' }, r);
    });
    assert.strictEqual(selfCallRes.success, false);
    assert.strictEqual(selfCallRes.error, 'You cannot call yourself.');
    console.log('✓ Self-call rejected correctly');

    // --- TEST 2: Santhosh calls Rahul (Audio Call) ---
    console.log('\n--- Step 2: 1-to-1 Audio Call flow (Santhosh -> Rahul) ---');
    let incomingCallForRahul = null;
    clientRahul.once('incoming_call', (data) => {
      incomingCallForRahul = data;
    });

    const call1Res = await new Promise((r) => {
      clientSanthosh.emit('call_user', { targetUserId: clientRahul.id, callType: 'audio' }, r);
    });
    assert.strictEqual(call1Res.success, true);
    assert.ok(call1Res.callId, 'callId should be generated');

    await sleep(50);
    assert.ok(incomingCallForRahul, 'Rahul should have received incoming_call');
    assert.strictEqual(incomingCallForRahul.callId, call1Res.callId);
    assert.strictEqual(incomingCallForRahul.callerName, 'Santhosh');
    assert.strictEqual(incomingCallForRahul.callType, 'audio');
    console.log('✓ Rahul received incoming audio call');

    // Priya and Arun must NOT receive incoming_call (Strict privacy)
    let priyaGotCall = false;
    clientPriya.on('incoming_call', () => { priyaGotCall = true; });
    await sleep(50);
    assert.strictEqual(priyaGotCall, false, 'Priya must not receive Rahul’s incoming call');
    console.log('✓ Strict call privacy verified: Priya received no call event');

    // Rahul accepts the call
    let acceptedEventForSanthosh = null;
    clientSanthosh.once('call_accepted', (data) => {
      acceptedEventForSanthosh = data;
    });

    const acceptRes = await new Promise((r) => {
      clientRahul.emit('accept_call', { callId: call1Res.callId }, r);
    });
    assert.strictEqual(acceptRes.success, true);

    await sleep(50);
    assert.ok(acceptedEventForSanthosh, 'Santhosh should receive call_accepted');
    assert.strictEqual(acceptedEventForSanthosh.callId, call1Res.callId);
    assert.strictEqual(acceptedEventForSanthosh.calleeName, 'Rahul');
    console.log('✓ Rahul accepted call, Santhosh notified of acceptance');

    // --- TEST 3: Targeted WebRTC Signaling Exchange ---
    console.log('\n--- Step 3: WebRTC Signaling (Offer, Answer, ICE Candidates) ---');
    let rahulReceivedOffer = null;
    clientRahul.once('webrtc_offer', (data) => {
      rahulReceivedOffer = data;
    });

    clientSanthosh.emit('webrtc_offer', {
      callId: call1Res.callId,
      targetUserId: clientRahul.id,
      sdp: { type: 'offer', sdp: 'v=0\r\no=mock-santhosh-sdp...' },
    });

    await sleep(50);
    assert.ok(rahulReceivedOffer);
    assert.strictEqual(rahulReceivedOffer.callId, call1Res.callId);
    assert.strictEqual(rahulReceivedOffer.senderId, clientSanthosh.id);
    console.log('✓ Rahul received WebRTC offer from Santhosh');

    let santhoshReceivedAnswer = null;
    clientSanthosh.once('webrtc_answer', (data) => {
      santhoshReceivedAnswer = data;
    });

    clientRahul.emit('webrtc_answer', {
      callId: call1Res.callId,
      targetUserId: clientSanthosh.id,
      sdp: { type: 'answer', sdp: 'v=0\r\no=mock-rahul-sdp...' },
    });

    await sleep(50);
    assert.ok(santhoshReceivedAnswer);
    assert.strictEqual(santhoshReceivedAnswer.callId, call1Res.callId);
    assert.strictEqual(santhoshReceivedAnswer.senderId, clientRahul.id);
    console.log('✓ Santhosh received WebRTC answer from Rahul');

    // ICE Candidate relay
    let rahulReceivedIce = null;
    clientRahul.once('ice_candidate', (data) => {
      rahulReceivedIce = data;
    });

    clientSanthosh.emit('ice_candidate', {
      callId: call1Res.callId,
      targetUserId: clientRahul.id,
      candidate: { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host', sdpMid: '0' },
    });

    await sleep(50);
    assert.ok(rahulReceivedIce);
    assert.strictEqual(rahulReceivedIce.candidate.sdpMid, '0');
    console.log('✓ ICE candidate exchanged successfully');

    // --- TEST 4: Busy State Enforcement ---
    console.log('\n--- Step 4: Busy State Enforcement (Priya calls Santhosh while in call) ---');
    const priyaCallSanthoshRes = await new Promise((r) => {
      clientPriya.emit('call_user', { targetUserId: clientSanthosh.id, callType: 'video' }, r);
    });
    assert.strictEqual(priyaCallSanthoshRes.success, false);
    assert.strictEqual(priyaCallSanthoshRes.reason, 'busy');
    assert.strictEqual(priyaCallSanthoshRes.error, 'Santhosh is currently in another call.');
    console.log('✓ Priya received busy response: "Santhosh is currently in another call."');

    // Santhosh cannot call Priya while in call
    const santhoshCallPriyaRes = await new Promise((r) => {
      clientSanthosh.emit('call_user', { targetUserId: clientPriya.id, callType: 'audio' }, r);
    });
    assert.strictEqual(santhoshCallPriyaRes.success, false);
    assert.strictEqual(santhoshCallPriyaRes.reason, 'caller_busy');
    console.log('✓ Santhosh prevented from initiating another call: "You are already in a call."');

    // --- TEST 5: Simultaneous Independent Calls (Priya calls Arun) ---
    console.log('\n--- Step 5: Simultaneous Independent Call (Priya <-> Arun) ---');
    let incomingCallForArun = null;
    clientArun.once('incoming_call', (data) => {
      incomingCallForArun = data;
    });

    const call2Res = await new Promise((r) => {
      clientPriya.emit('call_user', { targetUserId: clientArun.id, callType: 'video' }, r);
    });
    assert.strictEqual(call2Res.success, true);
    await sleep(50);

    assert.ok(incomingCallForArun);
    assert.strictEqual(incomingCallForArun.callerName, 'Priya');
    assert.strictEqual(incomingCallForArun.callType, 'video');

    await new Promise((r) => {
      clientArun.emit('accept_call', { callId: call2Res.callId }, r);
    });
    console.log('✓ Priya <-> Arun video call established simultaneously with Santhosh <-> Rahul audio call!');

    // --- TEST 6: Global Chat Continues Uninterrupted During Calls ---
    console.log('\n--- Step 6: Global Chat Works During Active Calls ---');
    let rahulGotChat = null;
    let arunGotChat = null;

    clientRahul.once('chat_message', (msg) => { rahulGotChat = msg; });
    clientArun.once('chat_message', (msg) => { arunGotChat = msg; });

    await new Promise((r) => {
      clientSanthosh.emit('send_message', { message: 'Chatting while calling!' }, r);
    });

    await sleep(50);
    assert.ok(rahulGotChat);
    assert.strictEqual(rahulGotChat.message, 'Chatting while calling!');
    assert.ok(arunGotChat);
    assert.strictEqual(arunGotChat.message, 'Chatting while calling!');
    console.log('✓ Global chat messages delivered in real time to all users during active calls');

    // --- TEST 7: End Call by Santhosh ---
    console.log('\n--- Step 7: Ending Call (Santhosh ends Santhosh-Rahul call) ---');
    let rahulGotCallEnded = null;
    clientRahul.once('call_ended', (data) => {
      rahulGotCallEnded = data;
    });

    const endCallRes = await new Promise((r) => {
      clientSanthosh.emit('end_call', { callId: call1Res.callId }, r);
    });
    assert.strictEqual(endCallRes.success, true);

    await sleep(50);
    assert.ok(rahulGotCallEnded);
    assert.strictEqual(rahulGotCallEnded.callId, call1Res.callId);
    console.log('✓ Rahul received call_ended event. Santhosh & Rahul call terminated cleanly');

    // Verify Priya-Arun call is STILL ACTIVE and unaffected!
    // Try having Priya send a message in her call or verify busy
    const santhoshCallArunBusy = await new Promise((r) => {
      clientSanthosh.emit('call_user', { targetUserId: clientArun.id, callType: 'audio' }, r);
    });
    assert.strictEqual(santhoshCallArunBusy.success, false);
    assert.strictEqual(santhoshCallArunBusy.reason, 'busy');
    console.log('✓ Verified Priya-Arun call remained active and independent');

    // --- TEST 8: Callee Declines Call ---
    console.log('\n--- Step 8: Callee Declines Call ---');
    let santhoshGotDecline = null;
    clientSanthosh.once('call_rejected', (data) => {
      santhoshGotDecline = data;
    });

    const call3Res = await new Promise((r) => {
      clientSanthosh.emit('call_user', { targetUserId: clientRahul.id, callType: 'video' }, r);
    });
    assert.strictEqual(call3Res.success, true);

    await sleep(50);
    // Rahul declines
    await new Promise((r) => {
      clientRahul.emit('reject_call', { callId: call3Res.callId }, r);
    });

    await sleep(50);
    assert.ok(santhoshGotDecline);
    assert.strictEqual(santhoshGotDecline.reason, 'declined');
    console.log('✓ Rahul declined call, Santhosh received call_rejected with reason "declined"');

    // --- TEST 9: Caller Cancels While Ringing ---
    console.log('\n--- Step 9: Caller Cancels While Ringing ---');
    let rahulGotCancelled = null;
    clientRahul.once('call_ended', (data) => {
      rahulGotCancelled = data;
    });

    const call4Res = await new Promise((r) => {
      clientSanthosh.emit('call_user', { targetUserId: clientRahul.id, callType: 'audio' }, r);
    });
    assert.strictEqual(call4Res.success, true);

    await sleep(50);
    // Santhosh cancels
    await new Promise((r) => {
      clientSanthosh.emit('reject_call', { callId: call4Res.callId }, r);
    });

    await sleep(50);
    assert.ok(rahulGotCancelled);
    assert.strictEqual(rahulGotCancelled.reason, 'cancelled');
    console.log('✓ Santhosh cancelled call, Rahul received call_ended with reason "cancelled"');

    // --- TEST 10: Disconnect Handling during active call ---
    console.log('\n--- Step 10: Disconnect during active call ---');
    let arunGotDisconnectEnd = null;
    clientArun.once('call_ended', (data) => {
      arunGotDisconnectEnd = data;
    });

    // Priya disconnects
    clientPriya.disconnect();
    await sleep(100);

    assert.ok(arunGotDisconnectEnd);
    assert.strictEqual(arunGotDisconnectEnd.reason, 'disconnected');
    assert.ok(arunGotDisconnectEnd.message.includes('Priya disconnected'));
    console.log('✓ Priya disconnected: Arun cleanly notified of call termination');

    // --- TEST 11: Stale / Invalid Signaling Rejection ---
    console.log('\n--- Step 11: Stale and Unauthorized Signaling Rejection ---');
    // Emitting offer with terminated call1Res.callId
    clientSanthosh.emit('webrtc_offer', {
      callId: call1Res.callId,
      targetUserId: clientRahul.id,
      sdp: { type: 'offer', sdp: 'stale' },
    });
    // Should not crash and should not reach Rahul
    let rahulGotStaleOffer = false;
    clientRahul.once('webrtc_offer', () => { rahulGotStaleOffer = true; });
    await sleep(50);
    assert.strictEqual(rahulGotStaleOffer, false);
    console.log('✓ Stale signaling ignored safely');

    // Clean up
    clientSanthosh.disconnect();
    clientRahul.disconnect();
    clientArun.disconnect();

    console.log('\n=== ALL WEBRTC CALLING E2E TESTS PASSED WITH 100% SUCCESS ===\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('✓ Test server closed cleanly');
  }
}

runCallingE2ETests().catch((err) => {
  console.error('Calling E2E Test Failed:', err);
  process.exit(1);
});
