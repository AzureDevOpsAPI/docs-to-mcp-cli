# Installation Guide

This guide will help you install and set up the MCP documentation server.

## Prerequisites

Before you start, make sure you have the following installed:

- Node.js 18 or later
- npm or yarn

## Installation Steps

1. **Clone the repository:**

```bash
git clone https://github.com/example/mcp-docs-server.git
cd mcp-docs-server
```

2. **Install dependencies:**

```bash
npm install
```

3. **Generate the server:**

```bash
npx make-mcp-docs-server --docs "docs/**/*.md" --packageName MyDocsServer
```

4. **Run the server:**

```bash
cd dist
npm install
node index.js
```

## Configuration Options

You can customize your MCP documentation server by adjusting the following parameters:

| Option          | Description                     | Default    |
| --------------- | ------------------------------- | ---------- |
| `--docs`        | Glob pattern for markdown files | (required) |
| `--packageName` | Name for the generated server   | (required) |
| `--outDir`      | Output directory                | "dist"     |

## Troubleshooting

If you encounter any issues during installation:

1. Make sure you have the correct Node.js version
2. Check that your glob pattern is correct
3. Verify that your markdown files are valid
