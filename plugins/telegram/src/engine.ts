import { mkdir } from "node:fs/promises";
import path from "node:path";
import TelegramBot from "node-telegram-bot-api";
import type { Logger } from "@openintern/kernel";
import type { TelegramConfig, TelegramInboundMessage, TelegramStatus } from "./types.js";

const MESSAGE_CACHE_LIMIT = 200;

interface TelegramUserLike {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramChatLike {
  id?: number;
  type?: string;
  title?: string;
  username?: string;
}

interface TelegramFileLike {
  file_id?: string;
}

interface TelegramPhotoLike extends TelegramFileLike {
  width?: number;
  height?: number;
}

interface TelegramStickerLike extends TelegramFileLike {
  emoji?: string;
}

interface TelegramMessageLike {
  message_id?: number;
  date?: number;
  from?: TelegramUserLike;
  chat?: TelegramChatLike;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoLike[];
  document?: TelegramFileLike;
  audio?: TelegramFileLike;
  video?: TelegramFileLike;
  voice?: TelegramFileLike;
  sticker?: TelegramStickerLike;
}

export interface TelegramEngineOptions {
  logger?: Logger;
  onMessage?: (message: TelegramInboundMessage) => void | Promise<void>;
}

export class TelegramEngine {
  private bot: TelegramBot | null = null;
  private readonly inboundQueue: TelegramInboundMessage[] = [];
  private lastError: string | null = null;
  private botUsername: string | null = null;
  private readonly boundMessageHandler = (message: TelegramMessageLike) => {
    void this.handleMessage(message, "message");
  };
  private readonly boundEditedMessageHandler = (message: TelegramMessageLike) => {
    void this.handleMessage(message, "edited_message");
  };
  private readonly boundChannelPostHandler = (message: TelegramMessageLike) => {
    void this.handleMessage(message, "channel_post");
  };
  private readonly boundPollingErrorHandler = (error: Error) => {
    this.lastError = error.message;
    this.log("warn", "telegram polling error", { error: error.message });
  };

  constructor(
    private readonly config: TelegramConfig,
    private readonly options: TelegramEngineOptions = {},
  ) {}

  public status(): TelegramStatus {
    return {
      enabled: this.config.enabled,
      started: this.bot?.isPolling() ?? false,
      queueSize: this.inboundQueue.length,
      mediaDir: this.config.mediaDir,
      apiBaseUrl: this.config.apiBaseUrl,
      allowFrom: [...this.config.allowFrom],
      botUsername: this.botUsername,
      lastError: this.lastError,
    };
  }

  public async start(): Promise<void> {
    if (!this.config.enabled || this.bot) {
      return;
    }

    this.assertRequiredConfig();
    await mkdir(this.config.mediaDir, { recursive: true });

    const bot = new TelegramBot(this.config.botToken, {
      polling: {
        autoStart: false,
        interval: 300,
        params: {
          timeout: this.config.pollTimeoutSeconds,
          allowed_updates: ["message", "edited_message", "channel_post"],
        },
      },
      baseApiUrl: this.config.apiBaseUrl,
      filepath: false,
    });

    try {
      const me = await bot.getMe();
      this.botUsername = typeof me.username === "string" ? me.username : null;
      this.lastError = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = `Telegram authentication failed: ${message}`;
      throw new Error(this.lastError);
    }

    bot.on("message", this.boundMessageHandler);
    bot.on("edited_message", this.boundEditedMessageHandler);
    bot.on("channel_post", this.boundChannelPostHandler);
    bot.on("polling_error", this.boundPollingErrorHandler);

    await bot.startPolling({ restart: true });
    this.bot = bot;
  }

  public async stop(): Promise<void> {
    const bot = this.bot;

    if (!bot) {
      return;
    }

    bot.removeListener("message", this.boundMessageHandler);
    bot.removeListener("edited_message", this.boundEditedMessageHandler);
    bot.removeListener("channel_post", this.boundChannelPostHandler);
    bot.removeListener("polling_error", this.boundPollingErrorHandler);

    try {
      await bot.stopPolling();
    } catch {
      // ignore stop errors during shutdown
    }

    this.bot = null;
  }

  public async sendMessage(to: string, text: string): Promise<{ to: string; sent: true }> {
    const bot = this.requireBot();
    const chatId = to.trim();
    const content = text.trim();

    if (!chatId || !content) {
      throw new TypeError("to and text must be non-empty strings.");
    }

    await bot.sendMessage(chatId, content);
    return { to: chatId, sent: true };
  }

