import path from "node:path";
import { CapabilityProvider, Plugin } from "@openintern/kernel";
import type { AgentChannelMessage } from "../../agent/src/types.js";
import {
  TelegramPullMessagesCapabilityProvider,
  TelegramSendMessageCapabilityProvider,
  TelegramStartCapabilityProvider,
  TelegramStatusCapabilityProvider,
  TelegramStopCapabilityProvider,
} from "./capabilities.js";
import { TelegramEngine } from "./engine.js";
import type { TelegramConfig, TelegramInboundMessage } from "./types.js";

function parseAllowFrom(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) {
    return ["*"];
  }

  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

export default class TelegramPlugin extends Plugin {
  constructor() {
    super({
      name: "telegram",
      version: "0.0.0",
      namespaces: ["telegram", "channel"],
    });
  }

  public override async init(): Promise<void> {
    this.state.engine = new TelegramEngine(this.configFromEnv(), {
      logger: this.logger(),
      onMessage: async (message: TelegramInboundMessage) => {
        const payload: AgentChannelMessage = {
          channel: "telegram",
          senderId: message.senderId,
          chatId: message.chatId,
          content: message.content,
          timestamp: message.timestamp,
          media: message.media,
          metadata: message.metadata,
        };

        this.eventBus?.emit(this, "message.received", payload);
      },
    });
  }

  public override capabilities(): CapabilityProvider[] {
    return [
      new TelegramStartCapabilityProvider(this),
      new TelegramStopCapabilityProvider(this),
      new TelegramStatusCapabilityProvider(this),
      new TelegramSendMessageCapabilityProvider(this),
      new TelegramPullMessagesCapabilityProvider(this),
    ];
  }

  public engine(): TelegramEngine {
    const engine = this.state.engine;
    if (!(engine instanceof TelegramEngine)) {
      throw new Error("Telegram engine is not initialized.");
    }
    return engine;
  }

  public async start(): Promise<void> {
    if (this.status().started) {
      this.logger().info("skip start because telegram is already started");
      return;
    }

    await this.engine().start();
  }

  public async stop(): Promise<void> {
    await this.engine().stop();
  }

  public status() {
    return this.engine().status();
  }

  public async sendMessage(to: string, text: string) {
    return this.engine().sendMessage(to, text);
  }

  public pullMessages(limit?: number) {
    return this.engine().pullMessages(limit);
  }

  private configFromEnv(): TelegramConfig {
    return {
      enabled: process.env.TELEGRAM_ENABLED === "true",
      botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
      apiBaseUrl: process.env.TELEGRAM_API_BASE_URL ?? "https://api.telegram.org",
      pollTimeoutSeconds: this.parsePositiveInt(process.env.TELEGRAM_POLL_TIMEOUT_SECONDS, 20),
      requestTimeoutMs: this.parsePositiveInt(process.env.TELEGRAM_REQUEST_TIMEOUT_MS, 35_000),
      mediaDir: process.env.TELEGRAM_MEDIA_DIR ?? path.join(process.cwd(), ".openintern3", "telegram", "media"),
      allowFrom: parseAllowFrom(process.env.TELEGRAM_ALLOW_FROM),
    };
  }

  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      return fallback;
    }
    return Math.trunc(value);
  }
}
