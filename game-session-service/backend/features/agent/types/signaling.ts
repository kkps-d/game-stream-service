export type AgentRequest =
  | { operation: 'offer'; sdp: string; turnUrl: string }
  | { operation: 'info' | 'stats' | 'stop'; sessionId: string }
  | { operation: 'update'; sessionId: string; settings: object };

export interface AgentReply {
  status: number;
  body: string;
  sessionId: string | null;
}

export interface AgentConnection {
  request(command: AgentRequest): Promise<AgentReply | null>;
  close(): void;
}
