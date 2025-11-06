const fs = require('fs');
const path = require('path');

const BASE_DIR = ".";

console.log("\n" + "=".repeat(80));
console.log("AI SYSTEMS AUDIT REPORT - DirectoryBolt");
console.log("=".repeat(80) + "\n");

// 1. Check environment variables
console.log("1. ENVIRONMENT VARIABLES:");
console.log("-".repeat(80));
const envPath = path.join(BASE_DIR, '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const hasAnthropicKey = envContent.includes('ANTHROPIC_API_KEY=');
    const hasGeminiKey = envContent.includes('GEMINI_API_KEY=');
    const hasOpenAIKey = envContent.includes('OPENAI_API_KEY=');

    console.log(`  ANTHROPIC_API_KEY: ${hasAnthropicKey ? 'SET' : 'MISSING'}`);
    console.log(`  GEMINI_API_KEY:    ${hasGeminiKey ? 'SET' : 'MISSING'}`);
    console.log(`  OPENAI_API_KEY:    ${hasOpenAIKey ? 'SET' : 'MISSING'}`);
}

// 2. Check AI services exist
console.log("\n2. CRITICAL AI SERVICES:");
console.log("-".repeat(80));
const services = [
    'lib/services/ai-service.ts',
    'lib/services/ai-business-analyzer.ts',
    'lib/services/ai-business-intelligence-engine.ts',
    'lib/utils/anthropic-client.ts'
];

services.forEach(service => {
    const fullPath = path.join(BASE_DIR, service);
    const exists = fs.existsSync(fullPath);
    console.log(`  ${service}: ${exists ? 'EXISTS' : 'MISSING'}`);
});

// 3. Check API endpoints
console.log("\n3. API ENDPOINTS:");
console.log("-".repeat(80));
const apiDir = path.join(BASE_DIR, 'pages/api/ai');
const endpoints = fs.readdirSync(apiDir).filter(f => f.endsWith('.ts')).length;
console.log(`  Total AI endpoints: ${endpoints}`);

// 4. Check status endpoint imports
console.log("\n4. STATUS ENDPOINT ANALYSIS:");
console.log("-".repeat(80));
const statusEndpoint = path.join(BASE_DIR, 'pages/api/ai/status.ts');
if (fs.existsSync(statusEndpoint)) {
    const content = fs.readFileSync(statusEndpoint, 'utf8');

    // Check for AI import
    if (content.includes("import { AI }") || content.includes("from '../../../lib/services/ai-service'")) {
        console.log("  AI service import: FOUND");
        console.log("  AI.isEnabled() call: " + (content.includes("AI.isEnabled()") ? "FOUND" : "MISSING"));
        console.log("  AI.healthCheck() call: " + (content.includes("AI.healthCheck()") ? "FOUND" : "MISSING"));
    } else {
        console.log("  ERROR: AI service import NOT found in status endpoint");
    }
}

// 5. Check for OpenAI usage
console.log("\n5. OPENAI API USAGE:");
console.log("-".repeat(80));
const aiServicePath = path.join(BASE_DIR, 'lib/services/ai-service.ts');
if (fs.existsSync(aiServicePath)) {
    const content = fs.readFileSync(aiServicePath, 'utf8');
    console.log(`  Uses 'openai' package: ${content.includes("import OpenAI") ? "YES" : "NO"}`);
    console.log(`  Has AIService class: ${content.includes("class AIService") ? "YES" : "NO"}`);
    console.log(`  Exports AI object: ${content.includes("export const AI") ? "YES" : "NO"}`);
    console.log(`  Checks for OPENAI_API_KEY: ${content.includes("OPENAI_API_KEY") ? "YES" : "NO"}`);
}

// 6. Check Anthropic client
console.log("\n6. ANTHROPIC CLIENT UTILITY:");
console.log("-".repeat(80));
const anthropicPath = path.join(BASE_DIR, 'lib/utils/anthropic-client.ts');
if (fs.existsSync(anthropicPath)) {
    const content = fs.readFileSync(anthropicPath, 'utf8');
    console.log(`  initializeAnthropic() function: ${content.includes("initializeAnthropic") ? "YES" : "NO"}`);
    console.log(`  initializeGemini() function: ${content.includes("initializeGemini") ? "YES" : "NO"}`);
    console.log(`  getAnthropicClient() function: ${content.includes("getAnthropicClient") ? "YES" : "NO"}`);
    console.log(`  callAnthropic() function: ${content.includes("callAnthropic") ? "YES" : "NO"}`);
    console.log(`  callGemini() function: ${content.includes("callGemini") ? "YES" : "NO"}`);
}

// 7. Check dependencies
console.log("\n7. PACKAGE DEPENDENCIES:");
console.log("-".repeat(80));
const packagePath = path.join(BASE_DIR, 'package.json');
if (fs.existsSync(packagePath)) {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const deps = pkg.dependencies || {};

    console.log(`  @anthropic-ai/sdk: ${deps['@anthropic-ai/sdk'] ? 'YES' : 'NO'}`);
    console.log(`  @google/generative-ai: ${deps['@google/generative-ai'] ? 'YES' : 'NO'}`);
    console.log(`  openai: ${deps['openai'] ? 'YES' : 'NO'}`);
}

console.log("\n" + "=".repeat(80) + "\n");
