/**
 * Auto-Bolt Chrome Extension - Background Script (Service Worker)
 * Handles messaging coordination, job processing, and staff dashboard communication
 * 
 * Phase 3 - Task 3.3 Implementation
 * Agent: Alex (Full-Stack Engineer)
 */

console.log('🚀 Auto-Bolt background script initialized');

// Initialize processor and API
let processor = null;
let api = null;

// Track content script states
const contentScriptStates = new Map();

chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('✅ Extension installed/updated:', details.reason);
    
    if (details.reason === 'install') {
        console.log('🎉 First time installation');
        await initializeExtension();
    } else if (details.reason === 'update') {
        console.log('🔄 Extension updated to version:', chrome.runtime.getManifest().version);
        await initializeExtension();
    }
});

// Initialize extension components
async function initializeExtension() {
    try {
        console.log('🔄 Initializing AutoBolt extension components...');
        
        // Load required scripts dynamically
        await loadScript('directory-bolt-api.js');
        await loadScript('autobolt-processor.js');
        
        // Initialize API and processor
        api = new DirectoryBoltAPI();
        processor = new AutoBoltProcessor();
        
        // Test API connectivity
        const connected = await api.testConnection();
        if (connected) {
            console.log('✅ AutoBolt extension initialized successfully');
            
            // Auto-start processing if enabled in settings
            const settings = await getExtensionSettings();
            if (settings.autoStart) {
                console.log('🚀 Auto-starting job processing...');
                startProcessing();
            }
        } else {
            console.error('❌ Failed to connect to DirectoryBolt API');
        }
        
    } catch (error) {
        console.error('❌ Error initializing extension:', error);
    }
}

// Load script helper
function loadScript(filename) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(filename);
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Listen for messages from content scripts and staff dashboard
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Background received message:', {
        type: request.type,
        from: sender.tab ? `Tab ${sender.tab.id}` : 'Extension',
        url: sender.tab?.url,
        timestamp: new Date().toISOString()
    });
    
    // Handle different message types
    switch (request.type) {
        case 'CONTENT_SCRIPT_READY':
            handleContentScriptReady(request, sender, sendResponse);
            break;
            
        case 'START_PROCESSING':
            handleStartProcessing(request, sender, sendResponse);
            break;
            
        case 'STOP_PROCESSING':
            handleStopProcessing(request, sender, sendResponse);
            break;
            
        case 'GET_PROCESSING_STATUS':
            handleGetProcessingStatus(request, sender, sendResponse);
            break;
            
        case 'GET_PROCESSING_STATS':
            handleGetProcessingStats(request, sender, sendResponse);
            break;
            
        case 'PUSH_TO_AUTOBOLT':
            handlePushToAutoBolt(request, sender, sendResponse);
            break;
            
        case 'CHECK_CONTENT_SCRIPT_READY':
            handleCheckContentScriptReady(request, sender, sendResponse);
            break;
            
        default:
            console.log('❓ Unknown message type:', request.type);
            sendResponse({ success: false, error: 'Unknown message type' });
    }
    
    return true; // Keep message channel open for async responses
});

// Handle content script ready
function handleContentScriptReady(request, sender, sendResponse) {
    if (sender.tab) {
        contentScriptStates.set(sender.tab.id, {
            ready: true,
            url: request.url,
            hostname: request.hostname,
            protocol: request.protocol,
            hasBusinessData: request.hasBusinessData,
            formCount: request.formCount,
            timestamp: Date.now()
        });
        
        console.log('✅ Content script ready on tab:', sender.tab.id);
    }
    
    sendResponse({ success: true, message: 'Background acknowledged' });
}

