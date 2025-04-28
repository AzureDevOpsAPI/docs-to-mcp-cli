import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import { build } from 'esbuild';
import { z } from 'zod';

/**
 * Generate an MCP server that serves the content of markdown files
 * @param docsPattern Glob pattern to find markdown files
 * @param packageName Name of the MCP server
 * @param outDir Output directory for the bundled server
 * @param toolName Optional name of the tool/package/library being documented (used in tool descriptions)
 */
export async function generateServer(
  docsPattern: string,
  packageName: string,
  outDir: string,
  toolName?: string,
) {
  const normalizedPattern = docsPattern.replace(/\\/g, '/');
  const filePaths = await glob(normalizedPattern, { nodir: true });

  if (filePaths.length === 0) {
    console.warn(`⚠️ No files found matching pattern: ${docsPattern}`);
    // Continue to generate an empty server
  } else {
    console.log(`Found ${filePaths.length} files.`);
  }

  const docs: Record<string, string> = {};
  for (const filePath of filePaths) {
    try {
      // Use relative path as the key for clarity within the server
      const relativePath = path.relative(process.cwd(), filePath);
      docs[relativePath] = fs.readFileSync(filePath, 'utf-8');
    } catch (readError) {
      console.warn(
        `⚠️ Skipping file ${filePath} due to read error: ${readError}`,
      );
    }
  }

  // Escape backticks and backslashes in content for template literal safety
  const escapeTemplateLiteral = (str: string) =>
    str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');

  const docsEntries = Object.entries(docs)
    .map(
      ([name, content]) =>
        `  '${escapeTemplateLiteral(name)}': \`${escapeTemplateLiteral(content)}\``,
    )
    .join(',\n');

  const serverCode = `#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Fuse from 'fuse.js';
import { z } from "zod";

// Embedded markdown files - populated by make-mcp-docs-server
const docs: Record<string, string> = {
${docsEntries}
};

// --- Server Configuration ---
const SERVER_NAME = '${packageName}';
const SERVER_VERSION = '1.0.0';
const TOOL_NAME = '${toolName || ''}'; // Injected by the CLI
const FUSE_OPTIONS = {
  keys: [
    { name: 'content', weight: 1.0 }, // Primary search target: file content
    { name: 'name', weight: 0.5 }     // Secondary target: file path/name, lower weight
  ],
  threshold: 0.4,          // Loosen threshold for better fuzzy matching
  includeScore: true,      // Include score in results
  includeMatches: true,    // Include match information for highlighting
  minMatchCharLength: 3,   // Slightly lower minimum length for better matches
  findAllMatches: true,    // Find all matches for comprehensive results
  ignoreLocation: true,    // Search anywhere, don't penalize location
  useExtendedSearch: true, // Enable extended search for better pattern matching
  ignoreFieldNorm: true,   // Don't penalize for field length
  shouldSort: true,        // Explicitly sort by score
  isCaseSensitive: false,  // Case insensitive search
  ignoreDiacritics: true,  // Ignore diacritics for international text
};
const LIST_DOCS_PREVIEW_CHARS = 90;
const SEARCH_CONTEXT_CHARS = 200; // Characters to show before and after match

// --- Initialize Fuse ---
const fuse = new Fuse(
  Object.entries(docs).map(([name, content]) => ({ name, content })),
  FUSE_OPTIONS
);

// --- Initialize MCP Server ---
const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION
});

// --- Define Tools ---

server.tool(
  'list_docs',
  TOOL_NAME ? \`Lists available documents for \${TOOL_NAME} with previews.\` : 'Lists available documents with previews.',
  {},
  async () => {
    const list = Object.entries(docs).map(([name, content]) => {
      const lines = content.slice(0, LIST_DOCS_PREVIEW_CHARS);
      return \`--- \${name} ---\\n\${lines}...\`;
    }).join('\\n\\n');

    if (!list) {
      return { content: [{type: "text", text: 'No documents found.'}] };
    }
    return { content: [{type: "text", text: list}] };
  }
);

server.tool(
  'get_doc',
  TOOL_NAME ? \`Retrieves the full content of a specific document for \${TOOL_NAME} by its relative path.\` : 'Retrieves the full content of a specific document by its relative path.',
  {
    name: z.string().describe(TOOL_NAME ? \`The relative path of the document for \${TOOL_NAME} (e.g., "test-docs/installation.md").\` : 'The relative path of the document (e.g., "test-docs/installation.md").')
  },
  async ({ name }) => {
    const content = docs[name];
    if (content === undefined) { // Check for undefined explicitly
      throw new Error(\`Document '\${name}' not found. Use list_docs to see available documents.\`);
    }
    return { content: [{type: "text", text: content}] };
  }
);

server.tool(
  'search_docs',
  TOOL_NAME ? \`Searches all \${TOOL_NAME} documents for a given query string using fuzzy matching.\` : 'Searches all documents for a given query string using fuzzy matching.',
  {
    query: z.string().describe('The search term or query.')
  },
  async ({ query }) => {
    const results = fuse.search(query);
    if (results.length === 0) {
      return { content: [{type: "text", text: \`No matches found for query: "\${query}"\`}] };
    }
    
    // Generate highlighted preview for each match
    const formattedResults = results.map(result => {
      const { item, matches } = result;
      
      // Build previews with highlights for each match location
      const previews = matches?.flatMap(match => {
        if (match.key !== 'content' || !match.indices || match.indices.length === 0) {
          return [];
        }
        
        const content = item.content;
        
        // Process each occurrence (set of indices) for this match
        return match.indices.map(([matchStart, matchEnd]) => {
          // Calculate preview boundaries
          const previewStart = Math.max(0, matchStart - SEARCH_CONTEXT_CHARS);
          const previewEnd = Math.min(content.length, matchEnd + SEARCH_CONTEXT_CHARS + 1);
          
          // Extract text before, during, and after match
          const beforeMatch = content.substring(previewStart, matchStart);
          const matchText = content.substring(matchStart, matchEnd + 1);
          const afterMatch = content.substring(matchEnd + 1, previewEnd);
          
          // If we truncated the beginning, add ellipsis
          const previewPrefix = previewStart > 0 ? '...' : '';
          // If we truncated the end, add ellipsis
          const previewSuffix = previewEnd < content.length ? '...' : '';
          
          // Combine with highlighting
          return \`\${previewPrefix}\${beforeMatch}**\${matchText}**\${afterMatch}\${previewSuffix}\`;
        });
      }).filter(Boolean);
      
      return {
        file: item.name,
        previews: previews || []
      };
    });
    
    // Format the response
    // Count total number of matches across all files
    const totalMatches = formattedResults.reduce((count, { previews }) => count + previews.length, 0);
    let response = \`Found \${totalMatches} matches for "\${query}":\\n\\n\`;
    
    formattedResults.forEach(({ file, previews }) => {
      response += \`File: \${file}\\n\`;
      
      if (previews.length > 0) {
        previews.forEach((preview, i) => {
          response += \`Match \${i+1}:\\n\${preview}\\n\\n\`;
        });
      } else {
        response += \`(Match found but no preview available)\\n\\n\`;
      }
    });
    
    return { content: [{type: "text", text: response}] };
  }
);

// --- Start the Server ---
async function main() {
  console.log(\`[\${SERVER_NAME}] MCP Server starting...\`);
  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
    console.log(\`[\${SERVER_NAME}] MCP Server connected via stdio.\`);
    // Keep alive indefinitely until transport closes or process exits
    await new Promise(() => {}); // Keep node process running
  } catch (error) {
    console.error(\`[\${SERVER_NAME}] Failed to start or connect server: \${error}\`);
    process.exit(1); // Exit if connection fails
  }
}

main();
`;

  const tempFilePath = path.join(outDir, `_temp_server_${Date.now()}.ts`);
  const outputFilePath = path.join(outDir, 'index.js');

  // Ensure output directory exists
  fs.mkdirSync(outDir, { recursive: true });

  // Write temporary TS file
  fs.writeFileSync(tempFilePath, serverCode, 'utf-8');

  try {
    // Bundle using esbuild
    await build({
      entryPoints: [tempFilePath],
      bundle: true,
      outfile: outputFilePath,
      platform: 'node',
      format: 'cjs', // CommonJS for broad Node compatibility
      external: ['@modelcontextprotocol/sdk', 'zod', 'fuse.js'], // External dependencies
      minify: false, // Keep readable for debugging
      sourcemap: false,
      logLevel: 'info',
      target: 'node18',
    });

    console.log(`Bundled server written to ${outputFilePath}`);

    // Create package.json for the output directory
    const packageJsonPath = path.join(outDir, 'package.json');
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(
        {
          name: packageName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          version: '1.0.0',
          description: `MCP server for ${packageName} documentation`,
          main: 'index.js',
          bin: {
            [packageName.toLowerCase().replace(/[^a-z0-9-]/g, '-')]: 'index.js',
          },
          dependencies: {
            '@modelcontextprotocol/sdk': '^1.9.0',
            'fuse.js': '^7.1.0',
            zod: '^3.22.4',
          },
        },
        null,
        2,
      ),
    );

    console.log(`Generated package.json in ${outDir}`);
  } catch (bundleError) {
    console.error('❌ esbuild bundling failed:', bundleError);
    throw bundleError;
  } finally {
    // Clean up temporary file
    try {
      fs.unlinkSync(tempFilePath);
    } catch (cleanupError) {
      console.warn(
        `⚠️ Could not delete temporary file ${tempFilePath}: ${cleanupError}`,
      );
    }
  }
}
