/**
 * Input validation utilities for realtime chat application
 * Validates display names and chat messages on the server side.
 */

const MAX_NAME_LENGTH = 30;
const MIN_NAME_LENGTH = 1;
const MAX_MESSAGE_LENGTH = 500;
const MIN_MESSAGE_LENGTH = 1;

/**
 * Validates a user display name.
 * Requirements:
 * - Must be non-empty string
 * - Min 1 character, max 30 characters after trimming
 * - No empty or spaces-only strings allowed
 * @param {unknown} rawName 
 * @returns {{ valid: boolean, error?: string, name?: string }}
 */
function validateDisplayName(rawName) {
  if (typeof rawName !== 'string') {
    return { valid: false, error: 'Display name must be a string.' };
  }

  const trimmed = rawName.trim();

  if (trimmed.length < MIN_NAME_LENGTH) {
    return { valid: false, error: 'Display name cannot be empty.' };
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return { 
      valid: false, 
      error: `Display name cannot exceed ${MAX_NAME_LENGTH} characters (got ${trimmed.length}).` 
    };
  }

  return { valid: true, name: trimmed };
}

/**
 * Validates a chat message text.
 * Requirements:
 * - Must be non-empty string
 * - Min 1 character, max 500 characters after trimming
 * - No empty or spaces-only messages allowed
 * @param {unknown} rawMessage 
 * @returns {{ valid: boolean, error?: string, message?: string }}
 */
function validateMessage(rawMessage) {
  if (typeof rawMessage !== 'string') {
    return { valid: false, error: 'Message must be a string.' };
  }

  const trimmed = rawMessage.trim();

  if (trimmed.length < MIN_MESSAGE_LENGTH) {
    return { valid: false, error: 'Message cannot be empty.' };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { 
      valid: false, 
      error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters (got ${trimmed.length}).` 
    };
  }

  return { valid: true, message: trimmed };
}

module.exports = {
  validateDisplayName,
  validateMessage,
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  MAX_MESSAGE_LENGTH,
  MIN_MESSAGE_LENGTH,
};
