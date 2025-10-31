/**
 * AutoBolt Enhanced Content Script with Activity Logging
 * Provides detailed tracking and monitoring of directory submission activities
 * 
 * Features:
 * - Real-time form field tracking
 * - Screenshot capture on key interactions
 * - Detailed error logging and reporting
 * - Performance metrics collection
 * - Emergency monitoring integration
 */

console.log('🚀 AutoBolt Enhanced Content Script with Activity Logging Loaded');

// Activity logging state
let activityLogger = {
  enabled: true,
  sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  interactions: [],
  formFields: new Map(),
  screenshots: [],
  errors: [],
  performance: {
    startTime: Date.now(),
    pageLoadTime: 0,
    formFillTime: 0,
    submissionTime: 0,
    totalInteractions: 0
  }
};

// Initialize enhanced content script
function initializeEnhancedContentScript() {
  try {
    // Record page load completion
    activityLogger.performance.pageLoadTime = Date.now() - activityLogger.performance.startTime;
    
    // Analyze page structure
    analyzePage();
    
    // Set up activity monitoring
    setupActivityMonitoring();
    
    // Set up form monitoring
    setupFormMonitoring();
    
    // Set up error monitoring
    setupErrorMonitoring();
    
    // Notify background script
    notifyBackgroundReady();
    
    // Log initialization
    logActivity('CONTENT_SCRIPT_INITIALIZED', {
      url: window.location.href,
      hostname: window.location.hostname,
      sessionId: activityLogger.sessionId,
      pageLoadTime: activityLogger.performance.pageLoadTime
    });
    
    console.log('✅ Enhanced content script initialized with activity logging');
    
  } catch (error) {
    logError('INITIALIZATION_ERROR', error.message, error.stack);
  }
}

// Analyze page structure for monitoring
function analyzePage() {
  try {
    const analysis = {
      forms: document.querySelectorAll('form').length,
      inputFields: document.querySelectorAll('input, textarea, select').length,
      submitButtons: document.querySelectorAll('button[type="submit"], input[type="submit"]').length,
      links: document.querySelectorAll('a').length,
      title: document.title,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
    
    logActivity('PAGE_ANALYZED', analysis);
    
    return analysis;
    
  } catch (error) {
    logError('PAGE_ANALYSIS_ERROR', error.message, error.stack);
    return null;
  }
}

// Set up comprehensive activity monitoring
function setupActivityMonitoring() {
  try {
    // Monitor mouse clicks with detailed tracking
    document.addEventListener('click', (event) => {
      const element = event.target;
      const elementInfo = getElementInfo(element);
      
      logActivity('MOUSE_CLICK', {
        element: elementInfo,
        coordinates: { x: event.clientX, y: event.clientY },
        timestamp: Date.now()
      });
      
      activityLogger.performance.totalInteractions++;
      
      // Capture screenshot for important clicks (buttons, links)
      if (element.tagName === 'BUTTON' || element.tagName === 'A' || element.type === 'submit') {
        setTimeout(() => captureScreenshot('IMPORTANT_CLICK'), 100);
      }
    });
    
    // Monitor keyboard inputs
    document.addEventListener('keydown', (event) => {
      // Don't log sensitive keys
      if (!['Enter', 'Tab', 'Escape', 'Backspace', 'Delete'].includes(event.key)) {
        return;
      }
      
      const element = event.target;
      const elementInfo = getElementInfo(element);
      
      logActivity('KEYBOARD_INPUT', {
        key: event.key,
        element: elementInfo,
        timestamp: Date.now()
      });
      
      activityLogger.performance.totalInteractions++;
    });
    
    // Monitor page scrolling
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        logActivity('PAGE_SCROLL', {
          scrollY: window.scrollY,
          scrollX: window.scrollX,
          timestamp: Date.now()
        });
      }, 500); // Debounce scroll events
    });
    
    // Monitor page visibility changes
    document.addEventListener('visibilitychange', () => {
      logActivity('VISIBILITY_CHANGE', {
        visible: !document.hidden,
        timestamp: Date.now()
      });
    });
    
    console.log('✅ Activity monitoring setup complete');
    
  } catch (error) {
    logError('ACTIVITY_MONITORING_SETUP_ERROR', error.message, error.stack);
  }
}

