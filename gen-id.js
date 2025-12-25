/**
 * DTZ_NOVA_XMD Session ID Generator
 * Generates unique session IDs for WhatsApp sessions
 * Created by Dulina Nethmira
 */

const crypto = require('crypto');

/**
 * Generates a random session ID
 * @param {number} length - Length of the ID (default: 12)
 * @param {boolean} includeTimestamp - Include timestamp for uniqueness (default: true)
 * @returns {string} Unique session ID
 */
function makeid(length = 12, includeTimestamp = true) {
    // Character sets
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    
    // Combined character set
    const allChars = uppercase + lowercase + numbers;
    
    // Ensure we have at least 2 uppercase, 2 lowercase, and 2 numbers
    let result = '';
    
    // Add required characters first
    result += getRandomChars(uppercase, 2);      // 2 uppercase letters
    result += getRandomChars(lowercase, 2);      // 2 lowercase letters
    result += getRandomChars(numbers, 2);        // 2 numbers
    
    // Fill the rest with random characters
    const remainingLength = length - 6;
    if (remainingLength > 0) {
        result += getRandomChars(allChars, remainingLength);
    }
    
    // Shuffle the result for randomness
    result = shuffleString(result);
    
    // Add timestamp suffix if requested
    if (includeTimestamp) {
        const timestamp = Date.now().toString(36); // Convert to base36
        const shortTimestamp = timestamp.slice(-4); // Last 4 characters
        result += '_' + shortTimestamp;
    }
    
    // Add prefix
    result = 'DTZ_' + result;
    
    return result;
}

/**
 * Generate random characters from a character set
 * @param {string} charset - Character set to choose from
 * @param {number} count - Number of characters to generate
 * @returns {string} Random characters
 */
function getRandomChars(charset, count) {
    let result = '';
    const charsetLength = charset.length;
    
    // Use crypto for better randomness
    const randomBytes = crypto.randomBytes(count);
    
    for (let i = 0; i < count; i++) {
        const randomIndex = randomBytes[i] % charsetLength;
        result += charset[randomIndex];
    }
    
    return result;
}

/**
 * Shuffle a string randomly
 * @param {string} str - String to shuffle
 * @returns {string} Shuffled string
 */
function shuffleString(str) {
    const array = str.split('');
    
    // Fisher-Yates shuffle algorithm
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    
    return array.join('');
}

/**
 * Generate a batch of unique session IDs
 * @param {number} count - Number of IDs to generate
 * @param {number} length - Length of each ID
 * @returns {string[]} Array of unique session IDs
 */
function generateBatch(count = 5, length = 12) {
    const ids = new Set();
    
    while (ids.size < count) {
        const id = makeid(length, true);
        ids.add(id);
    }
    
    return Array.from(ids);
}

/**
 * Validate if a session ID matches the expected format
 * @param {string} sessionId - Session ID to validate
 * @returns {boolean} True if valid
 */
function validateSessionId(sessionId) {
    // Basic validation: starts with DTZ_, has proper length, contains timestamp
    const pattern = /^DTZ_[A-Za-z0-9]{12}_[a-z0-9]{4}$/;
    return pattern.test(sessionId);
}

/**
 * Extract timestamp from session ID
 * @param {string} sessionId - Session ID
 * @returns {number|null} Timestamp or null if invalid
 */
function extractTimestamp(sessionId) {
    if (!validateSessionId(sessionId)) {
        return null;
    }
    
    const parts = sessionId.split('_');
    if (parts.length < 3) {
        return null;
    }
    
    const timestampBase36 = parts[2];
    try {
        return parseInt(timestampBase36, 36);
    } catch (error) {
        return null;
    }
}

/**
 * Check if session ID is expired
 * @param {string} sessionId - Session ID
 * @param {number} maxAgeHours - Maximum age in hours (default: 24)
 * @returns {boolean} True if expired
 */
function isSessionExpired(sessionId, maxAgeHours = 24) {
    const timestamp = extractTimestamp(sessionId);
    if (!timestamp) {
        return true; // Invalid ID considered expired
    }
    
    const now = Date.now();
    const age = now - timestamp;
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    
    return age > maxAgeMs;
}

/**
 * Generate a short, human-readable ID for display
 * @param {number} length - Length of ID (default: 8)
 * @returns {string} Short ID
 */
function makeShortId(length = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
    let result = '';
    
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        result += chars[randomBytes[i] % chars.length];
    }
    
    return result;
}

/**
 * Generate a secure random string
 * @param {number} length - Length of string
 * @returns {string} Secure random string
 */
function generateSecureString(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

// Export functions
module.exports = {
    makeid,
    generateBatch,
    validateSessionId,
    extractTimestamp,
    isSessionExpired,
    makeShortId,
    generateSecureString,
    
    // Aliases for backward compatibility
    generateId: makeid,
    createSessionId: makeid,
    generateSessionId: makeid
};

// Example usage (when run directly)
if (require.main === module) {
    console.log('🎯 DTZ_NOVA_XMD Session ID Generator');
    console.log('====================================\n');
    
    // Generate some example IDs
    console.log('📋 Example Session IDs:');
    for (let i = 0; i < 5; i++) {
        const id = makeid();
        console.log(`  ${i + 1}. ${id}`);
    }
    
    console.log('\n🔐 Example Secure String:');
    console.log(`  ${generateSecureString(16)}`);
    
    console.log('\n👤 Example Short ID:');
    console.log(`  ${makeShortId()}`);
    
    console.log('\n✅ Validation Test:');
    const testId = makeid();
    console.log(`  ID: ${testId}`);
    console.log(`  Valid: ${validateSessionId(testId)}`);
    console.log(`  Timestamp: ${extractTimestamp(testId)}`);
    console.log(`  Expired: ${isSessionExpired(testId)}`);
    
    console.log('\n🎉 Generator ready for DTZ_NOVA_XMD!');
}
