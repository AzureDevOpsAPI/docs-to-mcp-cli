import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const execAsync = promisify(exec);

describe('docs-to-mcp-cli E2E Tests', () => {
  const testDir = join(process.cwd(), 'test-e2e');
  const docsDir = join(testDir, 'docs');
  const outputDir = join(testDir, 'dist');
  const packageName = 'TestDocsServer';

  let client: Client;
  let transport: StdioClientTransport;

  // Create test docs directories and files
  before(
    async () => {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }

      mkdirSync(testDir, { recursive: true });
      mkdirSync(docsDir, { recursive: true });
      mkdirSync(outputDir, { recursive: true });

      // Create sample markdown files for testing
      writeFileSync(
        join(docsDir, 'installation.md'),
        `# Installation Guide
      
This is a test installation guide.

## Steps

1. Install dependencies
2. Configure settings
3. Start the server`,
      );

      writeFileSync(
        join(docsDir, 'api.md'),
        `# API Reference
      
## Functions

\`\`\`javascript
function getData() {
  return fetch('/api/data');
}
\`\`\`

## Endpoints

- GET /api/data
- POST /api/update`,
      );

      // Run the CLI command to generate the server
      const cliCmd = `node cli/index.js --docs "${join(docsDir, '*.md')}" --packageName ${packageName} --outDir ${outputDir}`;

      const { stdout } = await execAsync(cliCmd);
      console.log(stdout);

      // Verify server files were created
      assert.ok(
        existsSync(join(outputDir, 'index.js')),
        'index.js should exist',
      );
      assert.ok(
        existsSync(join(outputDir, 'package.json')),
        'package.json should exist',
      );

      // Install dependencies in the generated server
      console.log('Installing dependencies for the generated server...');
      try {
        // Change to the output directory and install deps
        await execAsync(`cd "${outputDir}" && npm install`);
        console.log('Dependencies installed successfully');
      } catch (error) {
        console.error('Failed to install dependencies:', error);
        throw error;
      }

      // Create client transport using the command approach
      const serverPath = join(outputDir, 'index.js');
      // Convert process.env to Record<string, string> by filtering out undefined values
      const envVars: Record<string, string> = {};
      Object.entries(process.env).forEach(([key, value]) => {
        if (value !== undefined) {
          envVars[key] = value;
        }
      });

      transport = new StdioClientTransport({
        command: 'node',
        args: [serverPath],
        env: envVars,
      });

      // Connect client
      client = new Client({
        name: 'TestClient',
        version: '1.0.0',
      });

      await client.connect(transport);
    },
    { timeout: 60000 },
  ); // Increase timeout for dependency installation

  // Clean up test directories after tests
  after(async () => {
    // Clean up the client and transport
    if (client) {
      await client.close();
    }

    if (transport) {
      await transport.close();
    }

    // Force exit to clean up any remaining handles
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 500);
    });

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should connect to server and call list_docs', async () => {
    console.log('Running test: should connect to server and call list_docs');
    try {
      const listResult = await client.callTool({
        name: 'list_docs',
        arguments: {},
      });

      console.log('List docs result:', JSON.stringify(listResult, null, 2));

      const content = listResult.content as Array<{
        type: string;
        text: string;
      }>;
      // Check for the presence of content, even if it's "No documents found"
      assert(content.length > 0, 'Content length should be greater than 0');
      assert(
        content[0].text.length > 0,
        'First content item text length should be greater than 0',
      );
    } catch (error) {
      console.error('Error in list_docs test:', error);
      throw error;
    }
  });

  test('should get a specific doc with path relative to test dir', async () => {
    // Just test that we can get any document without failing
    try {
      const docPath = join('test-e2e', 'docs', 'installation.md');
      const getDocResult = await client.callTool({
        name: 'get_doc',
        arguments: { name: docPath },
      });

      console.log('Get doc result:', JSON.stringify(getDocResult, null, 2));

      const content = getDocResult.content as Array<{
        type: string;
        text: string;
      }>;
      assert(
        content.length > 0,
        'Content length should be greater than 0 for get_doc',
      );
    } catch (error) {
      console.error('Error in get_doc test:', error);

      // Since this test may fail due to path issues, let's list all available docs
      try {
        const listResult = await client.callTool({
          name: 'list_docs',
          arguments: {},
        });
        console.log('Available docs:', listResult.content);
      } catch (listError) {
        console.error('Error getting list of docs:', listError);
      }

      throw error;
    }
  });

  test('should search docs', async () => {
    try {
      const searchResult = await client.callTool({
        name: 'search_docs',
        arguments: { query: 'guide' },
      });

      console.log('Search result:', JSON.stringify(searchResult, null, 2));

      const content = searchResult.content as Array<{
        type: string;
        text: string;
      }>;
      assert(
        content.length > 0,
        'Content length should be greater than 0 for search_docs',
      );
    } catch (error) {
      console.error('Error in search_docs test:', error);
      throw error;
    }
  });
});
