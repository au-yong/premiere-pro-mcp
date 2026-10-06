/**
 * Tool response formatters for MCP
 */

export function formatSuccess(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return {
    content: [
      {
        type: 'text',
        text
      }
    ]
  };
}

export function formatError(err) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `Error: ${message}`
      }
    ]
  };
}
