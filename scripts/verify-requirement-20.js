const { io: ClientIO } = require('socket.io-client');
const assert = require('assert');

const URL = 'http://localhost:3000';
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function verifyScenario() {
  console.log('=== Verifying Requirement 20 Local Test Flow Against http://localhost:3000 ===\n');

  // Helper to create client
  const makeClient = () =>
    ClientIO(URL, {
      transports: ['websocket', 'polling'],
      forceNew: true,
    });

  // Browser 1: Santhosh
  console.log('[Browser 1] Connecting as Santhosh...');
  const browser1 = makeClient();
  const b1Messages = [];
  let b1OnlineCount = 0;

  browser1.on('chat_message', (m) => b1Messages.push(m));
  browser1.on('user_count', (d) => {
    b1OnlineCount = d.count;
  });

  await new Promise((r) => browser1.on('connect', r));
  const b1Join = await new Promise((r) => browser1.emit('join', { name: 'Santhosh' }, r));
  assert.strictEqual(b1Join.success, true);
  console.log('[Browser 1] Santhosh joined. Online count:', b1OnlineCount);

  // Santhosh sends "Hello"
  console.log('[Browser 1] Santhosh sends: "Hello"');
  await new Promise((r) => browser1.emit('send_message', { message: 'Hello' }, r));
  await sleep(100);

  assert.strictEqual(b1Messages.length, 1);
  assert.strictEqual(b1Messages[0].name, 'Santhosh');
  assert.strictEqual(b1Messages[0].message, 'Hello');
  console.log('[Browser 1] UI displays: "Santhosh : Hello"');

  // Browser 2: Rahul joins AFTER Santhosh sent "Hello"
  console.log('\n[Browser 2] Connecting as Rahul...');
  const browser2 = makeClient();
  const b2Messages = [];
  let b2OnlineCount = 0;

  browser2.on('chat_message', (m) => b2Messages.push(m));
  browser2.on('user_count', (d) => {
    b2OnlineCount = d.count;
  });

  await new Promise((r) => browser2.on('connect', r));
  const b2Join = await new Promise((r) => browser2.emit('join', { name: 'Rahul' }, r));
  assert.strictEqual(b2Join.success, true);
  await sleep(100);

  console.log('[Browser 2] Rahul joined. Online count:', b2OnlineCount);
  console.log('[Browser 2] Messages in Rahul window:', b2Messages.length);
  assert.strictEqual(
    b2Messages.length,
    0,
    'Browser 2 must NOT display Santhosh : Hello. Chat must initially be empty.'
  );
  console.log('✓ PASS: Browser 2 chat is completely empty!');

  // Rahul sends "Hi Santhosh"
  console.log('\n[Browser 2] Rahul sends: "Hi Santhosh"');
  await new Promise((r) => browser2.emit('send_message', { message: 'Hi Santhosh' }, r));
  await sleep(100);

  // Both browsers must immediately display "Rahul : Hi Santhosh"
  assert.strictEqual(b1Messages.length, 2);
  assert.strictEqual(b1Messages[1].name, 'Rahul');
  assert.strictEqual(b1Messages[1].message, 'Hi Santhosh');

  assert.strictEqual(b2Messages.length, 1);
  assert.strictEqual(b2Messages[0].name, 'Rahul');
  assert.strictEqual(b2Messages[0].message, 'Hi Santhosh');
  console.log('✓ PASS: Both browsers immediately display "Rahul : Hi Santhosh"');

  // Santhosh sends "How are you?"
  console.log('\n[Browser 1] Santhosh sends: "How are you?"');
  await new Promise((r) => browser1.emit('send_message', { message: 'How are you?' }, r));
  await sleep(100);

  // Both browsers must immediately display "Santhosh : How are you?"
  assert.strictEqual(b1Messages.length, 3);
  assert.strictEqual(b1Messages[2].name, 'Santhosh');
  assert.strictEqual(b1Messages[2].message, 'How are you?');

  assert.strictEqual(b2Messages.length, 2);
  assert.strictEqual(b2Messages[1].name, 'Santhosh');
  assert.strictEqual(b2Messages[1].message, 'How are you?');
  console.log('✓ PASS: Both browsers immediately display "Santhosh : How are you?"');

  // Close Browser 2
  console.log('\n[Browser 2] Closing Browser 2 (Rahul)...');
  browser2.disconnect();
  await sleep(150);

  console.log('[Browser 1] Online count after Rahul disconnects:', b1OnlineCount);
  assert.strictEqual(b1OnlineCount, 1, 'Online count should decrease to 1');
  console.log('✓ PASS: Online-user count decreased to 1');

  // Open Browser 3: Priya
  console.log('\n[Browser 3] Opening Browser 3 (Priya)...');
  const browser3 = makeClient();
  const b3Messages = [];
  let b3OnlineCount = 0;

  browser3.on('chat_message', (m) => b3Messages.push(m));
  browser3.on('user_count', (d) => {
    b3OnlineCount = d.count;
  });

  await new Promise((r) => browser3.on('connect', r));
  const b3Join = await new Promise((r) => browser3.emit('join', { name: 'Priya' }, r));
  assert.strictEqual(b3Join.success, true);
  await sleep(100);

  console.log('[Browser 3] Priya joined. Online count:', b3OnlineCount);
  console.log('[Browser 3] Messages in Priya window:', b3Messages.length);
  assert.strictEqual(
    b3Messages.length,
    0,
    'Priya must see NO previous messages.'
  );
  console.log('✓ PASS: Priya sees 0 previous messages');

  // Priya sends "Hello!"
  console.log('\n[Browser 3] Priya sends: "Hello!"');
  await new Promise((r) => browser3.emit('send_message', { message: 'Hello!' }, r));
  await sleep(100);

  // Verify all currently connected users see "Priya : Hello!"
  assert.strictEqual(b1Messages.length, 4);
  assert.strictEqual(b1Messages[3].name, 'Priya');
  assert.strictEqual(b1Messages[3].message, 'Hello!');

  assert.strictEqual(b3Messages.length, 1);
  assert.strictEqual(b3Messages[0].name, 'Priya');
  assert.strictEqual(b3Messages[0].message, 'Hello!');
  console.log('✓ PASS: All currently connected users see "Priya : Hello!"');

  browser1.disconnect();
  browser3.disconnect();
  console.log('\n=== ALL REQUIREMENT 20 VERIFICATIONS PASSED SUCCESSFULLY ===\n');
}

verifyScenario().catch((e) => {
  console.error(e);
  process.exit(1);
});
