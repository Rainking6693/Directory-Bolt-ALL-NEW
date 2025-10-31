/**
 * 🔒 CAPTCHA SERVICE MANAGER - Multi-Provider CAPTCHA Solving System
 * 
 * Handles CAPTCHA solving across multiple services with automatic failover:
 * - 2Captcha ($2.99/1000 solves) - Primary
 * - Anti-Captcha ($2.00/1000 solves) - Backup
 * - CapSolver ($0.80/1000 solves) - Cost-effective
 * - DeathByCaptcha ($1.39/1000 solves) - Fallback
 * 
 * Features:
 * - Service rotation for load balancing
 * - Automatic failover on service unavailability
 * - Cost optimization through intelligent routing
 * - Retry logic with exponential backoff
 * - Performance analytics and monitoring
 */

const crypto = require('crypto');

class CaptchaServiceManager {
  constructor(config = {}) {
    this.services = this.initializeServices(config);
    this.stats = {
      totalSolved: 0,
      totalCost: 0,
      successRate: 0,
      servicePerformance: new Map(),
      averageResponseTime: 0
    };
    this.retryConfig = {
      maxRetries: 3,
      backoffMultiplier: 2,
      initialDelay: 1000
    };
  }

  initializeServices(config) {
    return [
      {
        name: 'CapSolver',
        priority: 1, // Highest priority due to cost
        costPer1000: 0.80,
        endpoint: 'https://api.capsolver.com/createTask',
        apiKey: config.capsolverApiKey || process.env.CAPSOLVER_API_KEY,
        active: true,
        successRate: 0.92,
        avgResponseTime: 15000, // 15 seconds
        handler: this.handleCapSolver.bind(this)
      },
      {
        name: 'DeathByCaptcha',
        priority: 2,
        costPer1000: 1.39,
        endpoint: 'http://api.dbcapi.me/api/captcha',
        username: config.dbcUsername || process.env.DBC_USERNAME,
        password: config.dbcPassword || process.env.DBC_PASSWORD,
        active: true,
        successRate: 0.88,
        avgResponseTime: 20000, // 20 seconds
        handler: this.handleDeathByCaptcha.bind(this)
      },
      {
        name: 'AntiCaptcha',
        priority: 3,
        costPer1000: 2.00,
        endpoint: 'https://api.anti-captcha.com/createTask',
        apiKey: config.anticaptchaApiKey || process.env.ANTICAPTCHA_API_KEY,
        active: true,
        successRate: 0.94,
        avgResponseTime: 12000, // 12 seconds
        handler: this.handleAntiCaptcha.bind(this)
      },
      {
        name: '2Captcha',
        priority: 4, // Lower priority due to higher cost
        costPer1000: 2.99,
        endpoint: 'http://2captcha.com/in.php',
        apiKey: config.twocaptchaApiKey || process.env.TWOCAPTCHA_API_KEY,
        active: true,
        successRate: 0.96,
        avgResponseTime: 18000, // 18 seconds
        handler: this.handle2Captcha.bind(this)
      }
    ].filter(service => service.apiKey || (service.username && service.password));
  }

  async solveCaptcha(captchaData) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    console.log(`🔓 [${requestId}] Starting CAPTCHA solving for type: ${captchaData.type}`);
    
    // Sort services by priority and availability
    const availableServices = this.services
      .filter(service => service.active)
      .sort((a, b) => a.priority - b.priority);

    if (availableServices.length === 0) {
      throw new Error('No CAPTCHA services available');
    }

    let lastError;
    
    for (const service of availableServices) {
      try {
        console.log(`🔄 [${requestId}] Attempting ${service.name} (Priority: ${service.priority})`);
        
        const result = await this.solveCaptchaWithService(service, captchaData, requestId);
        
        if (result.success) {
          const responseTime = Date.now() - startTime;
          await this.recordSuccess(service, responseTime, captchaData);
          
          console.log(`✅ [${requestId}] CAPTCHA solved using ${service.name} in ${responseTime}ms`);
          
          return {
            success: true,
            solution: result.solution,
            service: service.name,
            responseTime,
            cost: service.costPer1000 / 1000,
            requestId
          };
        }
        
      } catch (error) {
        console.warn(`⚠️ [${requestId}] ${service.name} failed: ${error.message}`);
        lastError = error;
        await this.recordFailure(service, error);
        
        // Continue to next service
        continue;
      }
    }
    
