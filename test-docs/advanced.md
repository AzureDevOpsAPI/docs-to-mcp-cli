# Advanced Features

This document describes some of the advanced features of our MCP documentation server.

## Context-aware Search

The search functionality uses fuzzy matching to find relevant content across all documentation files. Each search result includes:

1. The file path where the match was found
2. A preview of the content surrounding the match
3. Highlighted match text to make it easier to spot

## Embedding in Applications

You can embed this documentation server in your applications using the Model Context Protocol:

```javascript
// Example of connecting to an MCP server
import { Client } from '@modelcontextprotocol/sdk/client';

const client = new Client({ name: 'MyApp', version: '1.0.0' });
await client.connect(transport);

// Search documentation
const result = await client.callTool({
  name: 'search_docs',
  arguments: { query: 'advanced features' },
});

console.log(result.content[0].text);
```

## Future Improvements

We're planning to add the following features in upcoming releases:

- Tag-based filtering of documentation
- Semantic search capabilities
- Custom styling of search results
- Support for nested documentation structures
