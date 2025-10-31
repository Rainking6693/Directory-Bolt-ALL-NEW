/**
 * AutoBolt Extension Content Script
 * 
 * Handles page interaction and form filling for directory submissions
 * Communicates with background script for job processing
 * 
 * Phase 3 - Task 3.3 Implementation
 * Agent: Alex (Full-Stack Engineer)
 */

console.log('🚀 AutoBolt content script loaded on:', window.location.hostname);

// Initialize content script
let isReady = false;
let hasBusinessData = false;
let formCount = 0;

// Send ready message to background script
function initializeContentScript() {
    // Analyze page for forms and business data capability
    analyzePageContent();
    
    // Send ready signal to background
    chrome.runtime.sendMessage({
        type: 'CONTENT_SCRIPT_READY',
        url: window.location.href,
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        hasBusinessData: hasBusinessData,
        formCount: formCount
    }, (response) => {
        if (response && response.success) {
            console.log('✅ AutoBolt content script ready on:', window.location.hostname);
            isReady = true;
        } else {
            console.error('❌ Failed to register content script with background');
        }
    });
}

// Analyze page content for business submission capabilities
function analyzePageContent() {
    try {
        // Count forms on the page
        const forms = document.querySelectorAll('form');
        formCount = forms.length;
        
        // Check for business-related form fields
        const businessFields = [
            'input[name*="business"]',
            'input[name*="company"]', 
            'input[name*="name"]',
            'input[name*="website"]',
            'input[name*="email"]',
            'input[name*="phone"]',
            'input[name*="address"]',
            'textarea[name*="description"]'
        ];
        
        let fieldCount = 0;
        businessFields.forEach(selector => {
            const fields = document.querySelectorAll(selector);
            fieldCount += fields.length;
        });
        
        // Consider page suitable for business data if it has forms and business fields
        hasBusinessData = formCount > 0 && fieldCount >= 3;
        
        console.log(`📋 AutoBolt: Page analysis - ${formCount} forms, ${fieldCount} business fields, suitable: ${hasBusinessData}`);
        
    } catch (error) {
        console.error('❌ AutoBolt: Error analyzing page content:', error);
        hasBusinessData = false;
        formCount = 0;
    }
}

// Fill business form with provided data
function fillBusinessForm(businessData) {
    try {
        console.log('📝 AutoBolt: Filling business form with data...');
        
        // Common field mappings
        const fieldMappings = {
            // Business name variants
            'business_name': businessData.businessName,
            'company_name': businessData.businessName,
            'company': businessData.businessName,
            'business': businessData.businessName,
            'name': businessData.businessName,
            'title': businessData.businessName,
            
            // Website
            'website': businessData.website,
            'url': businessData.website,
            'web_site': businessData.website,
            'homepage': businessData.website,
            
            // Contact info
            'email': businessData.email,
            'phone': businessData.phone,
            'telephone': businessData.phone,
            
            // Address fields
            'address': businessData.address,
            'street': businessData.address,
            'street_address': businessData.address,
            'city': businessData.city,
            'state': businessData.state,
            'zip': businessData.zipCode,
            'zipcode': businessData.zipCode,
            'postal_code': businessData.zipCode,
            
            // Description
            'description': businessData.description,
            'about': businessData.description,
            'summary': businessData.description,
            'bio': businessData.description
        };
        
        let fieldsFilledCount = 0;
        
        // Fill input fields
        Object.entries(fieldMappings).forEach(([fieldName, value]) => {
            if (!value) return;
            
            // Try multiple selector patterns
            const selectors = [
                `input[name="${fieldName}"]`,
                `input[name*="${fieldName}"]`,
                `input[id="${fieldName}"]`,
                `input[id*="${fieldName}"]`,
                `textarea[name="${fieldName}"]`,
                `textarea[name*="${fieldName}"]`,
                `textarea[id="${fieldName}"]`,
                `textarea[id*="${fieldName}"]`
            ];
            
            for (const selector of selectors) {
                const field = document.querySelector(selector);
                if (field && !field.value) {
                    field.value = value;
                    field.dispatchEvent(new Event('input', { bubbles: true }));
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                    fieldsFilledCount++;
                    console.log(`✅ AutoBolt: Filled field ${fieldName} with: ${value}`);
                    break;
                }
            }
        });
        
        console.log(`📝 AutoBolt: Form filling complete - ${fieldsFilledCount} fields filled`);
        return fieldsFilledCount;
        
    } catch (error) {
        console.error('❌ AutoBolt: Error filling form:', error);
        return 0;
    }
}

