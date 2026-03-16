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
import type { WhatsAppInner } from "./inner.js";

interface WhatsAppPluginLike {
  readonly name: string;
  readonly version: string;
  readonly isInitialized: boolean;
  inner(): WhatsAppInner;
}

abstract class WhatsAppCapabilityProvider extends CapabilityProvider {
  constructor(descriptor: CapabilityDescriptor, protected readonly plugin: WhatsAppPluginLike) {
    super(descriptor);
  }

  public override isAvailable(): boolean {
    return this.plugin.isInitialized;
  }
}

export class WhatsAppStartCapabilityProvider extends WhatsAppCapabilityProvider {
  constructor(plugin: WhatsAppPluginLike) {
    super({
      description: "Start the WhatsApp client.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["whatsapp"],
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

export class WhatsAppStopCapabilityProvider extends WhatsAppCapabilityProvider {
  constructor(plugin: WhatsAppPluginLike) {
    super({
      description: "Stop the WhatsApp client.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["whatsapp"],
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

export class WhatsAppStatusCapabilityProvider extends WhatsAppCapabilityProvider {
  constructor(plugin: WhatsAppPluginLike) {
    super({
      description: "Get current channel plugin status.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["whatsapp"],
      signature: "status",
      inputSchema: emptyObjectSchema,
      outputSchema: channelStatusOutputSchema,
    }, plugin);
  }

  protected override async invokeImpl(): Promise<CapabilityResult> {
    return { ok: true, value: { channel: this.plugin.name, ...this.plugin.inner().status() } };
  }
}

export class WhatsAppSendMessageCapabilityProvider extends WhatsAppCapabilityProvider {
  constructor(plugin: WhatsAppPluginLike) {
    super({
      description: "Send a text message to a channel.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["whatsapp"],
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

export class WhatsAppPullMessagesCapabilityProvider extends WhatsAppCapabilityProvider {
  constructor(plugin: WhatsAppPluginLike) {
    super({
      description: "Pull buffered inbound channel messages.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["whatsapp"],
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
        senderId: message.sender,
        chatId: message.sender,
        content: message.content,
        timestamp: new Date(message.timestamp * 1000).toISOString(),
        media: [...message.media],
        metadata: {
          pn: message.pn,
          isGroup: message.isGroup,
        },
      })),
    };
  }
}


