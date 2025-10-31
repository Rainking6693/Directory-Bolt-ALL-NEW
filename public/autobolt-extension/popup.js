/**
 * AutoBolt Extension Popup Script
 * 
 * Handles customer validation and package tier management
 */

// Initialize PackageTierEngine
const packageEngine = new PackageTierEngine();

document.addEventListener('DOMContentLoaded', function() {
  // Customer tab elements
  const customerIdInput = document.getElementById('customerId');
  const validateBtn = document.getElementById('validateBtn');
  const statusDiv = document.getElementById('status');
  const packageInfoDiv = document.getElementById('packageInfo');
  
  // Security tab elements
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
  const clearApiKeyBtn = document.getElementById('clearApiKeyBtn');
  const apiKeyStatus = document.getElementById('apiKeyStatus');
  
  // Tab navigation
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Load saved customer ID
  chrome.storage.local.get(['customerId'], function(result) {
    if (result.customerId) {
      customerIdInput.value = result.customerId;
    }
  });

  // Event listeners for customer tab
  validateBtn.addEventListener('click', validateCustomer);
  customerIdInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      validateCustomer();
    }
  });
  
  // Event listeners for security tab
  saveApiKeyBtn.addEventListener('click', saveApiKey);
  clearApiKeyBtn.addEventListener('click', clearApiKey);
  apiKeyInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      saveApiKey();
    }
  });
  
  // Tab navigation
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
  
  // Initialize API key status
  checkApiKeyStatus();

  async function validateCustomer() {
    const customerId = customerIdInput.value.trim();
    
    if (!customerId) {
      showStatus('Please enter a Customer ID', 'error');
      return;
    }

    // Validate format
    if (!customerId.match(/^(DIR-|TEST-|DB-)/)) {
      showStatus('Invalid Customer ID format. Must start with DIR-, TEST-, or DB-', 'error');
      return;
    }

    showStatus('Validating customer...', 'loading');
    validateBtn.disabled = true;

    try {
      // Call DirectoryBolt validation API
      const response = await fetch('https://directorybolt.com/api/extension/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customerId,
          extensionVersion: '3.0.1',
          timestamp: Date.now()
        })
      });

      const result = await response.json();

      if (result.valid) {
        // Save customer ID
        chrome.storage.local.set({ 
          customerId: customerId,
          customerName: result.customerName,
          packageType: result.packageType
        });

        showStatus(`✅ Validated: ${result.customerName}`, 'success');
        showPackageInfo(result.packageType);
      } else {
        showStatus(`❌ ${result.error}`, 'error');
        hidePackageInfo();
      }

    } catch (error) {
      console.error('Validation error:', error);
      showStatus('❌ Connection failed. Please try again.', 'error');
      hidePackageInfo();
    } finally {
      validateBtn.disabled = false;
    }
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
  }

  function showPackageInfo(packageType) {
    const packageInfo = packageEngine.formatPackageDisplay(packageType);
    
    packageInfoDiv.innerHTML = `
      <strong>${packageInfo.name} Package</strong><br>
      Max Directories: ${packageInfo.maxDirectories}<br>
      Priority: ${packageInfo.priority}<br>
      Features: ${packageInfo.features.join(', ')}
    `;
    packageInfoDiv.style.display = 'block';
  }

  function hidePackageInfo() {
    packageInfoDiv.style.display = 'none';
  }
  
  // ========== SECURITY TAB FUNCTIONS ==========
  
  function switchTab(tabName) {
    // Update tab buttons
    tabs.forEach(tab => {
      if (tab.getAttribute('data-tab') === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // Update tab content
    tabContents.forEach(content => {
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }
  
  async function checkApiKeyStatus() {
    try {
      // Load setup script if not already loaded
      if (typeof window.autoBoltSetup === 'undefined') {
        await loadSetupScript();
      }
      
      const status = await window.autoBoltSetup.getApiKeyStatus();
      
      if (status.configured) {
        apiKeyStatus.textContent = '✅ API Key configured securely';
        apiKeyStatus.className = 'api-status configured';
        clearApiKeyBtn.style.display = 'block';
      } else {
        apiKeyStatus.textContent = '❌ API Key not configured';
        apiKeyStatus.className = 'api-status not-configured';
        clearApiKeyBtn.style.display = 'none';
      }
      
    } catch (error) {
      console.error('Error checking API key status:', error);
      apiKeyStatus.textContent = '❌ Error checking API key status';
      apiKeyStatus.className = 'api-status not-configured';
    }
  }
  
  async function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showSecurityStatus('Please enter an API key', 'error');
      return;
    }
    
    showSecurityStatus('Validating and saving API key...', 'loading');
    saveApiKeyBtn.disabled = true;
    
    try {
      // Load setup script if not already loaded
      if (typeof window.autoBoltSetup === 'undefined') {
        await loadSetupScript();
      }
      
      // Validate API key format
      if (!window.autoBoltSetup.isValidApiKeyFormat(apiKey)) {
        throw new Error('Invalid API key format. Must be 64-character hexadecimal string.');
      }
      
      // Setup API key
      await window.autoBoltSetup.setupUserApiKey(apiKey);
      
      // Clear input for security
      apiKeyInput.value = '';
      
      showSecurityStatus('✅ API key saved securely', 'success');
      await checkApiKeyStatus();
      
    } catch (error) {
      console.error('Error saving API key:', error);
      showSecurityStatus(`❌ ${error.message}`, 'error');
    } finally {
      saveApiKeyBtn.disabled = false;
    }
  }
  
  async function clearApiKey() {
    if (!confirm('Are you sure you want to clear the API key? This will disable AutoBolt functionality.')) {
      return;
    }
    
    showSecurityStatus('Clearing API key...', 'loading');
    clearApiKeyBtn.disabled = true;
    
    try {
      // Load setup script if not already loaded
      if (typeof window.autoBoltSetup === 'undefined') {
        await loadSetupScript();
      }
      
      await window.autoBoltSetup.clearApiKey();
      
      showSecurityStatus('✅ API key cleared', 'success');
      await checkApiKeyStatus();
      
    } catch (error) {
      console.error('Error clearing API key:', error);
      showSecurityStatus(`❌ ${error.message}`, 'error');
    } finally {
      clearApiKeyBtn.disabled = false;
    }
  }
  
  function showSecurityStatus(message, type) {
    // Create a temporary status div for security messages
    let securityStatus = document.getElementById('securityStatus');
    if (!securityStatus) {
      securityStatus = document.createElement('div');
      securityStatus.id = 'securityStatus';
      securityStatus.className = 'status';
      clearApiKeyBtn.parentNode.insertBefore(securityStatus, clearApiKeyBtn.nextSibling);
    }
    
    securityStatus.textContent = message;
    securityStatus.className = `status ${type}`;
    securityStatus.style.display = 'block';
    
    // Auto-hide success/error messages after 3 seconds
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        securityStatus.style.display = 'none';
      }, 3000);
    }
  }
  
  function loadSetupScript() {
    return new Promise((resolve, reject) => {
      if (typeof window.autoBoltSetup !== 'undefined') {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'setup-api-key.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
});