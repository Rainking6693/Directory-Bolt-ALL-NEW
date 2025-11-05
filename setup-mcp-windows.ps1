# PowerShell Script to Set Up Catalog Search MCP Server on Windows
# Run this script from your local Windows machine (not on the VPS)

Write-Host "Setting up Catalog Search MCP Server for Claude Code on Windows..." -ForegroundColor Green

# Get the current Windows username
$username = $env:USERNAME
Write-Host "Detected username: $username" -ForegroundColor Cyan

# Define paths
$mcpServerPath = "C:\Users\$username\mcp-servers\catalog-search"
$configPath = "C:\Users\$username\.claude.json"
$toolsPath = "$mcpServerPath\tools"

# Create directories
Write-Host "`nCreating directory structure..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $mcpServerPath | Out-Null
New-Item -ItemType Directory -Force -Path $toolsPath | Out-Null
Write-Host "✓ Directories created at: $mcpServerPath" -ForegroundColor Green

# Create package.json
Write-Host "`nCreating package.json..." -ForegroundColor Yellow
$packageJson = @"
{
  "name": "catalog-search-mcp",
  "version": "1.0.0",
  "description": "MCP server for progressive tool discovery and catalog search",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.4"
  }
}
"@
Set-Content -Path "$mcpServerPath\package.json" -Value $packageJson
Write-Host "✓ package.json created" -ForegroundColor Green

# Create index.js
Write-Host "`nCreating index.js..." -ForegroundColor Yellow
$indexJs = @"
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Tool catalog - stores information about all available tools
const toolCatalog = [
  {
    name: 'search_catalog',
    category: 'meta',
    summary: 'Search and browse the tool catalog',
    description: 'Search and browse the tool catalog to discover what tools are available and call them directly. Use this tool when you need to find tools for a specific task or capability.',
    needsPermission: false,
    schema: {
      query: 'string (optional) - Keyword to search in tool names and descriptions',
      detailed: 'boolean (optional) - Include full descriptions and schemas',
      limit: 'number (optional) - Maximum number of results (1-50, default 20)'
    }
  },
  // Add more tools to the catalog here as you discover/install other MCP servers
];

