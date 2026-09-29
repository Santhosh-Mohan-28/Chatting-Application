const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { io: ClientIO } = require('socket.io-client');
const assert = require('assert');
const { setupSocketHandlers } = require('../server/socketHandler');

const TEST_PORT = 5077;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMeetingE2ETests() {
  console.log('=== Starting Real-Time Multi-Participant Meeting Room E2E Tests ===');

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' },
    transports: ['websocket'],
  });

  setupSocketHandlers(io);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test Meeting server running on port ${TEST_PORT}`);

  try {
    function createClient() {
      return ClientIO(SERVER_URL, {
        transports: ['websocket'],
        forceNew: true,
      });
    }

    // Connect 4 users: Santhosh (Host), Rahul, Priya, Arun
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

    await new Promise((r) => clientSanthosh.emit('join', { name: 'Santhosh' }, r));
    await new Promise((r) => clientRahul.emit('join', { name: 'Rahul' }, r));
    await new Promise((r) => clientPriya.emit('join', { name: 'Priya' }, r));
    await new Promise((r) => clientArun.emit('join', { name: 'Arun' }, r));
    console.log('✓ All 4 users joined the chat room');

    await sleep(50);

    // --- TEST 1: Host creates a Meeting Room ---
    console.log('\n--- Step 1: Santhosh creates Meeting Room ---');
    const createRes = await new Promise((r) => {
      clientSanthosh.emit('create_meeting', { meetingName: 'Project Standup' }, r);
    });
    assert.strictEqual(createRes.success, true);
    assert.ok(createRes.meeting.id);
    assert.strictEqual(createRes.meeting.name, 'Project Standup');
    assert.strictEqual(createRes.meeting.isHost, true);
    const meetingId = createRes.meeting.id;
    console.log(`✓ Meeting created with ID: ${meetingId} (Host: Santhosh)`);

    // --- TEST 2: Host invites Rahul BEFORE meeting starts ---
    console.log('\n--- Step 2: Host invites Rahul in Pre-Meeting Lobby ---');
    let rahulReceivedInvite = null;
    clientRahul.once('meeting_invitation', (data) => {
      rahulReceivedInvite = data;
    });

    const inviteRes1 = await new Promise((r) => {
      clientSanthosh.emit('invite_to_meeting', { meetingId, targetUserId: clientRahul.id }, r);
    });
    assert.strictEqual(inviteRes1.success, true);

    await sleep(50);
    assert.ok(rahulReceivedInvite);
    assert.strictEqual(rahulReceivedInvite.meetingId, meetingId);
    assert.strictEqual(rahulReceivedInvite.meetingName, 'Project Standup');
    assert.strictEqual(rahulReceivedInvite.hostName, 'Santhosh');
    console.log('✓ Rahul received meeting invitation');

    // Rahul accepts invitation using { response: 'accept' } -> Enters Lobby
    const rahulAcceptRes = await new Promise((r) => {
      clientRahul.emit('respond_meeting_invitation', { meetingId, response: 'accept' }, r);
    });
    assert.strictEqual(rahulAcceptRes.success, true);
    assert.strictEqual(rahulAcceptRes.accepted, true);
    assert.ok(rahulAcceptRes.meeting, 'response.meeting must be defined');
    assert.strictEqual(rahulAcceptRes.meeting.id, meetingId, 'meeting.id must match');
    assert.strictEqual(rahulAcceptRes.meeting.name, 'Project Standup', 'meeting.name must match');
    assert.strictEqual(rahulAcceptRes.meeting.hostId, clientSanthosh.id, 'meeting.hostId must match');
    assert.strictEqual(rahulAcceptRes.meeting.isHost, false);
    console.log('✓ Rahul accepted invitation ({ response: "accept" }) and entered pre-meeting lobby with valid meeting.id, name, hostId');

    // --- TEST 3: Host invites Priya, who declines ---
    console.log('\n--- Step 3: Priya receives invitation and declines ---');
    let priyaReceivedInvite = null;
    clientPriya.once('meeting_invitation', (d) => { priyaReceivedInvite = d; });

    await new Promise((r) => {
      clientSanthosh.emit('invite_to_meeting', { meetingId, targetUserId: clientPriya.id }, r);
    });
    await sleep(50);
    assert.ok(priyaReceivedInvite);

    let hostNotifiedDecline = null;
    clientSanthosh.once('meeting_invitation_declined', (d) => { hostNotifiedDecline = d; });

    const priyaDeclineRes = await new Promise((r) => {
      clientPriya.emit('respond_meeting_invitation', { meetingId, response: 'decline' }, r);
    });
    assert.strictEqual(priyaDeclineRes.success, true);
    assert.strictEqual(priyaDeclineRes.accepted, false);
    await sleep(50);
    assert.ok(hostNotifiedDecline);
    assert.strictEqual(hostNotifiedDecline.userName, 'Priya');
    console.log('✓ Priya declined invitation; host was notified');

    // --- TEST 4: Host and Rahul join the active meeting room ---
    console.log('\n--- Step 4: Host and Rahul join active meeting room ---');
    const hostJoinRes = await new Promise((r) => {
      clientSanthosh.emit('join_meeting', { meetingId, audioEnabled: true, videoEnabled: true }, r);
    });
    assert.strictEqual(hostJoinRes.success, true);
    assert.strictEqual(hostJoinRes.existingParticipants.length, 0); // First one in room

    let hostSawRahulJoin = null;
    clientSanthosh.once('meeting_participant_joined', (d) => {
      hostSawRahulJoin = d;
    });

    const rahulJoinRes = await new Promise((r) => {
      clientRahul.emit('join_meeting', { meetingId, audioEnabled: true, videoEnabled: true }, r);
    });
    assert.strictEqual(rahulJoinRes.success, true);
    assert.strictEqual(rahulJoinRes.existingParticipants.length, 1);
    assert.strictEqual(rahulJoinRes.existingParticipants[0].name, 'Santhosh');

    await sleep(50);
    assert.ok(hostSawRahulJoin);
    assert.strictEqual(hostSawRahulJoin.participant.name, 'Rahul');
    console.log('✓ Both Santhosh and Rahul joined active meeting room');

    // --- TEST 5: Mesh WebRTC Signaling between participants ---
    console.log('\n--- Step 5: WebRTC Mesh signaling (Offer, Answer, ICE) ---');
    let rahulOffer = null;
    clientRahul.once('meeting_webrtc_offer', (d) => { rahulOffer = d; });

    clientSanthosh.emit('meeting_webrtc_offer', {
      meetingId,
      targetUserId: clientRahul.id,
      sdp: { type: 'offer', sdp: 'mock-mesh-offer-santhosh-to-rahul' },
    });
    await sleep(50);
    assert.ok(rahulOffer);
    assert.strictEqual(rahulOffer.senderId, clientSanthosh.id);

    let santhoshAnswer = null;
    clientSanthosh.once('meeting_webrtc_answer', (d) => { santhoshAnswer = d; });

    clientRahul.emit('meeting_webrtc_answer', {
      meetingId,
      targetUserId: clientSanthosh.id,
      sdp: { type: 'answer', sdp: 'mock-mesh-answer-rahul-to-santhosh' },
    });
    await sleep(50);
    assert.ok(santhoshAnswer);
    assert.strictEqual(santhoshAnswer.senderId, clientRahul.id);

    let rahulIce = null;
    clientRahul.once('meeting_ice_candidate', (d) => { rahulIce = d; });

    clientSanthosh.emit('meeting_ice_candidate', {
      meetingId,
      targetUserId: clientRahul.id,
      candidate: { candidate: 'cand:1', sdpMid: '0' },
    });
    await sleep(50);
    assert.ok(rahulIce);
    console.log('✓ Mesh WebRTC signaling exchanged successfully between participants');

    // --- TEST 6: Inviting user AFTER meeting has already started ---
    console.log('\n--- Step 6: Host invites Arun AFTER meeting has already started ---');
    let arunReceivedInvite = null;
    clientArun.once('meeting_invitation', (d) => { arunReceivedInvite = d; });

    await new Promise((r) => {
      clientSanthosh.emit('invite_to_meeting', { meetingId, targetUserId: clientArun.id }, r);
    });
    await sleep(50);
    assert.ok(arunReceivedInvite);
    assert.strictEqual(arunReceivedInvite.meetingName, 'Project Standup');

    // Arun accepts and enters lobby
    await new Promise((r) => {
      clientArun.emit('respond_meeting_invitation', { meetingId, accept: true }, r);
    });

    // Arun joins meeting
    let santhoshSawArun = null;
    let rahulSawArun = null;
    clientSanthosh.once('meeting_participant_joined', (d) => { santhoshSawArun = d; });
    clientRahul.once('meeting_participant_joined', (d) => { rahulSawArun = d; });

    const arunJoinRes = await new Promise((r) => {
      clientArun.emit('join_meeting', { meetingId, audioEnabled: false, videoEnabled: true }, r);
    });
    assert.strictEqual(arunJoinRes.success, true);
    assert.strictEqual(arunJoinRes.existingParticipants.length, 2); // Sees Santhosh & Rahul

    await sleep(50);
    assert.ok(santhoshSawArun);
    assert.ok(rahulSawArun);
    assert.strictEqual(santhoshSawArun.participant.name, 'Arun');
    assert.strictEqual(rahulSawArun.participant.name, 'Arun');
    console.log('✓ Arun joined ongoing meeting; both Santhosh and Rahul notified (3-way meeting)');

    // --- TEST 7: Participant updates media state ---
    console.log('\n--- Step 7: Participant updates mic/camera state ---');
    let rahulSawArunUpdate = null;
    clientRahul.once('meeting_participant_updated', (d) => { rahulSawArunUpdate = d; });

    clientArun.emit('meeting_update_media_state', {
      meetingId,
      audioEnabled: true,
      videoEnabled: false,
    });
    await sleep(50);
    assert.ok(rahulSawArunUpdate);
    assert.strictEqual(rahulSawArunUpdate.participantId, clientArun.id);
    assert.strictEqual(rahulSawArunUpdate.audioEnabled, true);
    assert.strictEqual(rahulSawArunUpdate.videoEnabled, false);
    console.log('✓ Media state update broadcast to other meeting participants');

    // --- TEST 8: Global chat continues during active meeting ---
    console.log('\n--- Step 8: Global chat continues working during active meeting ---');
    let arunGotChat = null;
    let priyaGotChat = null;
    clientArun.once('chat_message', (m) => { arunGotChat = m; });
    clientPriya.once('chat_message', (m) => { priyaGotChat = m; });

    clientSanthosh.emit('send_message', { message: 'Chat message from meeting host!' });
    await sleep(50);
    assert.ok(arunGotChat);
    assert.ok(priyaGotChat);
    assert.strictEqual(arunGotChat.message, 'Chat message from meeting host!');
    console.log('✓ Global chat works for meeting participants and non-participants alike');

    // --- TEST 9: Regular participant leaves meeting ---
    console.log('\n--- Step 9: Regular participant (Arun) leaves meeting ---');
    let santhoshSawArunLeave = null;
    let rahulSawArunLeave = null;
    clientSanthosh.once('meeting_participant_left', (d) => { santhoshSawArunLeave = d; });
    clientRahul.once('meeting_participant_left', (d) => { rahulSawArunLeave = d; });

    const arunLeaveRes = await new Promise((r) => {
      clientArun.emit('leave_meeting', { meetingId }, r);
    });
    assert.strictEqual(arunLeaveRes.success, true);
    await sleep(50);

    assert.ok(santhoshSawArunLeave);
    assert.ok(rahulSawArunLeave);
    assert.strictEqual(santhoshSawArunLeave.participantId, clientArun.id);
    console.log('✓ Arun left; meeting continues normally for Santhosh and Rahul');

    // --- TEST 10: Host ends meeting for everyone ---
    console.log('\n--- Step 10: Host ends meeting for everyone ---');
    let rahulGotMeetingEnded = null;
    clientRahul.once('meeting_ended', (d) => { rahulGotMeetingEnded = d; });

    const endRes = await new Promise((r) => {
      clientSanthosh.emit('end_meeting', { meetingId }, r);
    });
    assert.strictEqual(endRes.success, true);
    await sleep(50);

    assert.ok(rahulGotMeetingEnded);
    assert.strictEqual(rahulGotMeetingEnded.reason, 'host_ended');
    console.log('✓ Host ended meeting; all participants received meeting_ended');

    // --- TEST 11: Host unexpected disconnect ends meeting for everyone ---
    console.log('\n--- Step 11: Host unexpected disconnect terminates meeting ---');
    // Santhosh creates another meeting with Rahul
    const m2Res = await new Promise((r) => {
      clientSanthosh.emit('create_meeting', { meetingName: 'Quick Sync' }, r);
    });
    const m2Id = m2Res.meeting.id;

    await new Promise((r) => {
      clientSanthosh.emit('join_meeting', { meetingId: m2Id }, r);
    });

    await new Promise((r) => {
      clientSanthosh.emit('invite_to_meeting', { meetingId: m2Id, targetUserId: clientRahul.id }, r);
    });
    await sleep(30);

    await new Promise((r) => {
      clientRahul.emit('respond_meeting_invitation', { meetingId: m2Id, accept: true }, r);
    });
    await new Promise((r) => {
      clientRahul.emit('join_meeting', { meetingId: m2Id }, r);
    });

    let rahulGotHostDisconnect = null;
    clientRahul.once('meeting_ended', (d) => { rahulGotHostDisconnect = d; });

    // Santhosh disconnects abruptly
    clientSanthosh.disconnect();
    await sleep(100);

    assert.ok(rahulGotHostDisconnect);
    assert.strictEqual(rahulGotHostDisconnect.reason, 'host_disconnected');
    assert.ok(rahulGotHostDisconnect.message.includes('disconnected'));
    console.log('✓ Host unexpected disconnect terminated meeting for remaining participants');

    // Clean up
    clientRahul.disconnect();
    clientPriya.disconnect();
    clientArun.disconnect();

    console.log('\n=== ALL MEETING ROOM E2E TESTS PASSED WITH 100% SUCCESS ===\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('✓ Test server closed cleanly');
  }
}

runMeetingE2ETests().catch((err) => {
  console.error('Meeting E2E Test Failed:', err);
  process.exit(1);
});
