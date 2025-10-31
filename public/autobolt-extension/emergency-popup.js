/**
 * AutoBolt Emergency Monitoring Popup Script
 * Provides real-time monitoring and emergency controls
 */

console.log('🚨 AutoBolt Emergency Monitoring Popup Loaded');

// State management
let monitoringState = {
    extensionActive: false,
    processingActive: false,
    debugMode: false,
    watchMode: false,
    lastUpdate: null,
    activities: [],
    errors: [],
    metrics: {}
};

let updateInterval = null;

// Initialize popup when DOM loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializePopup();
        setupEventListeners();
        startPeriodicUpdates();
        console.log('✅ Emergency monitoring popup initialized');
    } catch (error) {
        console.error('❌ Error initializing popup:', error);
        showError('Failed to initialize monitoring popup');
    }
});

// Initialize popup state
async function initializePopup() {
    try {
        // Show loading state
        updateLastUpdate('Initializing...');
        
        // Fetch initial state from background script
        await refreshAllData();
        
    } catch (error) {
        console.error('Error in initializePopup:', error);
        throw error;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Emergency controls
    document.getElementById('emergency-stop-btn').addEventListener('click', handleEmergencyStop);
    
    // Monitoring controls
    document.getElementById('debug-toggle').addEventListener('click', handleDebugToggle);
    document.getElementById('watch-toggle').addEventListener('click', handleWatchToggle);
    document.getElementById('capture-screenshot').addEventListener('click', handleCaptureScreenshot);
    document.getElementById('export-logs').addEventListener('click', handleExportLogs);
    
    // Processing controls
    document.getElementById('start-processing').addEventListener('click', handleStartProcessing);
    document.getElementById('stop-processing').addEventListener('click', handleStopProcessing);
    document.getElementById('refresh-status').addEventListener('click', handleRefreshStatus);
    document.getElementById('view-dashboard').addEventListener('click', handleViewDashboard);
    
    // Screenshot click handler
    document.getElementById('latest-screenshot').addEventListener('click', handleScreenshotClick);
}

// Start periodic updates
function startPeriodicUpdates() {
    // Update every 5 seconds
    updateInterval = setInterval(async () => {
        try {
            await refreshAllData();
        } catch (error) {
            console.error('Error in periodic update:', error);
        }
    }, 5000);
    
    // Clear interval when popup closes
    window.addEventListener('beforeunload', () => {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
    });
}

// Refresh all monitoring data
async function refreshAllData() {
    try {
        // Get monitoring data from background script
        const response = await sendMessageToBackground({
            type: 'GET_MONITORING_DATA'
        });
        
        if (response.success) {
            monitoringState = {
                ...monitoringState,
                ...response.data,
                lastUpdate: new Date()
            };
            
            updateUI();
        } else {
            throw new Error(response.error || 'Failed to get monitoring data');
        }
        
    } catch (error) {
        console.error('Error refreshing data:', error);
        showError('Failed to refresh monitoring data');
    }
}

// Update UI with current state
function updateUI() {
    try {
        updateStatusCards();
        updateMetrics();
        updateActivityLog();
        updateScreenshot();
        updateControlStates();
        updateLastUpdate();
        
    } catch (error) {
        console.error('Error updating UI:', error);
    }
}

// Update status cards
function updateStatusCards() {
    // Extension status
    const extensionCard = document.getElementById('extension-status');
    const extensionValue = document.getElementById('extension-value');
    
    if (monitoringState.emergencyMonitoring?.enabled) {
        extensionCard.className = 'status-card active';
        extensionValue.textContent = 'Active';
    } else {
        extensionCard.className = 'status-card error';
        extensionValue.textContent = 'Inactive';
    }
    
    // Processing status
    const processingCard = document.getElementById('processing-status');
    const processingValue = document.getElementById('processing-value');
    
    if (monitoringState.emergencyMonitoring?.processingActive) {
        processingCard.className = 'status-card active pulse';
        processingValue.textContent = 'Running';
    } else {
        processingCard.className = 'status-card';
        processingValue.textContent = 'Stopped';
    }
    
    // Debug mode status
    const debugCard = document.getElementById('debug-status');
    const debugValue = document.getElementById('debug-value');
    
    if (monitoringState.emergencyMonitoring?.debugMode) {
        debugCard.className = 'status-card active';
        debugValue.textContent = 'ON';
    } else {
        debugCard.className = 'status-card';
        debugValue.textContent = 'OFF';
    }
    
    // Watch mode status
    const watchCard = document.getElementById('watch-status');
    const watchValue = document.getElementById('watch-value');
    
    if (monitoringState.emergencyMonitoring?.watchMode) {
        watchCard.className = 'status-card active pulse';
        watchValue.textContent = 'ON';
    } else {
        watchCard.className = 'status-card';
        watchValue.textContent = 'OFF';
    }
}

// Update performance metrics
function updateMetrics() {
    const activitiesCount = document.getElementById('activities-count');
    const errorsCount = document.getElementById('errors-count');
    const uptimeValue = document.getElementById('uptime-value');
    
    const activities = monitoringState.activityLog || [];
    const errors = monitoringState.errorLog || [];
    const metrics = monitoringState.performanceMetrics || {};
    
    activitiesCount.textContent = activities.length;
    errorsCount.textContent = errors.length;
    
    // Calculate uptime
    if (metrics.startTime) {
        const uptime = Date.now() - metrics.startTime;
        const minutes = Math.floor(uptime / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            uptimeValue.textContent = `${hours}h ${minutes % 60}m`;
        } else {
            uptimeValue.textContent = `${minutes}m`;
        }
    } else {
        uptimeValue.textContent = '0m';
    }
}

// Update activity log
function updateActivityLog() {
    const activityLog = document.getElementById('activity-log');
    const activities = monitoringState.activityLog || [];
    const errors = monitoringState.errorLog || [];
    
    // Combine and sort activities and errors
    const allEntries = [
        ...activities.slice(-10).map(a => ({ ...a, type: 'activity' })),
        ...errors.slice(-5).map(e => ({ ...e, type: 'error' }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (allEntries.length === 0) {
        activityLog.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 20px;">No recent activity</div>';
        return;
    }
    
    activityLog.innerHTML = allEntries.map(entry => {
        const timestamp = new Date(entry.timestamp).toLocaleTimeString();
        const entryClass = entry.type === 'error' ? 'log-entry error' : 
                          entry.action?.includes('SUCCESS') || entry.details?.status === 'success' ? 'log-entry success' : 
                          'log-entry';
        
        let content = '';
        if (entry.type === 'error') {
            content = `<strong>ERROR:</strong> ${entry.message || entry.type}`;
        } else {
            content = `<strong>${entry.action}:</strong> ${entry.details?.directory || entry.details?.url || 'System activity'}`;
        }
        
        return `
            <div class="${entryClass}">
                <div>${content}</div>
                <div class="log-timestamp">${timestamp}</div>
            </div>
        `;
    }).join('');
}

// Update screenshot display
function updateScreenshot() {
    const screenshotSection = document.getElementById('screenshot-section');
    const screenshotImg = document.getElementById('latest-screenshot');
    const screenshotTimestamp = document.getElementById('screenshot-timestamp');
    
    if (monitoringState.emergencyMonitoring?.lastScreenshot) {
        screenshotSection.style.display = 'block';
        screenshotImg.src = `data:image/png;base64,${monitoringState.emergencyMonitoring.lastScreenshot}`;
        screenshotTimestamp.textContent = `Captured: ${new Date().toLocaleTimeString()}`;
    } else {
        screenshotSection.style.display = 'none';
    }
}

// Update control button states
function updateControlStates() {
    const debugToggle = document.getElementById('debug-toggle');
    const watchToggle = document.getElementById('watch-toggle');
    const startBtn = document.getElementById('start-processing');
    const stopBtn = document.getElementById('stop-processing');
    
    // Debug toggle
    if (monitoringState.emergencyMonitoring?.debugMode) {
        debugToggle.className = 'btn btn-warning active';
        debugToggle.textContent = '🐛 Debug ON';
    } else {
        debugToggle.className = 'btn btn-warning';
        debugToggle.textContent = '🐛 Debug Mode';
    }
    
    // Watch toggle
    if (monitoringState.emergencyMonitoring?.watchMode) {
        watchToggle.className = 'btn btn-primary active pulse';
        watchToggle.textContent = '👁️ Watch ON';
    } else {
        watchToggle.className = 'btn btn-primary';
        watchToggle.textContent = '👁️ Watch Mode';
    }
    
    // Processing controls
    const isProcessing = monitoringState.emergencyMonitoring?.processingActive;
    startBtn.disabled = isProcessing;
    stopBtn.disabled = !isProcessing;
}

// Update last update timestamp
function updateLastUpdate(customText = null) {
    const lastUpdateEl = document.getElementById('last-update');
    if (customText) {
        lastUpdateEl.textContent = customText;
    } else if (monitoringState.lastUpdate) {
        lastUpdateEl.textContent = monitoringState.lastUpdate.toLocaleTimeString();
    }
}

// Event handlers
async function handleEmergencyStop() {
    if (!confirm('⚠️ This will immediately stop ALL AutoBolt operations. Are you sure?')) {
        return;
    }
    
    try {
        showLoading('Executing emergency stop...');
        
        const response = await sendMessageToBackground({
            type: 'EMERGENCY_STOP'
        });
        
        if (response.success) {
            showSuccess('Emergency stop executed successfully');
            await refreshAllData();
        } else {
            throw new Error(response.error);
        }
        
    } catch (error) {
        console.error('Emergency stop failed:', error);
        showError(`Emergency stop failed: ${error.message}`);
    }
}

async function handleDebugToggle() {
    try {
        const newState = !monitoringState.emergencyMonitoring?.debugMode;
        const action = newState ? 'ENABLE_DEBUG_MODE' : 'DISABLE_DEBUG_MODE';
        
        const response = await sendMessageToBackground({ type: action });
        
        if (response.success) {
            showSuccess(`Debug mode ${newState ? 'enabled' : 'disabled'}`);
            await refreshAllData();
        } else {
            throw new Error(response.error);
        }
        
    } catch (error) {
        console.error('Debug toggle failed:', error);
        showError(`Debug toggle failed: ${error.message}`);
    }
}

async function handleWatchToggle() {
    try {
        const newState = !monitoringState.emergencyMonitoring?.watchMode;
        const action = newState ? 'ENABLE_WATCH_MODE' : 'DISABLE_WATCH_MODE';
        
        const response = await sendMessageToBackground({ type: action });
        
        if (response.success) {
            showSuccess(`Watch mode ${newState ? 'enabled' : 'disabled'}`);
            await refreshAllData();
        } else {
            throw new Error(response.error);
        }
        
    } catch (error) {
        console.error('Watch toggle failed:', error);
        showError(`Watch toggle failed: ${error.message}`);
    }
}

async function handleCaptureScreenshot() {
    try {
        showLoading('Capturing screenshot...');
        
        const response = await sendMessageToBackground({
            type: 'CAPTURE_SCREENSHOT'
        });
        
        if (response.success) {
            showSuccess('Screenshot captured');
            await refreshAllData();
        } else {
            throw new Error(response.error);
        }
        
    } catch (error) {
        console.error('Screenshot capture failed:', error);
        showError(`Screenshot capture failed: ${error.message}`);
    }
}

async function handleExportLogs() {
    try {
        const exportData = {
            timestamp: new Date().toISOString(),
            monitoringState,
            activities: monitoringState.activityLog || [],
            errors: monitoringState.errorLog || [],
            metrics: monitoringState.performanceMetrics || {}
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `autobolt-emergency-logs-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showSuccess('Logs exported successfully');
        
    } catch (error) {
        console.error('Log export failed:', error);
        showError(`Log export failed: ${error.message}`);
    }
}

async function handleStartProcessing() {
    try {
        const response = await sendMessageToBackground({
            type: 'START_PROCESSING'
        });
        
        if (response.success) {
            showSuccess('Processing started');
            await refreshAllData();
        } else {
            throw new Error(response.error);
        }
        
    } catch (error) {
        console.error('Start processing failed:', error);
        showError(`Start processing failed: ${error.message}`);
    }
}

async function handleStopProcessing() {
    try {
        const response = await sendMessageToBackground({
            type: 'STOP_PROCESSING'
        });
        
        if (response.success) {
            showSuccess('Processing stopped');
            await refreshAllData();
        } else {
            throw new Error(response.error);
        }
        
    } catch (error) {
        console.error('Stop processing failed:', error);
        showError(`Stop processing failed: ${error.message}`);
    }
}

async function handleRefreshStatus() {
    try {
        showLoading('Refreshing...');
        await refreshAllData();
        showSuccess('Status refreshed');
    } catch (error) {
        console.error('Refresh failed:', error);
        showError('Refresh failed');
    }
}

function handleViewDashboard() {
    try {
        chrome.tabs.create({
            url: 'https://directorybolt.com/admin/monitoring'
        });
    } catch (error) {
        console.error('Failed to open dashboard:', error);
        showError('Failed to open dashboard');
    }
}

function handleScreenshotClick() {
    // Open screenshot in new tab for detailed view
    const screenshotData = monitoringState.emergencyMonitoring?.lastScreenshot;
    if (screenshotData) {
        const newWindow = window.open();
        newWindow.document.write(`
            <html>
                <head><title>AutoBolt Screenshot</title></head>
                <body style="margin:0; background:#000; display:flex; justify-content:center; align-items:center; min-height:100vh;">
                    <img src="data:image/png;base64,${screenshotData}" style="max-width:100%; max-height:100%; border:1px solid #ccc;">
                </body>
            </html>
        `);
    }
}

// Utility functions
function sendMessageToBackground(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
            resolve(response || { success: false, error: 'No response from background script' });
        });
    });
}

function showLoading(message) {
    updateLastUpdate(message);
}

function showSuccess(message) {
    updateLastUpdate(`✅ ${message}`);
    setTimeout(() => updateLastUpdate(), 3000);
}

function showError(message) {
    updateLastUpdate(`❌ ${message}`);
    setTimeout(() => updateLastUpdate(), 5000);
}

console.log('✅ Emergency monitoring popup script loaded');