// Set up form field monitoring
function setupFormMonitoring() {
  try {
    const forms = document.querySelectorAll('form');
    
    forms.forEach((form, formIndex) => {
      // Monitor form submission
      form.addEventListener('submit', (event) => {
        const formData = new FormData(form);
        const formFields = {};
        
        // Collect non-sensitive form data
        for (let [key, value] of formData.entries()) {
          // Don't log sensitive data
          if (!key.toLowerCase().includes('password') && 
              !key.toLowerCase().includes('ssn') && 
              !key.toLowerCase().includes('credit')) {
            formFields[key] = typeof value === 'string' ? value.substring(0, 100) : '[FILE]';
          }
        }
        
        logActivity('FORM_SUBMITTED', {
          formIndex,
          formAction: form.action,
          formMethod: form.method,
          fieldCount: Object.keys(formFields).length,
          fields: formFields,
          timestamp: Date.now()
        });
        
        // Capture screenshot on form submission
        setTimeout(() => captureScreenshot('FORM_SUBMISSION'), 100);
        
        activityLogger.performance.submissionTime = Date.now();
      });
      
      // Monitor individual field changes
      const inputs = form.querySelectorAll('input, textarea, select');
      inputs.forEach((input, inputIndex) => {
        input.addEventListener('change', (event) => {
          const fieldInfo = {
            formIndex,
            inputIndex,
            fieldName: input.name || input.id,
            fieldType: input.type,
            hasValue: !!input.value,
            valueLength: input.value ? input.value.length : 0
          };
          
          activityLogger.formFields.set(`${formIndex}_${inputIndex}`, fieldInfo);
          
          logActivity('FORM_FIELD_CHANGED', fieldInfo);
        });
        
        // Monitor field focus/blur for timing
        input.addEventListener('focus', () => {
          logActivity('FORM_FIELD_FOCUSED', {
            formIndex,
            inputIndex,
            fieldName: input.name || input.id,
            timestamp: Date.now()
          });
        });
        
        input.addEventListener('blur', () => {
          logActivity('FORM_FIELD_BLURRED', {
            formIndex,
            inputIndex,
            fieldName: input.name || input.id,
            timestamp: Date.now()
          });
        });
      });
    });
    
    // Monitor for dynamically added forms
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const newForms = node.querySelectorAll ? node.querySelectorAll('form') : [];
            if (newForms.length > 0) {
              logActivity('DYNAMIC_FORMS_DETECTED', {
                count: newForms.length,
                timestamp: Date.now()
              });
              
              // Re-setup monitoring for new forms
              setTimeout(() => setupFormMonitoring(), 100);
            }
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log(`✅ Form monitoring setup for ${forms.length} forms`);
    
  } catch (error) {
    logError('FORM_MONITORING_SETUP_ERROR', error.message, error.stack);
  }
}

// Set up error monitoring
function setupErrorMonitoring() {
  try {
    // Monitor JavaScript errors
    window.addEventListener('error', (event) => {
      logError('JAVASCRIPT_ERROR', event.message, event.error?.stack, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
    
    // Monitor unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      logError('UNHANDLED_PROMISE_REJECTION', event.reason?.message || 'Unknown promise rejection', event.reason?.stack);
    });
    
    // Monitor network errors (basic detection)
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        if (!response.ok) {
          logActivity('NETWORK_ERROR', {
            url: args[0],
            status: response.status,
            statusText: response.statusText,
            timestamp: Date.now()
          });
        }
        
        return response;
      } catch (error) {
        logError('FETCH_ERROR', error.message, error.stack, { url: args[0] });
        throw error;
      }
    };
    
    console.log('✅ Error monitoring setup complete');
    
  } catch (error) {
    logError('ERROR_MONITORING_SETUP_ERROR', error.message, error.stack);
  }
}

// Screenshot capture functionality
async function captureScreenshot(reason = 'MANUAL') {
  try {
    // Request screenshot from background script
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'CAPTURE_SCREENSHOT',
        reason,
        tabInfo: {
          url: window.location.href,
          title: document.title,
          timestamp: Date.now()
        }
      }, resolve);
    });
    
    if (response.success) {
      activityLogger.screenshots.push({
        reason,
        timestamp: Date.now(),
        size: response.screenshot?.length || 0
      });
      
      logActivity('SCREENSHOT_CAPTURED', {
        reason,
        success: true,
        size: response.screenshot?.length || 0
      });
    }
    
    return response;
    
  } catch (error) {
    logError('SCREENSHOT_CAPTURE_ERROR', error.message, error.stack);
    return { success: false, error: error.message };
  }
}

