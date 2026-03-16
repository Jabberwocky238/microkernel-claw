import { z } from "zod";
import {
  CapabilityProvider,
  type CapabilityContext,
  type CapabilityResult,
} from "@openintern/kernel/capability";

interface CronPluginLike {
  readonly name: string;
  readonly version: string;
  readonly isInitialized: boolean;
  addCron(eventType: string, intervalMs: number): string;
  deleteCron(id: string): void;
  listCron(): Array<{
    id: string;
    eventType: string;
    intervalMs: number;
  }>;
}

const cronAddInputSchema = z.object({
  eventType: z.string().trim().min(1).describe("Event type emitted by the cron job."),
  intervalMs: z.int().positive().describe("Cron interval in milliseconds."),
}).strict();

const cronDeleteInputSchema = z.object({
  id: z.string().trim().min(1).describe("Cron job id."),
}).strict();

const cronListItemSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  intervalMs: z.number(),
}).strict();

const emptyObjectSchema = z.object({}).strict();

export class CronAddCapabilityProvider extends CapabilityProvider {
  constructor(private readonly plugin: CronPluginLike) {
    super({
      description: "Create a repeating cron job.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["cron"],
      signature: "add",
      inputSchema: cronAddInputSchema,
      outputSchema: z.string().describe("The created cron job id."),
    });
  }

  public override isAvailable(): boolean {
    return this.plugin.isInitialized;
  }

  protected override async invokeImpl(
    input: unknown,
    _context?: CapabilityContext,
  ): Promise<CapabilityResult> {
    const { eventType, intervalMs } = cronAddInputSchema.parse(input);

    return {
      ok: true,
      value: this.plugin.addCron(eventType, intervalMs),
    };
  }
}

export class CronDeleteCapabilityProvider extends CapabilityProvider {
  constructor(private readonly plugin: CronPluginLike) {
    super({
      description: "Delete an existing cron job by id.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["cron"],
      signature: "delete",
      inputSchema: cronDeleteInputSchema,
      outputSchema: z.object({
        deleted: z.literal(true),
        id: z.string(),
      }).strict(),
    });
  }

  public override isAvailable(): boolean {
    return this.plugin.isInitialized;
  }

  protected override async invokeImpl(
    input: unknown,
    _context?: CapabilityContext,
  ): Promise<CapabilityResult> {
    const { id } = cronDeleteInputSchema.parse(input);
    this.plugin.deleteCron(id);

    return {
      ok: true,
      value: {
        deleted: true,
        id,
      },
    };
  }
}

export class CronListCapabilityProvider extends CapabilityProvider {
  constructor(private readonly plugin: CronPluginLike) {
    super({
      description: "List all active cron jobs.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["cron"],
      signature: "list",
      inputSchema: emptyObjectSchema,
      outputSchema: z.array(cronListItemSchema).describe("Active cron jobs."),
    });
  }

  public override isAvailable(): boolean {
    return this.plugin.isInitialized;
  }

  protected override async invokeImpl(
    _input: unknown,
    _context?: CapabilityContext,
  ): Promise<CapabilityResult> {
    return {
      ok: true,
      value: this.plugin.listCron(),
    };
  }
}
