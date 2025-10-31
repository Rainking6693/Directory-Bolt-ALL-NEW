/**
 * AutoBolt Chrome Extension - Enhanced Background Script with Emergency Monitoring
 * Handles messaging coordination, job processing, real-time monitoring, and emergency controls
 * 
 * Emergency Monitoring Features:
 * - Real-time activity tracking
 * - Screenshot capture
 * - Live error reporting
 * - Emergency stop functionality
 * - Debug mode with detailed logging
 */

console.log('🚀 AutoBolt Enhanced Emergency Monitoring Background Script Initialized');

// Core components
let processor = null;
let api = null;

// Emergency monitoring state
let emergencyMonitoring = {
  enabled: false,
  debugMode: false,
  watchMode: false,
  screenshotInterval: null,
  activityLog: [],
  errorLog: [],
  performanceMetrics: {
    startTime: Date.now(),
    totalActivities: 0,
    successfulActivities: 0,
    failedActivities: 0,
    averageResponseTime: 0
  }
};

// Track content script states with enhanced monitoring
const contentScriptStates = new Map();
const activeTabs = new Map();

// Initialize extension with monitoring capabilities
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('✅ Enhanced Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    console.log('🎉 First time installation - Setting up emergency monitoring');
    await initializeExtensionWithMonitoring();
    await setupEmergencyMonitoring();
  } else if (details.reason === 'update') {
    console.log('🔄 Extension updated - Reinitializing monitoring');
    await initializeExtensionWithMonitoring();
  }
});

// Initialize extension with enhanced monitoring
async function initializeExtensionWithMonitoring() {
  try {
    console.log('🔄 Initializing AutoBolt extension with emergency monitoring...');
    
    // Load required scripts
    await loadScript('directory-bolt-api.js');
    await loadScript('autobolt-processor.js');
    
    // Initialize API and processor
    api = new DirectoryBoltAPI();
    processor = new AutoBoltProcessor();
    
    // Test API connectivity
    const connected = await api.testConnection();
    if (connected) {
      console.log('✅ AutoBolt extension initialized successfully');
      
      // Start monitoring services
      await startEmergencyMonitoring();
      
      // Send heartbeat to monitoring system
      await sendHeartbeat();
      
      // Set up periodic heartbeat
      setInterval(sendHeartbeat, 30000); // Every 30 seconds
      
    } else {
      console.error('❌ Failed to connect to DirectoryBolt API');
      await logError('API_CONNECTION_FAILED', 'Failed to connect to DirectoryBolt API', null);
    }
    
  } catch (error) {
    console.error('❌ Error initializing extension:', error);
    await logError('INITIALIZATION_ERROR', error.message, error.stack);
  }
}

// Setup emergency monitoring infrastructure
async function setupEmergencyMonitoring() {
  try {
    emergencyMonitoring.enabled = true;
    
    // Set up command polling
    setInterval(checkForCommands, 5000); // Check every 5 seconds
    
    // Set up performance monitoring
    setInterval(updatePerformanceMetrics, 10000); // Every 10 seconds
    
    // Set up activity log cleanup
    setInterval(cleanupActivityLog, 60000); // Every minute
    
    console.log('✅ Emergency monitoring infrastructure setup complete');
    
  } catch (error) {
    console.error('❌ Error setting up emergency monitoring:', error);
  }
}

// Start emergency monitoring services
async function startEmergencyMonitoring() {
  try {
    // Fetch current system configuration
    const config = await fetchSystemConfig();
    
    if (config.debug_mode?.enabled) {
      enableDebugMode();
    }
    
    if (config.watch_mode?.enabled) {
      enableWatchMode();
    }
    
    // Start activity monitoring
    startActivityMonitoring();
    
    console.log('✅ Emergency monitoring services started');
    
  } catch (error) {
    console.error('❌ Error starting emergency monitoring:', error);
  }
}