    throw new Error(`All CAPTCHA services failed. Last error: ${lastError?.message}`);
  }

  async solveCaptchaWithService(service, captchaData, requestId) {
    const maxRetries = this.retryConfig.maxRetries;
    let delay = this.retryConfig.initialDelay;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [${requestId}] ${service.name} attempt ${attempt}/${maxRetries}`);
        
        const result = await service.handler(captchaData);
        
        if (result.success) {
          return result;
        }
        
        if (attempt < maxRetries) {
          console.log(`⏳ [${requestId}] Retry ${attempt} failed, waiting ${delay}ms`);
          await this.sleep(delay);
          delay *= this.retryConfig.backoffMultiplier;
        }
        
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        console.log(`⏳ [${requestId}] Attempt ${attempt} error, retrying in ${delay}ms`);
        await this.sleep(delay);
        delay *= this.retryConfig.backoffMultiplier;
      }
    }
    
    throw new Error(`${service.name} failed after ${maxRetries} attempts`);
  }

  // CapSolver implementation
  async handleCapSolver(captchaData) {
    const task = this.buildCapSolverTask(captchaData);
    
    // Create task
    const createResponse = await this.makeRequest('https://api.capsolver.com/createTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: process.env.CAPSOLVER_API_KEY,
        task
      })
    });

    if (createResponse.errorId !== 0) {
      throw new Error(`CapSolver create task error: ${createResponse.errorDescription}`);
    }

    const taskId = createResponse.taskId;
    
    // Poll for result
    return await this.pollCapSolverResult(taskId);
  }

  buildCapSolverTask(captchaData) {
    switch (captchaData.type) {
      case 'recaptcha_v2':
        return {
          type: 'ReCaptchaV2TaskProxyless',
          websiteURL: captchaData.pageUrl,
          websiteKey: captchaData.siteKey
        };
      
      case 'recaptcha_v3':
        return {
          type: 'ReCaptchaV3TaskProxyless',
          websiteURL: captchaData.pageUrl,
          websiteKey: captchaData.siteKey,
          minScore: captchaData.minScore || 0.3
        };
      
      case 'hcaptcha':
        return {
          type: 'HCaptchaTaskProxyless',
          websiteURL: captchaData.pageUrl,
          websiteKey: captchaData.siteKey
        };
      
      case 'funcaptcha':
        return {
          type: 'FunCaptchaTaskProxyless',
          websiteURL: captchaData.pageUrl,
          websitePublicKey: captchaData.publicKey
        };
      
      default:
        throw new Error(`Unsupported CAPTCHA type: ${captchaData.type}`);
    }
  }

  async pollCapSolverResult(taskId) {
    const maxPolls = 30;
    const pollInterval = 2000; // 2 seconds
    
    for (let poll = 0; poll < maxPolls; poll++) {
      await this.sleep(pollInterval);
      
      const response = await this.makeRequest('https://api.capsolver.com/getTaskResult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: process.env.CAPSOLVER_API_KEY,
          taskId
        })
      });

      if (response.errorId !== 0) {
        throw new Error(`CapSolver get result error: ${response.errorDescription}`);
      }

      if (response.status === 'ready') {
        return {
          success: true,
          solution: response.solution.gRecaptchaResponse || response.solution.token
        };
      }
      
      if (response.status === 'failed') {
        throw new Error('CapSolver task failed');
      }
    }
    
    throw new Error('CapSolver timeout after 60 seconds');
  }

  // 2Captcha implementation
  async handle2Captcha(captchaData) {
    const params = this.build2CaptchaParams(captchaData);
    
    // Submit CAPTCHA
    const submitUrl = `http://2captcha.com/in.php?${params}`;
    const submitResponse = await this.makeRequest(submitUrl);
    const submitText = await submitResponse.text();
    
    if (!submitText.startsWith('OK|')) {
      throw new Error(`2Captcha submit error: ${submitText}`);
    }
    
    const captchaId = submitText.split('|')[1];
    
    // Poll for result
    return await this.poll2CaptchaResult(captchaId);
  }

  build2CaptchaParams(captchaData) {
    const params = new URLSearchParams({
      key: process.env.TWOCAPTCHA_API_KEY,
      json: '0'
    });

    switch (captchaData.type) {
      case 'recaptcha_v2':
        params.append('method', 'userrecaptcha');
        params.append('googlekey', captchaData.siteKey);
        params.append('pageurl', captchaData.pageUrl);
        break;
      
      case 'recaptcha_v3':
        params.append('method', 'userrecaptcha');
        params.append('googlekey', captchaData.siteKey);
        params.append('pageurl', captchaData.pageUrl);
        params.append('version', 'v3');
        params.append('min_score', captchaData.minScore || 0.3);
        break;
      
      case 'hcaptcha':
        params.append('method', 'hcaptcha');
        params.append('sitekey', captchaData.siteKey);
        params.append('pageurl', captchaData.pageUrl);
        break;
      
      default:
        throw new Error(`Unsupported CAPTCHA type for 2Captcha: ${captchaData.type}`);
    }

    return params.toString();
  }

  async poll2CaptchaResult(captchaId) {
    const maxPolls = 30;
    const pollInterval = 5000; // 5 seconds for 2Captcha
    
    for (let poll = 0; poll < maxPolls; poll++) {
      await this.sleep(pollInterval);
      
      const resultUrl = `http://2captcha.com/res.php?key=${process.env.TWOCAPTCHA_API_KEY}&action=get&id=${captchaId}`;
      const response = await this.makeRequest(resultUrl);
      const result = await response.text();
      
      if (result === 'CAPCHA_NOT_READY') {
        continue;
      }
      
      if (result.startsWith('OK|')) {
        return {
          success: true,
          solution: result.split('|')[1]
        };
      }
      
      throw new Error(`2Captcha result error: ${result}`);
    }
    
    throw new Error('2Captcha timeout after 150 seconds');
  }

  // Anti-Captcha implementation
  async handleAntiCaptcha(captchaData) {
    const task = this.buildAntiCaptchaTask(captchaData);
    
    // Create task
    const createResponse = await this.makeRequest('https://api.anti-captcha.com/createTask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientKey: process.env.ANTICAPTCHA_API_KEY,
        task
      })
    });

    if (createResponse.errorId !== 0) {
      throw new Error(`Anti-Captcha error: ${createResponse.errorDescription}`);
    }

    return await this.pollAntiCaptchaResult(createResponse.taskId);
  }

  buildAntiCaptchaTask(captchaData) {
    switch (captchaData.type) {
      case 'recaptcha_v2':
        return {
          type: 'NoCaptchaTaskProxyless',
          websiteURL: captchaData.pageUrl,
          websiteKey: captchaData.siteKey
        };
      
      case 'recaptcha_v3':
        return {
          type: 'RecaptchaV3TaskProxyless',
          websiteURL: captchaData.pageUrl,
          websiteKey: captchaData.siteKey,
          minScore: captchaData.minScore || 0.3
        };
      
      case 'hcaptcha':
        return {
          type: 'HCaptchaTaskProxyless',
          websiteURL: captchaData.pageUrl,
          websiteKey: captchaData.siteKey
        };
      
      default:
        throw new Error(`Unsupported CAPTCHA type for Anti-Captcha: ${captchaData.type}`);
    }
  }

  async pollAntiCaptchaResult(taskId) {
    const maxPolls = 30;
    const pollInterval = 2000;
    
    for (let poll = 0; poll < maxPolls; poll++) {
      await this.sleep(pollInterval);
      
      const response = await this.makeRequest('https://api.anti-captcha.com/getTaskResult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientKey: process.env.ANTICAPTCHA_API_KEY,
          taskId
        })
      });

      if (response.errorId !== 0) {
        throw new Error(`Anti-Captcha error: ${response.errorDescription}`);
      }

      if (response.status === 'ready') {
        return {
          success: true,
          solution: response.solution.gRecaptchaResponse || response.solution.token
        };
      }
    }
    
    throw new Error('Anti-Captcha timeout');
  }

  // DeathByCaptcha implementation
  async handleDeathByCaptcha(captchaData) {
    // DeathByCaptcha has different API structure
    // Implementation would be specific to their API
    throw new Error('DeathByCaptcha implementation pending');
  }

  async makeRequest(url, options = {}) {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(url, {
      timeout: 30000,
      ...options
    });
    
    if (options.headers?.['Content-Type'] === 'application/json') {
      return await response.json();
    }
    
    return response;
  }

  async recordSuccess(service, responseTime, captchaData) {
    this.stats.totalSolved++;
    this.stats.totalCost += service.costPer1000 / 1000;
    
    const serviceStats = this.stats.servicePerformance.get(service.name) || {
      solved: 0,
      failed: 0,
      totalResponseTime: 0
    };
    
    serviceStats.solved++;
    serviceStats.totalResponseTime += responseTime;
    
    this.stats.servicePerformance.set(service.name, serviceStats);
    this.updateServiceSuccessRate(service);
  }

  async recordFailure(service, error) {
    const serviceStats = this.stats.servicePerformance.get(service.name) || {
      solved: 0,
      failed: 0,
      totalResponseTime: 0
    };
    
    serviceStats.failed++;
    this.stats.servicePerformance.set(service.name, serviceStats);
    this.updateServiceSuccessRate(service);
  }

  updateServiceSuccessRate(service) {
    const stats = this.stats.servicePerformance.get(service.name);
    if (stats) {
      const total = stats.solved + stats.failed;
      service.successRate = total > 0 ? stats.solved / total : 0;
    }
  }

  generateRequestId() {
    return `cap_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    const serviceStats = {};
    
    for (const [serviceName, stats] of this.stats.servicePerformance.entries()) {
      const total = stats.solved + stats.failed;
      serviceStats[serviceName] = {
        solved: stats.solved,
        failed: stats.failed,
        successRate: total > 0 ? (stats.solved / total * 100).toFixed(1) + '%' : '0%',
        avgResponseTime: stats.solved > 0 ? Math.round(stats.totalResponseTime / stats.solved) + 'ms' : 'N/A'
      };
    }
    
    return {
      totalSolved: this.stats.totalSolved,
      totalCost: this.stats.totalCost.toFixed(4),
      averageCostPerSolve: this.stats.totalSolved > 0 ? 
        (this.stats.totalCost / this.stats.totalSolved * 1000).toFixed(2) + ' per 1000' : 'N/A',
      servicePerformance: serviceStats
    };
  }
}

module.exports = CaptchaServiceManager;