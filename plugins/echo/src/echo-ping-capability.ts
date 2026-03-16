import { z } from "zod";
import {
  CapabilityProvider,
  type CapabilityContext,
  type CapabilityResult,
} from "@openintern/kernel/capability";

interface EchoPingPluginLike {
  readonly name: string;
  readonly version: string;
  readonly isInitialized: boolean;
  ping(args: string[]): string;
}

const echoPingInputSchema = z.object({
  args: z.array(z.string()).describe("Arguments forwarded to echo.ping."),
}).strict();

const echoPingOutputSchema = z.string().describe("The ping result.");

export class EchoPingCapabilityProvider extends CapabilityProvider {
  constructor(private readonly plugin: EchoPingPluginLike) {
    super({
      description: "Log any provided arguments and return pong.",
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["echo"],
      signature: "ping",
      inputSchema: echoPingInputSchema,
      outputSchema: echoPingOutputSchema,
    });
  }

  public override isAvailable(): boolean {
    return this.plugin.isInitialized;
  }

  protected override async invokeImpl(
    input: unknown,
    _context?: CapabilityContext,
  ): Promise<CapabilityResult> {
    const { args } = echoPingInputSchema.parse(input);

    return {
      ok: true,
      value: this.plugin.ping(args),
    };
  }
}