// Enhanced message handling with monitoring
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const timestamp = new Date().toISOString();
  
  // Log all message activity
  logActivity('MESSAGE_RECEIVED', {
    type: request.type,
    from: sender.tab ? `Tab ${sender.tab.id}` : 'Extension',
    url: sender.tab?.url,
    timestamp
  });
  
  console.log('📨 Enhanced Background received message:', {
    type: request.type,
    from: sender.tab ? `Tab ${sender.tab.id}` : 'Extension',
    url: sender.tab?.url,
    timestamp
  });
  
  // Handle emergency monitoring messages
  switch (request.type) {
    case 'ENABLE_DEBUG_MODE':
      handleEnableDebugMode(request, sender, sendResponse);
      break;
      
    case 'DISABLE_DEBUG_MODE':
      handleDisableDebugMode(request, sender, sendResponse);
      break;
      
    case 'ENABLE_WATCH_MODE':
      handleEnableWatchMode(request, sender, sendResponse);
      break;
      
    case 'DISABLE_WATCH_MODE':
      handleDisableWatchMode(request, sender, sendResponse);
      break;
      
    case 'CAPTURE_SCREENSHOT':
      handleCaptureScreenshot(request, sender, sendResponse);
      break;
      
    case 'EMERGENCY_STOP':
      handleEmergencyStop(request, sender, sendResponse);
      break;
      
    case 'GET_MONITORING_DATA':
      handleGetMonitoringData(request, sender, sendResponse);
      break;
      
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
      
    case 'DIRECTORY_INTERACTION':
      handleDirectoryInteraction(request, sender, sendResponse);
      break;
      
    default:
      console.log('❓ Unknown message type:', request.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
  
  return true; // Keep message channel open for async responses
});

