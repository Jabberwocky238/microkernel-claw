export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  apiBaseUrl: string;
  pollTimeoutSeconds: number;
  requestTimeoutMs: number;
  mediaDir: string;
  allowFrom: string[];
}

export interface TelegramInboundMessage {
  id: string;
  senderId: string;
  chatId: string;
  content: string;
  timestamp: string;
  media: string[];
  metadata: Record<string, unknown>;
}

export interface TelegramStatus {
  enabled: boolean;
  started: boolean;
  queueSize: number;
  mediaDir: string;
  apiBaseUrl: string;
  allowFrom: string[];
  botUsername: string | null;
  lastError: string | null;
}