// Create the MCP server
const server = new Server(
  {
    name: 'catalog-search-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define the search_catalog tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_catalog',
        description: 'Search and browse the tool catalog to discover what tools are available and call them directly.\n\nUse this tool when you need to:\n- Find tools for a specific task or capability\n- Explore what tools are available in a category\n- Check if a specific tool exists and get its schema\n\nThe catalog shows all tools in the system, with information about:\n- What each tool does (summary and description)\n- Whether it needs user permission to execute\n- The tool\'s parameter schema (in detailed mode)\n\n**Important: All available tools can be called DIRECTLY in the same conversation turn after discovering them.**\n\nExamples:\n- Search for weather tools: { category: \"weather\" }\n- Find tools for working with temperatures: { query: \"temperatures\" }\n- Get detailed info with schemas: { detailed: true }\n\nWorkflow:\n1. Search catalog with { query: \"...\", detailed: true } to find tools and their schemas\n2. Call any available tool directly using the callTool tool with the tool name and parameters',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Keyword to search in tool names, summaries, and descriptions',
            },
            detailed: {
              type: 'boolean',
              description: 'Include full descriptions and schemas (default shows only summaries)',
              default: false,
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (1-50, default 20)',
              minimum: 1,
              maximum: 50,
              default: 20,
            },
          },
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'search_catalog') {
    const { query = '', detailed = false, limit = 20 } = args || {};

    // Filter tools based on query
    let results = toolCatalog;

    if (query) {
      const searchTerm = query.toLowerCase();
      results = toolCatalog.filter(tool =>
        tool.name.toLowerCase().includes(searchTerm) ||
        tool.summary.toLowerCase().includes(searchTerm) ||
        tool.description.toLowerCase().includes(searchTerm) ||
        (tool.category && tool.category.toLowerCase().includes(searchTerm))
      );
    }

    // Apply limit
    results = results.slice(0, Math.min(limit, 50));

    // Format results
    const formattedResults = results.map(tool => {
      const result = {
        name: tool.name,
        category: tool.category,
        summary: tool.summary,
        needsPermission: tool.needsPermission,
      };

      if (detailed) {
        result.description = tool.description;
        result.schema = tool.schema;
      }

      return result;
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            total: results.length,
            tools: formattedResults,
          }, null, 2),
        },
      ],
    };
  }

  throw new Error(``Unknown tool: `${name}``);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Catalog Search MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
"@
Set-Content -Path "$mcpServerPath\index.js" -Value $indexJs
Write-Host "✓ index.js created" -ForegroundColor Green

# Create tools/search-catalog.js
Write-Host "`nCreating tools/search-catalog.js..." -ForegroundColor Yellow
$searchCatalogJs = @"
import { z } from 'zod';

export const description = ``Search and browse the tool catalog to discover what tools are available and call them directly.

Use this tool when you need to:
- Find tools for a specific task or capability
- Explore what tools are available in a category
- Check if a specific tool exists and get its schema

The catalog shows all tools in the system, with information about:
- What each tool does (summary and description)
- Whether it needs user permission to execute
- The tool's parameter schema (in detailed mode)

**Important: All available tools can be called DIRECTLY in the same conversation turn after discovering them.**

Examples:
- Search for weather tools: { category: "weather" }
- Find tools for working with temperatures: { query: "temperatures" }
- Get detailed info with schemas: { detailed: true }

Workflow:
1. Search catalog with { query: "...", detailed: true } to find tools and their schemas
2. Call any available tool directly using the callTool tool with the tool name and parameters``;

export const parameters = z.strictObject({
  query: z.string().optional().describe('Keyword to search in tool names, summaries, and descriptions'),
  detailed: z.boolean().optional().default(false).describe('Include full descriptions and schemas (default shows only summaries)'),
  limit: z.number().min(1).max(50).optional().default(20).describe('Maximum number of results to return (1-50, default 20)')
});

// Tool metadata for the catalog
export const metadata = {
  name: 'search_catalog',
  category: 'meta',
  summary: 'Search and browse the tool catalog',
  needsPermission: false
};
"@
Set-Content -Path "$toolsPath\search-catalog.js" -Value $searchCatalogJs
Write-Host "✓ tools/search-catalog.js created" -ForegroundColor Green

# Install dependencies
Write-Host "`nInstalling npm dependencies (this may take a minute)..." -ForegroundColor Yellow
Push-Location $mcpServerPath
npm install 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Warning: npm install had some issues. You may need to run 'npm install' manually." -ForegroundColor Red
}
Pop-Location

# Create .claude.json config file
Write-Host "`nCreating Claude Code configuration file..." -ForegroundColor Yellow

# Use forward slashes for the path in JSON (Node.js handles this on Windows)
$indexJsPath = "$mcpServerPath\index.js".Replace('\', '\\')

$claudeConfig = @"
{
  "mcpServers": {
    "catalog-search": {
      "command": "node",
      "args": [
        "$indexJsPath"
      ]
    }
  }
}
"@

Set-Content -Path $configPath -Value $claudeConfig
Write-Host "✓ Configuration file created at: $configPath" -ForegroundColor Green

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Restart Claude Code on your Windows machine" -ForegroundColor White
Write-Host "2. Test by asking Claude: 'Search the catalog for meta tools'" -ForegroundColor White
Write-Host "3. To add more tools, edit: $mcpServerPath\index.js" -ForegroundColor White
Write-Host "`nFiles created:" -ForegroundColor Yellow
Write-Host "  - $mcpServerPath\index.js" -ForegroundColor White
Write-Host "  - $mcpServerPath\package.json" -ForegroundColor White
Write-Host "  - $toolsPath\search-catalog.js" -ForegroundColor White
Write-Host "  - $configPath" -ForegroundColor White
Write-Host "`nPress any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
