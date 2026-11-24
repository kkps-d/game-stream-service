import { createServer } from 'node:http';

export function createAgentServer() {
  return createServer((request, response) => {
    const health = request.method === 'GET' && request.url?.split('?', 1)[0] === '/api/health';
    response
      .writeHead(health ? 200 : 404, {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json',
      })
      .end(JSON.stringify(health ? { status: 'ok' } : { error: 'Route not found.' }));
  });
}