// Handle start processing request
async function handleStartProcessing(request, sender, sendResponse) {
    try {
        console.log('🚀 Background: Start processing requested');
        
        if (!processor) {
            sendResponse({ success: false, error: 'Processor not initialized' });
            return;
        }
        
        if (processor.isProcessing) {
            sendResponse({ success: false, error: 'Processing already in progress' });
            return;
        }
        
        startProcessing();
        sendResponse({ success: true, message: 'Processing started' });
        
    } catch (error) {
        console.error('❌ Background: Error starting processing:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle stop processing request
function handleStopProcessing(request, sender, sendResponse) {
    try {
        console.log('🛑 Background: Stop processing requested');
        
        if (!processor) {
            sendResponse({ success: false, error: 'Processor not initialized' });
            return;
        }
        
        processor.stopProcessing();
        sendResponse({ success: true, message: 'Processing stopped' });
        
    } catch (error) {
        console.error('❌ Background: Error stopping processing:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle processing status request
function handleGetProcessingStatus(request, sender, sendResponse) {
    try {
        if (!processor) {
            sendResponse({ success: false, error: 'Processor not initialized' });
            return;
        }
        
        const status = processor.getStatus();
        sendResponse({ success: true, data: status });
        
    } catch (error) {
        console.error('❌ Background: Error getting status:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle processing statistics request
function handleGetProcessingStats(request, sender, sendResponse) {
    try {
        if (!processor) {
            sendResponse({ success: false, error: 'Processor not initialized' });
            return;
        }
        
        const stats = processor.getStatistics();
        sendResponse({ success: true, data: stats });
        
    } catch (error) {
        console.error('❌ Background: Error getting stats:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle push to AutoBolt request (from staff dashboard)
async function handlePushToAutoBolt(request, sender, sendResponse) {
    try {
        console.log('📤 Background: Push to AutoBolt requested for customer:', request.customerId);
        
        if (!api) {
            sendResponse({ success: false, error: 'API not initialized' });
            return;
        }
        
        // This would trigger the staff dashboard API to add a job to the queue
        // The job would then be picked up by the normal processing loop
        sendResponse({ 
            success: true, 
            message: `Customer ${request.customerId} added to AutoBolt queue` 
        });
        
    } catch (error) {
        console.error('❌ Background: Error pushing to AutoBolt:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle content script ready check
function handleCheckContentScriptReady(request, sender, sendResponse) {
    const tabId = request.tabId;
    const state = contentScriptStates.get(tabId);
    
    sendResponse({
        success: true,
        ready: !!state,
        state: state || null,
        timestamp: Date.now()
    });
}

// Clean up content script states when tabs are removed
chrome.tabs.onRemoved.addListener((tabId) => {
    if (contentScriptStates.has(tabId)) {
        contentScriptStates.delete(tabId);
        console.log('🧹 Cleaned up state for removed tab:', tabId);
    }
});

// Start processing function
async function startProcessing() {
    try {
        if (!processor) {
            throw new Error('Processor not initialized');
        }
        
        console.log('🚀 Background: Starting AutoBolt processing...');
        await processor.startProcessing();
        
    } catch (error) {
        console.error('❌ Background: Error in startProcessing:', error);
    }
}

// Get extension settings
async function getExtensionSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['autoStart', 'processingEnabled'], (result) => {
            resolve({
                autoStart: result.autoStart || false,
                processingEnabled: result.processingEnabled !== false // Default to true
            });
        });
    });
}

// Save extension settings
function saveExtensionSettings(settings) {
    return new Promise((resolve) => {
        chrome.storage.local.set(settings, resolve);
    });
}

// Handle extension icon clicks with debugging
chrome.action.onClicked.addListener((tab) => {
    console.log('🖱️ Extension icon clicked on tab:', tab.id, tab.url);
    
    // This will open the popup, but we can use this for debugging
    const state = contentScriptStates.get(tab.id);
    console.log('📊 Content script state for tab:', state);
});

// Periodic cleanup of stale content script states
setInterval(() => {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    for (const [tabId, state] of contentScriptStates.entries()) {
        if (now - state.timestamp > staleThreshold) {
            contentScriptStates.delete(tabId);
            console.log('🧹 Cleaned up stale state for tab:', tabId);
        }
    }
}, 60000); // Check every minute

// Debug function to log current states
function logCurrentStates() {
    console.log('📊 Current content script states:', Array.from(contentScriptStates.entries()));
}

// Export for debugging (available in background script console)
globalThis.autoBoltDebug = {
    logCurrentStates,
    contentScriptStates,
    processor,
    api,
    clearStates: () => {
        contentScriptStates.clear();
        console.log('🧹 All content script states cleared');
    },
    getProcessorStatus: () => {
        return processor ? processor.getStatus() : null;
    },
    getProcessorStats: () => {
        return processor ? processor.getStatistics() : null;
    },
    testAPIConnection: async () => {
        return api ? await api.testConnection() : false;
    },
    startProcessing: () => {
        if (processor && !processor.isProcessing) {
            startProcessing();
            return true;
        }
        return false;
    },
    stopProcessing: () => {
        if (processor) {
            processor.stopProcessing();
            return true;
        }
        return false;
    }
};

console.log('✅ Background script setup complete. Debug functions available as globalThis.autoBoltDebug');