// Emergency monitoring message handlers
async function handleEnableDebugMode(request, sender, sendResponse) {
  try {
    enableDebugMode();
    await updateSystemConfig('debug_mode', { enabled: true, enabledAt: new Date().toISOString() });
    logActivity('DEBUG_MODE_ENABLED', { enabledBy: 'extension' });
    sendResponse({ success: true, message: 'Debug mode enabled' });
  } catch (error) {
    await logError('DEBUG_MODE_ERROR', error.message, error.stack);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleDisableDebugMode(request, sender, sendResponse) {
  try {
    disableDebugMode();
    await updateSystemConfig('debug_mode', { enabled: false, disabledAt: new Date().toISOString() });
    logActivity('DEBUG_MODE_DISABLED', { disabledBy: 'extension' });
    sendResponse({ success: true, message: 'Debug mode disabled' });
  } catch (error) {
    await logError('DEBUG_MODE_ERROR', error.message, error.stack);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleEnableWatchMode(request, sender, sendResponse) {
  try {
    enableWatchMode();
    await updateSystemConfig('watch_mode', { enabled: true, enabledAt: new Date().toISOString() });
    logActivity('WATCH_MODE_ENABLED', { enabledBy: 'extension' });
    sendResponse({ success: true, message: 'Watch mode enabled' });
  } catch (error) {
    await logError('WATCH_MODE_ERROR', error.message, error.stack);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleDisableWatchMode(request, sender, sendResponse) {
  try {
    disableWatchMode();
    await updateSystemConfig('watch_mode', { enabled: false, disabledAt: new Date().toISOString() });
    logActivity('WATCH_MODE_DISABLED', { disabledBy: 'extension' });
    sendResponse({ success: true, message: 'Watch mode disabled' });
  } catch (error) {
    await logError('WATCH_MODE_ERROR', error.message, error.stack);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleCaptureScreenshot(request, sender, sendResponse) {
  try {
    const screenshot = await captureCurrentScreenshot();
    
    // Send screenshot to monitoring system
    await sendScreenshotToMonitoring(screenshot, sender.tab);
    
    logActivity('SCREENSHOT_CAPTURED', { 
      tabId: sender.tab?.id,
      url: sender.tab?.url,
      size: screenshot.length 
    });
    
    sendResponse({ success: true, screenshot, timestamp: new Date().toISOString() });
  } catch (error) {
    await logError('SCREENSHOT_ERROR', error.message, error.stack);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleEmergencyStop(request, sender, sendResponse) {
  try {
    await executeEmergencyStop();
    logActivity('EMERGENCY_STOP_EXECUTED', { initiatedBy: 'extension' });
    sendResponse({ success: true, message: 'Emergency stop executed' });
  } catch (error) {
    await logError('EMERGENCY_STOP_ERROR', error.message, error.stack);
    sendResponse({ success: false, error: error.message });
  }
}

function handleGetMonitoringData(request, sender, sendResponse) {
  try {
    const monitoringData = {
      emergencyMonitoring,
      activityLog: emergencyMonitoring.activityLog.slice(-50), // Last 50 activities
      errorLog: emergencyMonitoring.errorLog.slice(-20), // Last 20 errors
      contentScriptStates: Array.from(contentScriptStates.entries()),
      activeTabs: Array.from(activeTabs.entries()),
      performanceMetrics: emergencyMonitoring.performanceMetrics
    };
    
    sendResponse({ success: true, data: monitoringData });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleDirectoryInteraction(request, sender, sendResponse) {
  try {
    const { action, directory, customer, status, details } = request.data;
    
    // Log the directory interaction
    logActivity('DIRECTORY_INTERACTION', {
      action,
      directory,
      customer,
      status,
      details,
      tabId: sender.tab?.id,
      url: sender.tab?.url
    });
    
    // Send to monitoring API
    await sendActivityToAPI({
      type: 'activity',
      data: {
        action,
        directory,
        customer,
        status,
        details,
        metadata: {
          tabId: sender.tab?.id,
          url: sender.tab?.url,
          timestamp: new Date().toISOString()
        }
      }
    });
    
    // Update performance metrics
    emergencyMonitoring.performanceMetrics.totalActivities++;
    if (status === 'success') {
      emergencyMonitoring.performanceMetrics.successfulActivities++;
    } else if (status === 'error') {
      emergencyMonitoring.performanceMetrics.failedActivities++;
    }
    
    sendResponse({ success: true });
    
  } catch (error) {
    await logError('DIRECTORY_INTERACTION_ERROR', error.message, error.stack);
    sendResponse({ success: false, error: error.message });
  }
}

// Enhanced content script ready handler
function handleContentScriptReady(request, sender, sendResponse) {
  if (sender.tab) {
    const tabState = {
      ready: true,
      url: request.url,
      hostname: request.hostname,
      protocol: request.protocol,
      hasBusinessData: request.hasBusinessData,
      formCount: request.formCount,
      timestamp: Date.now()
    };
    
    contentScriptStates.set(sender.tab.id, tabState);
    activeTabs.set(sender.tab.id, {
      title: sender.tab.title,
      url: sender.tab.url,
      status: 'ready',
      timestamp: new Date().toISOString()
    });
    
    logActivity('CONTENT_SCRIPT_READY', {
      tabId: sender.tab.id,
      url: request.url,
      formCount: request.formCount
    });
    
    console.log('✅ Enhanced content script ready on tab:', sender.tab.id);
  }
  
  sendResponse({ success: true, message: 'Background acknowledged with monitoring' });
}

// Emergency monitoring utility functions
function enableDebugMode() {
  emergencyMonitoring.debugMode = true;
  console.log('🐛 Debug mode enabled - Enhanced logging active');
}

function disableDebugMode() {
  emergencyMonitoring.debugMode = false;
  console.log('🐛 Debug mode disabled');
}

function enableWatchMode() {
  emergencyMonitoring.watchMode = true;
  
  // Start screenshot capture interval
  if (emergencyMonitoring.screenshotInterval) {
    clearInterval(emergencyMonitoring.screenshotInterval);
  }
  
  emergencyMonitoring.screenshotInterval = setInterval(async () => {
    try {
      const screenshot = await captureCurrentScreenshot();
      await sendScreenshotToMonitoring(screenshot);
    } catch (error) {
      console.error('Error in watch mode screenshot:', error);
    }
  }, 3000); // Every 3 seconds
  
  console.log('👁️ Watch mode enabled - Screenshot monitoring active');
}

function disableWatchMode() {
  emergencyMonitoring.watchMode = false;
  
  if (emergencyMonitoring.screenshotInterval) {
    clearInterval(emergencyMonitoring.screenshotInterval);
    emergencyMonitoring.screenshotInterval = null;
  }
  
  console.log('👁️ Watch mode disabled');
}

async function captureCurrentScreenshot() {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        // Convert data URL to base64
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      }
    });
  });
}

async function executeEmergencyStop() {
  try {
    // Stop processor if running
    if (processor) {
      processor.stopProcessing();
    }
    
    // Clear all intervals
    if (emergencyMonitoring.screenshotInterval) {
      clearInterval(emergencyMonitoring.screenshotInterval);
    }
    
    // Send emergency stop to API
    await sendActivityToAPI({
      type: 'emergency_stop',
      data: {
        timestamp: new Date().toISOString(),
        initiatedBy: 'extension'
      }
    });
    
    console.log('🛑 Emergency stop executed');
    
  } catch (error) {
    console.error('❌ Error executing emergency stop:', error);
    throw error;
  }
}

// Activity and error logging
function logActivity(action, details = {}) {
  const activity = {
    action,
    details,
    timestamp: new Date().toISOString()
  };
  
  emergencyMonitoring.activityLog.push(activity);
  
  if (emergencyMonitoring.debugMode) {
    console.log('📝 Activity logged:', activity);
  }
  
  // Send to API if monitoring is enabled
  if (emergencyMonitoring.enabled) {
    sendActivityToAPI({
      type: 'activity',
      data: activity
    }).catch(error => {
      console.error('Error sending activity to API:', error);
    });
  }
}

async function logError(type, message, stack = null) {
  const error = {
    type,
    message,
    stack,
    timestamp: new Date().toISOString()
  };
  
  emergencyMonitoring.errorLog.push(error);
  
  console.error('❌ Error logged:', error);
  
  // Send to API
  try {
    await sendActivityToAPI({
      type: 'error',
      data: error
    });
  } catch (apiError) {
    console.error('Failed to send error to API:', apiError);
  }
}

// API communication functions
async function sendHeartbeat() {
  try {
    await sendActivityToAPI({
      type: 'heartbeat',
      data: {
        extensionId: chrome.runtime.id,
        version: chrome.runtime.getManifest().version,
        status: 'active',
        debugMode: emergencyMonitoring.debugMode,
        watchMode: emergencyMonitoring.watchMode,
        activeTabs: activeTabs.size,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to send heartbeat:', error);
  }
}

async function sendScreenshotToMonitoring(screenshot, tab = null) {
  try {
    await sendActivityToAPI({
      type: 'screenshot',
      data: {
        screenshot,
        tabInfo: tab ? {
          id: tab.id,
          title: tab.title,
          url: tab.url
        } : null,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to send screenshot to monitoring:', error);
  }
}

async function sendActivityToAPI(payload) {
  if (!api) return;
  
  try {
    const response = await fetch(api.baseUrl + '/api/autobolt/live-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api.apiKey}`
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
  } catch (error) {
    console.error('Error sending activity to API:', error);
    throw error;
  }
}

async function fetchSystemConfig() {
  if (!api) return {};
  
  try {
    const response = await fetch(api.baseUrl + '/api/autobolt/debug-mode', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${api.apiKey}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    
  } catch (error) {
    console.error('Error fetching system config:', error);
  }
  
  return {};
}

async function updateSystemConfig(key, value) {
  if (!api) return;
  
  try {
    await fetch(api.baseUrl + `/api/autobolt/${key.replace('_', '-')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api.apiKey}`
      },
      body: JSON.stringify({ enabled: value.enabled })
    });
    
  } catch (error) {
    console.error('Error updating system config:', error);
  }
}

async function checkForCommands() {
  if (!api) return;
  
  try {
    const response = await fetch(api.baseUrl + '/api/autobolt/commands', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${api.apiKey}`
      }
    });
    
    if (response.ok) {
      const commands = await response.json();
      for (const command of commands.data || []) {
        await executeCommand(command);
      }
    }
    
  } catch (error) {
    console.error('Error checking for commands:', error);
  }
}

async function executeCommand(command) {
  try {
    switch (command.command) {
      case 'emergency_stop':
        await executeEmergencyStop();
        break;
      case 'start_screenshot_capture':
        enableWatchMode();
        break;
      case 'stop_screenshot_capture':
        disableWatchMode();
        break;
      case 'capture_screenshot':
        await captureCurrentScreenshot();
        break;
    }
    
    logActivity('COMMAND_EXECUTED', { command: command.command });
    
  } catch (error) {
    await logError('COMMAND_EXECUTION_ERROR', error.message, error.stack);
  }
}

// Utility functions
function cleanupActivityLog() {
  // Keep only last 100 activities
  if (emergencyMonitoring.activityLog.length > 100) {
    emergencyMonitoring.activityLog = emergencyMonitoring.activityLog.slice(-100);
  }
  
  // Keep only last 50 errors
  if (emergencyMonitoring.errorLog.length > 50) {
    emergencyMonitoring.errorLog = emergencyMonitoring.errorLog.slice(-50);
  }
}

function updatePerformanceMetrics() {
  const now = Date.now();
  const uptime = now - emergencyMonitoring.performanceMetrics.startTime;
  
  emergencyMonitoring.performanceMetrics.uptime = uptime;
  emergencyMonitoring.performanceMetrics.successRate = 
    emergencyMonitoring.performanceMetrics.totalActivities > 0 
      ? emergencyMonitoring.performanceMetrics.successfulActivities / emergencyMonitoring.performanceMetrics.totalActivities 
      : 0;
}

function startActivityMonitoring() {
  // Monitor tab updates
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && activeTabs.has(tabId)) {
      activeTabs.set(tabId, {
        ...activeTabs.get(tabId),
        title: tab.title,
        url: tab.url,
        status: 'updated',
        timestamp: new Date().toISOString()
      });
      
      logActivity('TAB_UPDATED', { tabId, url: tab.url, title: tab.title });
    }
  });
  
  // Monitor tab removal
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (activeTabs.has(tabId)) {
      activeTabs.delete(tabId);
      logActivity('TAB_REMOVED', { tabId });
    }
    
    if (contentScriptStates.has(tabId)) {
      contentScriptStates.delete(tabId);
    }
  });
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

// Enhanced debug functions
globalThis.autoBoltEmergencyDebug = {
  getMonitoringState: () => emergencyMonitoring,
  getActivityLog: () => emergencyMonitoring.activityLog,
  getErrorLog: () => emergencyMonitoring.errorLog,
  getActiveTabs: () => Array.from(activeTabs.entries()),
  getContentScriptStates: () => Array.from(contentScriptStates.entries()),
  enableDebugMode,
  disableDebugMode,
  enableWatchMode,
  disableWatchMode,
  captureScreenshot: captureCurrentScreenshot,
  executeEmergencyStop,
  logActivity,
  logError,
  sendHeartbeat,
  clearLogs: () => {
    emergencyMonitoring.activityLog = [];
    emergencyMonitoring.errorLog = [];
    console.log('🧹 All logs cleared');
  }
};

console.log('✅ Enhanced Emergency Monitoring Background Script Setup Complete');
console.log('🐛 Debug functions available as globalThis.autoBoltEmergencyDebug');