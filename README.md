# docs-to-mcp-cli

A CLI tool that generates a self-contained, runnable MCP (Model Context Protocol) server that exposes markdown documentation via specific tools.

## What is MCP?

The [Model Context Protocol (MCP)](https://github.com/model-context-protocol/mcp) is an open standard that enables AI assistants to access external tools and data sources. By converting your documentation to an MCP server, you allow AI assistants to:

- Browse through your documentation
- Search for specific information
- Access the full content of any document
- Use your documentation to provide more accurate and contextual responses

## Installation

You can install the tool globally:

```bash
npm install -g @tiberriver256/docs-to-mcp-cli
```

Or use it directly with npx:

```bash
npx @tiberriver256/docs-to-mcp-cli --docs "path/to/docs/**/*.md" --packageName MyDocsServer
```

## Usage

```bash
docs-to-mcp-cli --docs <pattern> --packageName <n> [--outDir <dir>] [--toolName <name>]
```

### Options

- `-d, --docs <pattern>`: Glob pattern for markdown files (required)
- `-p, --packageName <n>`: Name for the generated MCP server (required)
- `-o, --outDir <dir>`: Output directory for the bundled server (default: "dist")
- `-t, --toolName <name>`: Name of the tool/package/library being documented (used in tool descriptions)
- `-v, --version`: Output the current version

### Examples

```bash
# Generate a server from all markdown files in the docs directory
docs-to-mcp-cli --docs "docs/**/*.md" --packageName ProjectDocs

# Specify a custom tool name and output directory
docs-to-mcp-cli --docs "documentation/**/*.md" --packageName APIDocsServer --toolName "My API" --outDir build

# Run the generated server
node dist/index.js
```

## Generated Server Tools

The generated MCP server provides the following tools to AI assistants:

- `list_docs`: Lists all available documents with a preview of their content
- `get_doc`: Gets the full content of a specific document by its path
- `search_docs`: Searches across all documents using fuzzy matching

## Integration with AI Assistants

Once your MCP server is running, AI assistants that support the Model Context Protocol can connect to it and access your documentation. This enables the AI to provide more accurate and contextual responses based on your specific documentation.

## Development

To build the CLI tool locally:

```bash
# Clone the repository
git clone https://github.com/Tiberriver256/docs-to-mcp-cli.git
cd docs-to-mcp-cli

# Install dependencies
npm install

# Build the project
npm run build

# Link for local development
npm link
```

## Current Version

The current version is 1.1.2. See the [CHANGELOG.md](CHANGELOG.md) for details on recent updates.
