const assert = require('assert');
const { validateDisplayName, validateMessage } = require('../server/validation');

console.log('--- Testing server/validation.js ---');

// Display Name Validation
{
  // 1. Empty string
  const resEmpty = validateDisplayName('');
  assert.strictEqual(resEmpty.valid, false, 'Empty name should be invalid');

  // 2. Spaces-only
  const resSpaces = validateDisplayName('    ');
  assert.strictEqual(resSpaces.valid, false, 'Spaces-only name should be invalid');

  // 3. Trim whitespace
  const resTrim = validateDisplayName('  Santhosh  ');
  assert.strictEqual(resTrim.valid, true);
  assert.strictEqual(resTrim.name, 'Santhosh');

  // 4. Exceeds 30 characters
  const longName = 'a'.repeat(31);
  const resLong = validateDisplayName(longName);
  assert.strictEqual(resLong.valid, false, 'Name > 30 chars should be invalid');

  // 5. Exactly 30 characters
  const exact30 = 'a'.repeat(30);
  const res30 = validateDisplayName(exact30);
  assert.strictEqual(res30.valid, true);
  assert.strictEqual(res30.name, exact30);

  // 6. Non-string type
  assert.strictEqual(validateDisplayName(null).valid, false);
  assert.strictEqual(validateDisplayName(123).valid, false);
  assert.strictEqual(validateDisplayName({}).valid, false);

  console.log('✓ validateDisplayName tests passed');
}

// Message Validation
{
  // 1. Empty message
  const resEmpty = validateMessage('');
  assert.strictEqual(resEmpty.valid, false, 'Empty message should be invalid');

  // 2. Spaces-only message
  const resSpaces = validateMessage('     ');
  assert.strictEqual(resSpaces.valid, false, 'Spaces-only message should be invalid');

  // 3. Trim whitespace
  const resTrim = validateMessage('  Hello everyone!  ');
  assert.strictEqual(resTrim.valid, true);
  assert.strictEqual(resTrim.message, 'Hello everyone!');

  // 4. Exceeds 500 characters
  const longMsg = 'm'.repeat(501);
  const resLong = validateMessage(longMsg);
  assert.strictEqual(resLong.valid, false, 'Message > 500 chars should be invalid');

  // 5. Exactly 500 characters
  const exact500 = 'm'.repeat(500);
  const res500 = validateMessage(exact500);
  assert.strictEqual(res500.valid, true);
  assert.strictEqual(res500.message, exact500);

  // 6. Non-string type
  assert.strictEqual(validateMessage(null).valid, false);
  assert.strictEqual(validateMessage(456).valid, false);

  console.log('✓ validateMessage tests passed');
}

console.log('All validation unit tests passed successfully!\n');
