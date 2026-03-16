import {
  CapabilityProvider,
  type CapabilityContext,
  type CapabilityDescriptor,
  type CapabilityResult,
} from "@openintern/kernel/capability";
import type { FeishuInner } from "./inner.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
      id: "feishu.start",
      description: "Start the Feishu client.",
      pluginName: plugin.name,
      version: plugin.version,
      tags: ["feishu", "channel", "control"],
      input: { type: "object", properties: {}, required: [], additionalProperties: false },
      output: {
        type: "object",
        properties: { started: { type: "boolean" } },
        required: ["started"],
        additionalProperties: false,
      },
    }, plugin);
  }

  public override async invoke(
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
      id: "feishu.stop",
      description: "Stop the Feishu client.",
      pluginName: plugin.name,
      version: plugin.version,
      tags: ["feishu", "channel", "control"],
      input: { type: "object", properties: {}, required: [], additionalProperties: false },
      output: {
        type: "object",
        properties: { stopped: { type: "boolean" } },
        required: ["stopped"],
        additionalProperties: false,
      },
    }, plugin);
  }

  public override async invoke(): Promise<CapabilityResult> {
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
      id: "channel.status",
      description: "Get current channel plugin status.",
      pluginName: plugin.name,
      version: plugin.version,
      tags: ["feishu", "channel", "read"],
      input: { type: "object", properties: {}, required: [], additionalProperties: false },
      output: {
        type: "object",
        properties: {
          channel: { type: "string" },
          enabled: { type: "boolean" },
          started: { type: "boolean" },
          queueSize: { type: "integer" },
        },
        required: ["channel", "enabled", "started", "queueSize"],
        additionalProperties: true,
      },
    }, plugin);
  }

  public override async invoke(): Promise<CapabilityResult> {
    return { ok: true, value: { channel: this.plugin.name, ...this.plugin.inner().status() } };
  }
}

export class FeishuSendMessageCapabilityProvider extends FeishuCapabilityProvider {
  constructor(plugin: FeishuPluginLike) {
    super({
      id: "channel.send_message",
      description: "Send a text message to a channel.",
      pluginName: plugin.name,
      version: plugin.version,
      tags: ["feishu", "channel", "write"],
      input: {
        type: "object",
        properties: {
          to: { type: "string" },
          text: { type: "string" },
        },
        required: ["to", "text"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          channel: { type: "string" },
          to: { type: "string" },
          sent: { type: "boolean" },
        },
        required: ["channel", "to", "sent"],
        additionalProperties: false,
      },
    }, plugin);
  }

  public override async invoke(input: unknown): Promise<CapabilityResult> {
    if (!isRecord(input) || typeof input.to !== "string" || typeof input.text !== "string") {
      return { ok: false, error: "to and text are required." };
    }

    try {
      const result = await this.plugin.inner().sendMessage(input.to, input.text);
      return { ok: true, value: { channel: this.plugin.name, to: result.chatId, sent: result.sent } };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class FeishuPullMessagesCapabilityProvider extends FeishuCapabilityProvider {
  constructor(plugin: FeishuPluginLike) {
    super({
      id: "channel.pull_messages",
      description: "Pull buffered inbound channel messages.",
      pluginName: plugin.name,
      version: plugin.version,
      tags: ["feishu", "channel", "read"],
      input: {
        type: "object",
        properties: {
          limit: { type: "integer" },
        },
        required: [],
        additionalProperties: false,
      },
      output: {
        type: "array",
        items: {
          type: "object",
          properties: {
            channel: { type: "string" },
            id: { type: "string" },
            senderId: { type: "string" },
            chatId: { type: "string" },
            content: { type: "string" },
            timestamp: { type: "string" },
            media: { type: "array", items: { type: "string" } },
            metadata: { type: "object", properties: {}, additionalProperties: true },
          },
          required: ["channel", "id", "senderId", "chatId", "content", "timestamp", "media", "metadata"],
          additionalProperties: false,
        },
      },
    }, plugin);
  }

  public override async invoke(input: unknown): Promise<CapabilityResult> {
    const limit =
      isRecord(input) && typeof input.limit === "number" && Number.isInteger(input.limit)
        ? input.limit
        : 50;
    return {
      ok: true,
      value: this.plugin.inner().pullMessages(limit).map((message) => ({
        channel: this.plugin.name,
        ...message,
      })),
    };
  }
}
