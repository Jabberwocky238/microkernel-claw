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
import type { WecomEngine } from "./engine.js";

interface WecomPluginLike {
  readonly name: string;
  readonly version: string;
  readonly isInitialized: boolean;
  inner(): WecomEngine;
}

abstract class WecomCapabilityProvider extends CapabilityProvider {
  constructor(descriptor: CapabilityDescriptor, protected readonly plugin: WecomPluginLike) {
    super(descriptor);
  }

  public override isAvailable(): boolean {
    return this.plugin.isInitialized;
  }
}

export class WecomStartCapabilityProvider extends WecomCapabilityProvider {
  constructor(plugin: WecomPluginLike) {
    super({
      description: "Start the WeCom WebSocket client.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["wecom"],
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
      await this.plugin.inner().start();
      return { ok: true, value: { started: true } };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class WecomStopCapabilityProvider extends WecomCapabilityProvider {
  constructor(plugin: WecomPluginLike) {
    super({
      description: "Stop the WeCom WebSocket client.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["wecom"],
      signature: "stop",
      inputSchema: emptyObjectSchema,
      outputSchema: channelStopOutputSchema,
    }, plugin);
  }

  protected override async invokeImpl(): Promise<CapabilityResult> {
    try {
      await this.plugin.inner().stop();
      return { ok: true, value: { stopped: true } };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class WecomStatusCapabilityProvider extends WecomCapabilityProvider {
  constructor(plugin: WecomPluginLike) {
    super({
      description: "Get current channel plugin status.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["wecom"],
      signature: "status",
      inputSchema: emptyObjectSchema,
      outputSchema: channelStatusOutputSchema,
    }, plugin);
  }

  protected override async invokeImpl(): Promise<CapabilityResult> {
    return { ok: true, value: { channel: this.plugin.name, ...this.plugin.inner().status() } };
  }
}

export class WecomSendMessageCapabilityProvider extends WecomCapabilityProvider {
  constructor(plugin: WecomPluginLike) {
    super({
      description: "Send a text message to a channel.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["channel", "wecom"],
      signature: "send_message",
      inputSchema: channelSendMessageInputSchema,
      outputSchema: channelSendMessageOutputSchema,
    }, plugin);
  }

  protected override async invokeImpl(input: unknown): Promise<CapabilityResult> {
    const { to, text } = channelSendMessageInputSchema.parse(input);

    try {
      const result = await this.plugin.inner().sendMessage(to, text);
      return { ok: true, value: { channel: this.plugin.name, ...result } };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class WecomPullMessagesCapabilityProvider extends WecomCapabilityProvider {
  constructor(plugin: WecomPluginLike) {
    super({
      description: "Pull buffered inbound channel messages.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["channel", "wecom"],
      signature: "pull_messages",
      inputSchema: channelPullMessagesInputSchema,
      outputSchema: channelPullMessagesOutputSchema,
    }, plugin);
  }

  protected override async invokeImpl(input: unknown): Promise<CapabilityResult> {
    const { limit = 50 } = channelPullMessagesInputSchema.parse(input);

    return {
      ok: true,
      value: this.plugin.inner().pullMessages(limit).map((message) => ({
        channel: this.plugin.name,
        id: message.id,
        senderId: message.senderId,
        chatId: message.chatId,
        content: message.content,
        timestamp: message.timestamp,
        media: [...message.media],
        metadata: {
          msgType: message.msgType,
          event: message.event,
          ...message.metadata,
        },
      })),
    };
  }
}

