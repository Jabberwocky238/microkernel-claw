import { z } from "zod";
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
} from "@openintern3/plugin-agent/channel-capability-schemas";
import type { FeishuInner } from "./inner.js";

interface FeishuPluginLike {
  readonly name: string;
  readonly version: string;
  readonly isInitialized: boolean;
  inner(): FeishuInner;
}

abstract class FeishuCapabilityProvider extends CapabilityProvider {
  constructor(descriptor: CapabilityDescriptor, protected readonly plugin: FeishuPluginLike) {
    super(descriptor);
  }

  public override isAvailable(): boolean {
    return this.plugin.isInitialized;
  }
}

export class FeishuStartCapabilityProvider extends FeishuCapabilityProvider {
  constructor(plugin: FeishuPluginLike) {
    super({
      description: "Start the Feishu client.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["feishu"],
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

export class FeishuStopCapabilityProvider extends FeishuCapabilityProvider {
  constructor(plugin: FeishuPluginLike) {
    super({
      description: "Stop the Feishu client.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["feishu"],
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

export class FeishuStatusCapabilityProvider extends FeishuCapabilityProvider {
  constructor(plugin: FeishuPluginLike) {
    super({
      description: "Get current channel plugin status.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["feishu"],
      signature: "status",
      inputSchema: emptyObjectSchema,
      outputSchema: channelStatusOutputSchema,
    }, plugin);
  }

  protected override async invokeImpl(): Promise<CapabilityResult> {
    return { ok: true, value: { channel: this.plugin.name, ...this.plugin.inner().status() } };
  }
}

export class FeishuSendMessageCapabilityProvider extends FeishuCapabilityProvider {
  constructor(plugin: FeishuPluginLike) {
    super({
      description: "Send a text message to a channel.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["feishu"],
      signature: "send_message",
      inputSchema: channelSendMessageInputSchema,
      outputSchema: channelSendMessageOutputSchema,
    }, plugin);
  }

  protected override async invokeImpl(input: unknown): Promise<CapabilityResult> {
    const { to, text } = channelSendMessageInputSchema.parse(input);

    try {
      const result = await this.plugin.inner().sendMessage(to, text);
      return { ok: true, value: { channel: this.plugin.name, to: result.chatId, sent: result.sent } };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class FeishuPullMessagesCapabilityProvider extends FeishuCapabilityProvider {
  constructor(plugin: FeishuPluginLike) {
    super({
      description: "Pull buffered inbound channel messages.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["feishu"],
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
        metadata: z.object({}).catchall(z.unknown()).parse(message.metadata),
      })),
    };
  }
}