// Submit form and handle response
async function submitForm() {
    try {
        console.log('📤 AutoBolt: Attempting form submission...');
        
        // Find the primary form (usually the first one or one with submit button)
        const forms = document.querySelectorAll('form');
        let targetForm = null;
        
        // Look for form with submit button
        for (const form of forms) {
            const submitBtn = form.querySelector('input[type="submit"], button[type="submit"], button:not([type])');
            if (submitBtn) {
                targetForm = form;
                break;
            }
        }
        
        // Fallback to first form
        if (!targetForm && forms.length > 0) {
            targetForm = forms[0];
        }
        
        if (!targetForm) {
            throw new Error('No suitable form found for submission');
        }
        
        // Find submit button
        const submitBtn = targetForm.querySelector(
            'input[type="submit"], button[type="submit"], button:not([type]), .submit-btn, .btn-submit'
        );
        
        if (submitBtn) {
            // Click submit button
            submitBtn.click();
            console.log('✅ AutoBolt: Form submitted via button click');
            return true;
        } else {
            // Try form.submit() as fallback
            targetForm.submit();
            console.log('✅ AutoBolt: Form submitted via form.submit()');
            return true;
        }
        
    } catch (error) {
        console.error('❌ AutoBolt: Error submitting form:', error);
        return false;
    }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 AutoBolt content script received message:', request.type);
    
    switch (request.type) {
        case 'FILL_BUSINESS_FORM':
            try {
                const fieldsFilledCount = fillBusinessForm(request.businessData);
                sendResponse({ 
                    success: true, 
                    fieldsFilledCount,
                    message: `Filled ${fieldsFilledCount} form fields`
                });
            } catch (error) {
                sendResponse({ 
                    success: false, 
                    error: error.message 
                });
            }
            break;
            
        case 'SUBMIT_FORM':
            submitForm().then(success => {
                sendResponse({ 
                    success: success,
                    message: success ? 'Form submitted successfully' : 'Form submission failed'
                });
            }).catch(error => {
                sendResponse({ 
                    success: false, 
                    error: error.message 
                });
            });
            return true; // Keep message channel open for async response
            
        case 'ANALYZE_PAGE':
            try {
                analyzePageContent();
                sendResponse({ 
                    success: true,
                    data: {
                        hasBusinessData,
                        formCount,
                        url: window.location.href,
                        hostname: window.location.hostname
                    }
                });
            } catch (error) {
                sendResponse({ 
                    success: false, 
                    error: error.message 
                });
            }
            break;
            
        case 'GET_PAGE_STATUS':
            sendResponse({ 
                success: true,
                data: {
                    isReady,
                    hasBusinessData,
                    formCount,
                    url: window.location.href,
                    hostname: window.location.hostname
                }
            });
            break;
            
        default:
            console.log('❓ AutoBolt: Unknown message type:', request.type);
            sendResponse({ success: false, error: 'Unknown message type' });
    }
    
    return true;
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
    initializeContentScript();
}

// Re-analyze if page content changes significantly
let lastFormCount = 0;
const observer = new MutationObserver((mutations) => {
    const currentFormCount = document.querySelectorAll('form').length;
    if (currentFormCount !== lastFormCount) {
        lastFormCount = currentFormCount;
        console.log('🔄 AutoBolt: Page forms changed, re-analyzing...');
        setTimeout(analyzePageContent, 1000); // Debounce
    }
});

// Start observing page changes
observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('✅ AutoBolt content script initialized');