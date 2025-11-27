/**
 * VOIX Discovery Script
 * 
 * JavaScript injection script for browser-based VOIX tool and context discovery.
 * Based on arXiv:2511.11287 - Building the Web for Agents
 * Integration #74: VOIX Declarative Discovery Layer
 * 
 * This script is injected into web pages to discover <tool> and <context> tags.
 * It uses MutationObserver to monitor dynamic content updates.
 */

(function() {
    'use strict';

    /**
     * Discover all VOIX tools on the current page
     * @returns {Array<Object>} Array of discovered tool definitions
     */
    function discoverVoixTools() {
        const tools = [];
        const toolElements = document.querySelectorAll('tool');

        for (const toolElement of toolElements) {
            try {
                const tool = {
                    name: toolElement.getAttribute('name') || '',
                    description: toolElement.getAttribute('description') || '',
                    parameters: parseJSONAttribute(toolElement.getAttribute('parameters')),
                    endpoint: toolElement.getAttribute('endpoint') || null,
                    method: toolElement.getAttribute('method') || 'POST',
                    auth: toolElement.getAttribute('auth') || 'session',
                    visible: toolElement.getAttribute('visible') !== 'false',
                    element_id: toolElement.id || null
                };

                // Validate required attributes
                if (tool.name && tool.description) {
                    tools.push(tool);
                } else {
                    console.warn('[VOIX] Tool missing required attributes (name or description):', tool);
                }
            } catch (error) {
                console.error('[VOIX] Error parsing tool tag:', error, toolElement);
            }
        }

        return tools;
    }

    /**
     * Discover all VOIX contexts on the current page
     * @returns {Array<Object>} Array of discovered context definitions
     */
    function discoverVoixContexts() {
        const contexts = [];
        const contextElements = document.querySelectorAll('context');

        for (const contextElement of contextElements) {
            try {
                const context = {
                    name: contextElement.getAttribute('name') || '',
                    value: parseJSONAttribute(contextElement.getAttribute('value')),
                    scope: contextElement.getAttribute('scope') || 'local',
                    ttl: parseIntegerAttribute(contextElement.getAttribute('ttl'))
                };

                // Validate required attributes
                if (context.name && context.value) {
                    contexts.push(context);
                } else {
                    console.warn('[VOIX] Context missing required attributes (name or value):', context);
                }
            } catch (error) {
                console.error('[VOIX] Error parsing context tag:', error, contextElement);
            }
        }

        return contexts;
    }

    /**
     * Parse JSON attribute value safely
     * @param {string} value - JSON string to parse
     * @returns {Object} Parsed JSON object or empty object
     */
    function parseJSONAttribute(value) {
        if (!value) {
            return {};
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            console.warn('[VOIX] Failed to parse JSON attribute:', value, error);
            return {};
        }
    }

    /**
     * Parse integer attribute value safely
     * @param {string} value - Integer string to parse
     * @returns {number|null} Parsed integer or null
     */
    function parseIntegerAttribute(value) {
        if (!value) {
            return null;
        }

        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
    }

    /**
     * MutationObserver for dynamic content monitoring
     */
    class VoixMutationObserver {
        constructor(callback) {
            this.callback = callback;
            this.observer = null;
        }

        start() {
            if (this.observer) {
                return; // Already observing
            }

            this.observer = new MutationObserver((mutations) => {
                let shouldNotify = false;

                for (const mutation of mutations) {
                    // Check if any added nodes are VOIX tags
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName && (
                                node.tagName.toLowerCase() === 'tool' ||
                                node.tagName.toLowerCase() === 'context' ||
                                node.querySelector('tool') ||
                                node.querySelector('context')
                            )) {
                                shouldNotify = true;
                                break;
                            }
                        }
                    }

                    if (shouldNotify) {
                        break;
                    }
                }

                if (shouldNotify && this.callback) {
                    this.callback();
                }
            });

            // Observe the entire document for changes
            this.observer.observe(document.body || document.documentElement, {
                childList: true,
                subtree: true,
                attributes: false
            });

            console.log('[VOIX] MutationObserver started');
        }

        stop() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
                console.log('[VOIX] MutationObserver stopped');
            }
        }
    }

    /**
     * Message passing to Chrome extension or agent
     * @param {string} type - Message type
     * @param {Object} data - Message data
     */
    function sendMessage(type, data) {
        // Try Chrome runtime (extension)
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                type: type,
                source: 'voix_discovery',
                data: data
            }).catch((error) => {
                console.debug('[VOIX] Chrome runtime message failed (may not be in extension context):', error);
            });
        }

        // Try postMessage for iframe communication
        if (window.parent !== window) {
            window.parent.postMessage({
                type: type,
                source: 'voix_discovery',
                data: data
            }, '*');
        }

        // Dispatch custom event
        const event = new CustomEvent('voix-discovery', {
            detail: { type, data }
        });
        document.dispatchEvent(event);
    }

    // Global VOIX discovery object
    window.voixDiscovery = {
        discoverTools: discoverVoixTools,
        discoverContexts: discoverVoixContexts,
        MutationObserver: VoixMutationObserver,
        sendMessage: sendMessage,

        /**
         * Discover all VOIX tags and send notification
         */
        discover: function() {
            const tools = this.discoverTools();
            const contexts = this.discoverContexts();

            const result = {
                tools: tools,
                contexts: contexts,
                timestamp: new Date().toISOString(),
                url: window.location.href
            };

            sendMessage('voix_discovered', result);

            return result;
        },

        /**
         * Start continuous monitoring
         */
        startMonitoring: function() {
            if (!this._observer) {
                this._observer = new VoixMutationObserver(() => {
                    console.log('[VOIX] DOM changed, re-discovering tools/contexts');
                    this.discover();
                });
                this._observer.start();
            }
        },

        /**
         * Stop continuous monitoring
         */
        stopMonitoring: function() {
            if (this._observer) {
                this._observer.stop();
                this._observer = null;
            }
        }
    };

    // Auto-discover on page load if DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.voixDiscovery.discover();
        });
    } else {
        window.voixDiscovery.discover();
    }

    console.log('[VOIX] Discovery script loaded');
})();

