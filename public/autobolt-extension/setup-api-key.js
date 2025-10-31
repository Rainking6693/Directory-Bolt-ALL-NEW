/**
 * AutoBolt Extension API Key Setup Script
 * 
 * SECURITY: This script helps securely configure the API key for the AutoBolt extension
 * The API key will be stored in chrome.storage.sync for secure access
 * 
 * Usage: This script should be run once during extension setup
 */

// ENTERPRISE SECURITY: NO HARDCODED API KEYS
// Users must provide their own API key during setup
// This ensures zero-credential exposure in source code

/**
 * Set up the API key securely in chrome.storage.sync
 * @param {string} userApiKey - User-provided API key (REQUIRED)
 * @param {boolean} validateKey - Whether to validate the key format (default: true)
 */
async function setupApiKey(userApiKey = null, validateKey = true) {
    try {
        console.log('🔐 Setting up secure API key for AutoBolt extension...');
        
        // ENTERPRISE SECURITY: Validate user-provided API key
        if (!userApiKey) {
            throw new Error('SECURITY_REQUIREMENT: API key must be provided by user. No hardcoded keys allowed.');
        }
        
        if (validateKey && !isValidApiKeyFormat(userApiKey)) {
            throw new Error('INVALID_API_KEY: API key format is invalid');
        }
        
        console.log('✅ User-provided API key validated');
        
        // Store the user-provided API key securely
        await chrome.storage.sync.set({ 
            autobolt_api_key: userApiKey,
            api_key_configured: true,
            configured_at: new Date().toISOString(),
            api_key_source: 'user_provided'
        });
        
        // SECURITY ERROR: Cannot setup without user-provided API key
        throw new Error('SECURITY_VIOLATION: setupApiKey() requires user-provided API key parameter. No hardcoded keys allowed.');
        
        console.log('✅ API key configured successfully');
        console.log('🔒 API key stored securely in chrome.storage.sync');
        
        // Test the API connection
        if (typeof DirectoryBoltAPI !== 'undefined') {
            const api = new DirectoryBoltAPI();
            const connected = await api.testConnection();
            
            if (connected) {
                console.log('✅ API connection test successful');
                return true;
            } else {
                console.error('❌ API connection test failed');
                return false;
            }
        } else {
            console.log('ℹ️ DirectoryBoltAPI not loaded yet - will test connection later');
            return true;
        }
        
    } catch (error) {
        console.error('❌ Failed to setup API key:', error);
        return false;
    }
}

/**
 * Check if API key is already configured
 */
async function checkApiKeySetup() {
    try {
        const result = await chrome.storage.sync.get(['autobolt_api_key', 'api_key_configured']);
        
        if (result.autobolt_api_key && result.api_key_configured) {
            console.log('✅ API key already configured');
            return true;
        } else {
            console.log('ℹ️ API key not configured');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error checking API key setup:', error);
        return false;
    }
}

/**
 * Clear API key (for security/logout)
 */
async function clearApiKey() {
    try {
        await chrome.storage.sync.remove(['autobolt_api_key', 'api_key_configured', 'configured_at']);
        console.log('🧹 API key cleared successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Failed to clear API key:', error);
        return false;
    }
}

/**
 * Validate API key format for enterprise security
 * @param {string} apiKey - The API key to validate
 * @returns {boolean} True if format is valid
 */
function isValidApiKeyFormat(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
        return false;
    }
    
    // DirectoryBolt API keys are 64-character hexadecimal strings
    const apiKeyRegex = /^[a-f0-9]{64}$/i;
    return apiKeyRegex.test(apiKey);
}

/**
 * Set up API key from user input (enterprise security compliant)
 * @param {string} userApiKey - User-provided API key
 * @returns {Promise<boolean>} True if setup successful
 */
async function setupUserApiKey(userApiKey) {
    try {
        console.log('🔐 Setting up user-provided API key...');
        
        if (!userApiKey || typeof userApiKey !== 'string') {
            throw new Error('API key is required and must be a string');
        }
        
        if (!isValidApiKeyFormat(userApiKey)) {
            throw new Error('Invalid API key format. Must be 64-character hexadecimal string.');
        }
        
        // Store securely
        await chrome.storage.sync.set({ 
            autobolt_api_key: userApiKey,
            api_key_configured: true,
            configured_at: new Date().toISOString(),
            api_key_source: 'user_provided'
        });
        
        console.log('✅ User API key configured successfully');
        
        // Test the API connection
        if (typeof DirectoryBoltAPI !== 'undefined') {
            const api = new DirectoryBoltAPI();
            const connected = await api.testConnection();
            
            if (connected) {
                console.log('✅ API connection test successful');
                return true;
            } else {
                console.error('❌ API connection test failed');
                return false;
            }
        } else {
            console.log('ℹ️ DirectoryBoltAPI not loaded yet - will test connection later');
            return true;
        }
        
    } catch (error) {
        console.error('❌ Failed to setup user API key:', error);
        throw error;
    }
}

/**
 * Get API key status (without exposing the key)
 */
async function getApiKeyStatus() {
    try {
        const result = await chrome.storage.sync.get(['api_key_configured', 'configured_at']);
        
        return {
            configured: !!result.api_key_configured,
            configuredAt: result.configured_at || null,
            hasSecureStorage: typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync
        };
        
    } catch (error) {
        console.error('❌ Error getting API key status:', error);
        return {
            configured: false,
            configuredAt: null,
            hasSecureStorage: false,
            error: error.message
        };
    }
}

// ENTERPRISE SECURITY: NO AUTO-SETUP WITH HARDCODED KEYS
// Auto-setup is disabled for security compliance
// Users must manually configure their API keys through the extension popup
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    checkApiKeySetup().then(async (isConfigured) => {
        if (!isConfigured) {
            console.log('⚠️ API key not configured. User must provide API key through extension popup.');
            console.log('🔒 SECURITY: No auto-setup with hardcoded keys allowed.');
        } else {
            console.log('✅ AutoBolt extension API key already configured');
        }
    });
} else {
    console.log('ℹ️ Chrome extension environment not available - setup will be done later');
}

// Export functions for manual use (ENTERPRISE SECURITY COMPLIANT)
if (typeof window !== 'undefined') {
    window.autoBoltSetup = {
        setupUserApiKey,           // NEW: User-provided API key setup
        checkApiKeySetup,
        clearApiKey,
        getApiKeyStatus,
        isValidApiKeyFormat,       // NEW: API key validation
        // REMOVED: setupApiKey (had hardcoded keys)
    };
}

console.log('✅ AutoBolt API Key Setup script loaded');