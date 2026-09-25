const { io: ClientIO } = require('socket.io-client');
const assert = require('assert');

const URL = 'http://localhost:3000';
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function verifyLiveCalling() {
  console.log('=== Verifying Live Calling Flow Against Running Server http://localhost:3000 ===\n');

  const makeClient = () =>
    ClientIO(URL, {
      transports: ['websocket', 'polling'],
      forceNew: true,
    });

  const client1 = makeClient(); // Santhosh
  const client2 = makeClient(); // Rahul
  const client3 = makeClient(); // Priya
  const client4 = makeClient(); // Arun

  try {
    await Promise.all([
      new Promise((r) => client1.on('connect', r)),
      new Promise((r) => client2.on('connect', r)),
      new Promise((r) => client3.on('connect', r)),
      new Promise((r) => client4.on('connect', r)),
    ]);

    await new Promise((r) => client1.emit('join', { name: 'Santhosh' }, r));
    await new Promise((r) => client2.emit('join', { name: 'Rahul' }, r));
    await new Promise((r) => client3.emit('join', { name: 'Priya' }, r));
    await new Promise((r) => client4.emit('join', { name: 'Arun' }, r));
    console.log('✓ All 4 clients connected & joined room');

    await sleep(50);

    // 1. Santhosh calls Rahul (audio)
    console.log('\n[Call 1] Santhosh calls Rahul (Audio)...');
    let rahulIncoming = null;
    client2.once('incoming_call', (data) => {
      rahulIncoming = data;
    });

    const call1Res = await new Promise((r) => {
      client1.emit('call_user', { targetUserId: client2.id, callType: 'audio' }, r);
    });
    assert.strictEqual(call1Res.success, true);
    await sleep(50);

    assert.ok(rahulIncoming);
    assert.strictEqual(rahulIncoming.callerName, 'Santhosh');
    assert.strictEqual(rahulIncoming.callType, 'audio');
    console.log('✓ Rahul received incoming audio call');

    // Rahul accepts
    let santhoshAccepted = null;
    client1.once('call_accepted', (data) => {
      santhoshAccepted = data;
    });

    await new Promise((r) => {
      client2.emit('accept_call', { callId: call1Res.callId }, r);
    });
    await sleep(50);

    assert.ok(santhoshAccepted);
    console.log('✓ Rahul accepted call, Santhosh received call_accepted');

    // Exchange mock WebRTC offer & answer
    let rahulOffer = null;
    client2.once('webrtc_offer', (d) => { rahulOffer = d; });
    client1.emit('webrtc_offer', {
      callId: call1Res.callId,
      targetUserId: client2.id,
      sdp: { type: 'offer', sdp: 'mock-live-sdp-offer' },
    });
    await sleep(50);
    assert.ok(rahulOffer);
    console.log('✓ Offer delivered to Rahul');

    let santhoshAnswer = null;
    client1.once('webrtc_answer', (d) => { santhoshAnswer = d; });
    client2.emit('webrtc_answer', {
      callId: call1Res.callId,
      targetUserId: client1.id,
      sdp: { type: 'answer', sdp: 'mock-live-sdp-answer' },
    });
    await sleep(50);
    assert.ok(santhoshAnswer);
    console.log('✓ Answer delivered to Santhosh');

    // 2. Busy check: Priya calls Santhosh
    console.log('\n[Busy Check] Priya tries calling Santhosh...');
    const priyaCallRes = await new Promise((r) => {
      client3.emit('call_user', { targetUserId: client1.id, callType: 'video' }, r);
    });
    assert.strictEqual(priyaCallRes.success, false);
    assert.strictEqual(priyaCallRes.reason, 'busy');
    console.log('✓ Priya received busy response: "Santhosh is currently in another call."');

    // 3. Simultaneous Independent Call: Priya calls Arun (Video)
    console.log('\n[Call 2] Priya calls Arun (Video)...');
    let arunIncoming = null;
    client4.once('incoming_call', (data) => {
      arunIncoming = data;
    });

    const call2Res = await new Promise((r) => {
      client3.emit('call_user', { targetUserId: client4.id, callType: 'video' }, r);
    });
    assert.strictEqual(call2Res.success, true);
    await sleep(50);

    assert.ok(arunIncoming);
    assert.strictEqual(arunIncoming.callerName, 'Priya');
    assert.strictEqual(arunIncoming.callType, 'video');

    await new Promise((r) => {
      client4.emit('accept_call', { callId: call2Res.callId }, r);
    });
    console.log('✓ Priya <-> Arun video call established simultaneously with Santhosh <-> Rahul audio call');

    // 4. Global chat during calls
    console.log('\n[Global Chat] Sending chat message during calls...');
    let rahulMsg = null;
    let arunMsg = null;
    client2.once('chat_message', (m) => { rahulMsg = m; });
    client4.once('chat_message', (m) => { arunMsg = m; });

    client1.emit('send_message', { message: 'Chatting from live test!' });
    await sleep(50);

    assert.ok(rahulMsg);
    assert.strictEqual(rahulMsg.message, 'Chatting from live test!');
    assert.ok(arunMsg);
    assert.strictEqual(arunMsg.message, 'Chatting from live test!');
    console.log('✓ Global chat works for all users during active calls');

    // 5. Santhosh ends call
    console.log('\n[End Call] Santhosh ends Santhosh-Rahul call...');
    let rahulEnd = null;
    client2.once('call_ended', (d) => { rahulEnd = d; });

    await new Promise((r) => {
      client1.emit('end_call', { callId: call1Res.callId }, r);
    });
    await sleep(50);

    assert.ok(rahulEnd);
    console.log('✓ Santhosh-Rahul call ended cleanly');

    // 6. Priya disconnects while in call with Arun
    console.log('\n[Disconnect Cleanup] Priya disconnects while in call with Arun...');
    let arunEnd = null;
    client4.once('call_ended', (d) => { arunEnd = d; });

    client3.disconnect();
    await sleep(100);

    assert.ok(arunEnd);
    assert.strictEqual(arunEnd.reason, 'disconnected');
    console.log('✓ Arun notified that Priya disconnected and call ended cleanly');

    console.log('\n=== ALL LIVE CALLING FLOW VERIFICATIONS PASSED 100% ===\n');
  } finally {
    client1.disconnect();
    client2.disconnect();
    client4.disconnect();
  }
}

verifyLiveCalling().catch((e) => {
  console.error(e);
  process.exit(1);
});
