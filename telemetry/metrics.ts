import { createServer } from 'node:http';

export type Labels = Record<string, string>;

export class Metrics {
  private lines: string[] = [];

  add(name: string, value: number | undefined, labels: Labels = {}) {
    if (value === undefined || !Number.isFinite(value)) return;
    const entries = Object.entries(labels).map(([key, text]) => `${key}=${JSON.stringify(text)}`);
    this.lines.push(`${name}${entries.length ? `{${entries.join(',')}}` : ''} ${value}\n`);
  }

  type(name: string, type: 'counter' | 'histogram') {
    this.lines.push(`# TYPE ${name} ${type}\n`);
  }

  render() {
    return this.lines.join('');
  }
}

export function listenMetrics(
  port: number,
  routes: Record<string, () => Metrics | Promise<Metrics>>,
  signal?: AbortSignal,
) {
  const server = createServer(async (request, response) => {
    const path = request.url ?? '';
    if (request.method !== 'GET' || !Object.hasOwn(routes, path)) {
      response.writeHead(404).end();
      return;
    }

    try {
      const metrics = await routes[path]!();
      response.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
      response.end(metrics.render());
    } catch {
      response.writeHead(503).end();
    }
  });
  server.on('error', (error) =>
    console.error(`Telemetry listener on port ${port}: ${error.message}`),
  );
  server.listen({ host: '127.0.0.1', port, signal });
  return server;
}
