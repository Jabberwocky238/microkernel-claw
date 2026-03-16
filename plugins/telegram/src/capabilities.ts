import {
  CapabilityProvider,
  type CapabilityContext,
  type CapabilityDescriptor,
  type CapabilityResult,
} from "@openintern/kernel/capability";
import {
  channelPullMessagesInputSchema,
  channelPullMessagesOutputSchema,
  channelSendMessageInputSchema,
  channelSendMessageOutputSchema,
  channelStartOutputSchema,
  channelStatusOutputSchema,
  channelStopOutputSchema,
  emptyObjectSchema,
} from "@openintern3/plugin-agent/capability-schemas";
import type { TelegramEngine } from "./engine.js";

interface TelegramPluginLike {
  readonly name: string;
  readonly version: string;
  readonly isInitialized: boolean;
  engine(): TelegramEngine;
}

abstract class TelegramCapabilityProvider extends CapabilityProvider {
  constructor(descriptor: CapabilityDescriptor, protected readonly plugin: TelegramPluginLike) {
    super(descriptor);
  }

  public override isAvailable(): boolean {
    return this.plugin.isInitialized;
  }
}

export class TelegramStartCapabilityProvider extends TelegramCapabilityProvider {
  constructor(plugin: TelegramPluginLike) {
    super({
      description: "Start the Telegram bot polling loop.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["telegram"],
      signature: "start",
      inputSchema: emptyObjectSchema,
      outputSchema: channelStartOutputSchema,
    }, plugin);
  }

  protected override async invokeImpl(
    _input: unknown,
    _context?: CapabilityContext,
  ): Promise<CapabilityResult> {
    try {
      await this.plugin.engine().start();
      return { ok: true, value: { started: true } };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class TelegramStopCapabilityProvider extends TelegramCapabilityProvider {
  constructor(plugin: TelegramPluginLike) {
    super({
      description: "Stop the Telegram bot polling loop.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["telegram"],
      signature: "stop",
      inputSchema: emptyObjectSchema,
      outputSchema: channelStopOutputSchema,
    }, plugin);
  }

  protected override async invokeImpl(): Promise<CapabilityResult> {
    try {
      await this.plugin.engine().stop();
      return { ok: true, value: { stopped: true } };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class TelegramStatusCapabilityProvider extends TelegramCapabilityProvider {
  constructor(plugin: TelegramPluginLike) {
    super({
      description: "Get current telegram plugin status.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["telegram"],
      signature: "status",
      inputSchema: emptyObjectSchema,
      outputSchema: channelStatusOutputSchema,
    }, plugin);
  }

  protected override async invokeImpl(): Promise<CapabilityResult> {
    return { ok: true, value: { channel: this.plugin.name, ...this.plugin.engine().status() } };
  }
}

export class TelegramSendMessageCapabilityProvider extends TelegramCapabilityProvider {
  constructor(plugin: TelegramPluginLike) {
    super({
      description: "Send a text message to a telegram chat.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["channel", "telegram"],
      signature: "send_message",
      inputSchema: channelSendMessageInputSchema,
      outputSchema: channelSendMessageOutputSchema,
    }, plugin);
  }

  protected override async invokeImpl(input: unknown): Promise<CapabilityResult> {
    const { to, text } = channelSendMessageInputSchema.parse(input);

    try {
      const result = await this.plugin.engine().sendMessage(to, text);
      return { ok: true, value: { channel: this.plugin.name, ...result } };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class TelegramPullMessagesCapabilityProvider extends TelegramCapabilityProvider {
  constructor(plugin: TelegramPluginLike) {
    super({
      description: "Pull buffered inbound telegram messages.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["channel", "telegram"],
      signature: "pull_messages",
      inputSchema: channelPullMessagesInputSchema,
      outputSchema: channelPullMessagesOutputSchema,
    }, plugin);
  }

  protected override async invokeImpl(input: unknown): Promise<CapabilityResult> {
    const { limit = 50 } = channelPullMessagesInputSchema.parse(input);
    return {
      ok: true,
      value: this.plugin.engine().pullMessages(limit).map((message) => ({
        channel: this.plugin.name,
        id: message.id,
        senderId: message.senderId,
        chatId: message.chatId,
        content: message.content,
        timestamp: message.timestamp,
        media: [...message.media],
        metadata: { ...message.metadata },
      })),
    };
  }
}
