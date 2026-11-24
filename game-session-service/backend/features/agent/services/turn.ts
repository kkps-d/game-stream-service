import { createHmac, randomUUID } from 'node:crypto';
import { isIPv4 } from 'node:net';

const lifetimeSeconds = 600;

export interface TurnConfig {
  authority: string;
  secret: string;
}

export function readTurnConfig(url?: string, secret?: string): TurnConfig | undefined {
  if (!url && !secret) return undefined;
  const match = url?.match(/^turn:([\d.]+):([1-9]\d{0,4})(?:\?transport=udp)?$/);
  if (
    !match ||
    !isIPv4(match[1]) ||
    Number(match[2]) > 65535 ||
    !secret ||
    !/^[a-f0-9]{64}$/.test(secret)
  ) {
    throw new Error(
      'Set TURN_URL to the coturn IPv4 address and port and TURN_SHARED_SECRET to its 64-character hex secret.',
    );
  }
  return { authority: `${match[1]}:${match[2]}`, secret };
}

export function turnCredentials(config: TurnConfig) {
  const expiration = Math.floor(Date.now() / 1000) + lifetimeSeconds;
  const username = `${expiration}:${randomUUID()}`;
  const credential = createHmac('sha1', config.secret).update(username).digest('base64');
  return { urls: `turn:${config.authority}?transport=udp`, username, credential };
}

export function agentTurnUrl(config: TurnConfig) {
  const { username, credential } = turnCredentials(config);
  return `turn://${encodeURIComponent(username)}:${encodeURIComponent(credential)}@${config.authority}`;
}