  public pullMessages(limit = 50): TelegramInboundMessage[] {
    const count = Math.max(0, Math.min(limit, this.inboundQueue.length));
    return this.inboundQueue.splice(0, count);
  }

  private async handleMessage(message: TelegramMessageLike, event: string): Promise<void> {
    const chatId = typeof message.chat?.id === "number" ? String(message.chat.id) : "";
    const senderId = typeof message.from?.id === "number" ? String(message.from.id) : chatId;

    if (!chatId || !senderId || !this.isAllowed(chatId, senderId)) {
      return;
    }

    const { content, media, metadata } = await this.extractPayload(message, event);

    if (!content && media.length === 0) {
      return;
    }

    const inbound: TelegramInboundMessage = {
      id: typeof message.message_id === "number"
        ? `${chatId}:${message.message_id}`
        : `${chatId}:${Date.now()}`,
      senderId,
      chatId,
      content,
      timestamp: this.toIsoTime(message.date),
      media,
      metadata,
    };

    this.inboundQueue.push(inbound);
    if (this.inboundQueue.length > MESSAGE_CACHE_LIMIT) {
      this.inboundQueue.splice(0, this.inboundQueue.length - MESSAGE_CACHE_LIMIT);
    }

    await this.options.onMessage?.(inbound);
  }

  private async extractPayload(
    message: TelegramMessageLike,
    event: string,
  ): Promise<{ content: string; media: string[]; metadata: Record<string, unknown> }> {
    const media: string[] = [];
    let kind = "text";

    if (Array.isArray(message.photo) && message.photo.length > 0) {
      const photo = message.photo[message.photo.length - 1];
      const filePath = await this.downloadFile(photo.file_id);
      if (filePath) {
        media.push(filePath);
      }
      kind = "photo";
    }

    for (const [type, fileRef] of [
      ["document", message.document],
      ["audio", message.audio],
      ["video", message.video],
      ["voice", message.voice],
      ["sticker", message.sticker],
    ] as const) {
      if (!fileRef?.file_id) {
        continue;
      }

      const filePath = await this.downloadFile(fileRef.file_id);
      if (filePath) {
        media.push(filePath);
      }
      kind = type;
    }

    const content = (message.text ?? message.caption ?? "").trim()
      || this.fallbackContent(kind, media.length, message.sticker?.emoji);

    return {
      content,
      media,
      metadata: {
        event,
        kind,
        chatType: message.chat?.type,
        chatTitle: message.chat?.title,
        chatUsername: message.chat?.username,
        senderUsername: message.from?.username,
        senderName: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" "),
      },
    };
  }

  private async downloadFile(fileId: string | undefined): Promise<string> {
    const bot = this.requireBot();

    if (!fileId) {
      return "";
    }

    try {
      const downloadedPath = await bot.downloadFile(fileId, this.config.mediaDir);
      return path.relative(process.cwd(), downloadedPath).replace(/\\/g, "/");
    } catch (error) {
      this.log("warn", "telegram media download failed", {
        fileId,
        error: error instanceof Error ? error.message : String(error),
      });
      return "";
    }
  }

  private fallbackContent(kind: string, mediaCount: number, emoji?: string): string {
    if (kind === "sticker") {
      return emoji?.trim() ? `[sticker] ${emoji.trim()}` : "[sticker]";
    }

    if (mediaCount > 0) {
      return `[${kind}]`;
    }

    return "";
  }

  private requireBot(): TelegramBot {
    if (!this.config.enabled) {
      throw new Error("Telegram is disabled.");
    }

    if (!this.bot) {
      throw new Error("Telegram bot is not started.");
    }

    return this.bot;
  }

  private isAllowed(chatId: string, senderId: string): boolean {
    return this.config.allowFrom.includes("*")
      || this.config.allowFrom.includes(chatId)
      || this.config.allowFrom.includes(senderId);
  }

  private toIsoTime(raw: number | undefined): string {
    if (typeof raw !== "number" || Number.isNaN(raw)) {
      return new Date().toISOString();
    }

    return new Date(raw * 1000).toISOString();
  }

  private assertRequiredConfig(): void {
    if (!this.config.botToken.trim()) {
      throw new Error("TELEGRAM_BOT_TOKEN is required.");
    }
  }

  private log(level: "debug" | "info" | "warn" | "error", message: string, detail?: unknown): void {
    if (!this.options.logger) {
      return;
    }

    if (detail === undefined) {
      this.options.logger[level](message);
      return;
    }

    this.options.logger[level](message, detail);
  }
}