// Directory submission tracking
function trackDirectorySubmission(directoryName, action, result) {
  try {
    const submissionData = {
      directory: directoryName,
      action,
      result,
      url: window.location.href,
      timestamp: Date.now(),
      sessionId: activityLogger.sessionId
    };
    
    logActivity('DIRECTORY_SUBMISSION', submissionData);
    
    // Send detailed tracking to background
    chrome.runtime.sendMessage({
      type: 'DIRECTORY_INTERACTION',
      data: {
        action: `${action}_${directoryName}`,
        directory: directoryName,
        customer: getCurrentCustomer(),
        status: result.success ? 'success' : 'error',
        details: result.message || result.error
      }
    });
    
    // Capture screenshot for submission results
    if (result.success || result.error) {
      setTimeout(() => captureScreenshot('SUBMISSION_RESULT'), 500);
    }
    
  } catch (error) {
    logError('DIRECTORY_SUBMISSION_TRACKING_ERROR', error.message, error.stack);
  }
}

// Utility functions
function getElementInfo(element) {
  try {
    return {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      name: element.name,
      type: element.type,
      textContent: element.textContent?.substring(0, 50) || '',
      href: element.href,
      src: element.src
    };
  } catch (error) {
    return { error: 'Could not get element info' };
  }
}

function getCurrentCustomer() {
  // Try to extract customer information from page or storage
  try {
    // This would be customized based on how customer data is available
    return localStorage.getItem('currentCustomer') || 
           sessionStorage.getItem('currentCustomer') || 
           'unknown';
  } catch (error) {
    return 'unknown';
  }
}

function logActivity(action, details = {}) {
  try {
    const activity = {
      action,
      details,
      timestamp: Date.now(),
      sessionId: activityLogger.sessionId,
      url: window.location.href
    };
    
    activityLogger.interactions.push(activity);
    
    // Keep only last 100 activities in memory
    if (activityLogger.interactions.length > 100) {
      activityLogger.interactions = activityLogger.interactions.slice(-100);
    }
    
    // Log to console in debug mode
    if (localStorage.getItem('autobolt_debug') === 'true') {
      console.log('📝 Activity:', activity);
    }
    
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

function logError(type, message, stack = null, context = {}) {
  try {
    const error = {
      type,
      message,
      stack,
      context,
      timestamp: Date.now(),
      sessionId: activityLogger.sessionId,
      url: window.location.href
    };
    
    activityLogger.errors.push(error);
    
    // Keep only last 50 errors in memory
    if (activityLogger.errors.length > 50) {
      activityLogger.errors = activityLogger.errors.slice(-50);
    }
    
    console.error('❌ Enhanced Content Script Error:', error);
    
  } catch (logError) {
    console.error('Error logging error:', logError);
  }
}

function notifyBackgroundReady() {
  try {
    const pageInfo = {
      url: window.location.href,
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      hasBusinessData: !!document.querySelector('form'),
      formCount: document.querySelectorAll('form').length,
      sessionId: activityLogger.sessionId
    };
    
    chrome.runtime.sendMessage({
      type: 'CONTENT_SCRIPT_READY',
      ...pageInfo
    }, (response) => {
      if (response?.success) {
        console.log('✅ Background script notified of enhanced content script ready state');
      }
    });
    
  } catch (error) {
    logError('BACKGROUND_NOTIFICATION_ERROR', error.message, error.stack);
  }
}

// Export functions for external use
window.autoBoltActivityLogger = {
  logActivity,
  logError,
  captureScreenshot,
  trackDirectorySubmission,
  getActivityLog: () => activityLogger.interactions,
  getErrorLog: () => activityLogger.errors,
  getPerformanceMetrics: () => activityLogger.performance,
  getSessionId: () => activityLogger.sessionId,
  clearLogs: () => {
    activityLogger.interactions = [];
    activityLogger.errors = [];
    activityLogger.screenshots = [];
    console.log('🧹 Activity logs cleared');
  },
  exportLogs: () => {
    const exportData = {
      sessionId: activityLogger.sessionId,
      url: window.location.href,
      timestamp: Date.now(),
      activities: activityLogger.interactions,
      errors: activityLogger.errors,
      screenshots: activityLogger.screenshots.map(s => ({ ...s, data: '[REMOVED]' })), // Remove actual screenshot data
      performance: activityLogger.performance,
      formFields: Array.from(activityLogger.formFields.entries())
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autobolt-activity-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeEnhancedContentScript);
} else {
  initializeEnhancedContentScript();
}

console.log('✅ Enhanced Content Script with Activity Logging Setup Complete');