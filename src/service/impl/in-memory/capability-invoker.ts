import type {
  CapabilityContext,
  CapabilityDispatchResult,
  CapabilityProvider,
  CapabilityResult,
} from "../../../kernel/capability.js";
import type { CapabilityRegistryServiceProvider } from "../../capability-registry.js";
import { CapabilityInvokerServiceProvider } from "../../capability-invoker.js";

function applyRestriction(
  providers: CapabilityProvider[],
  context?: CapabilityContext,
): CapabilityProvider[] {
  const include = new Set(context?.restriction?.includePlugins ?? []);
  const exclude = new Set(context?.restriction?.excludePlugins ?? []);

  return providers.filter((provider) => {
    const pluginName = provider.descriptor.pluginName;

    if (include.size > 0 && !include.has(pluginName)) {
      return false;
    }

    if (exclude.has(pluginName)) {
      return false;
    }

    return true;
  });
}

function aggregateResult(
  capabilityId: string,
  dispatches: CapabilityDispatchResult[],
): CapabilityResult {
  const succeeded = dispatches.filter((item) => item.ok);

  if (dispatches.length === 0) {
    return {
      ok: false,
      error: `Capability not found: ${capabilityId}`,
      results: [],
    };
  }

  if (succeeded.length === 0) {
    return {
      ok: false,
      error: dispatches.map((item) => `${item.pluginName}: ${item.error ?? "Unknown error"}`).join("; "),
      results: dispatches,
    };
  }

  const value =
    succeeded.length === 1
      ? succeeded[0].value
      : succeeded.map((item) => ({
        pluginName: item.pluginName,
        value: item.value,
      }));

  return {
    ok: true,
    value,
    results: dispatches,
    metadata: {
      successCount: succeeded.length,
      failureCount: dispatches.length - succeeded.length,
    },
  };
}

export class InMemoryCapabilityInvokerService extends CapabilityInvokerServiceProvider {
  constructor(
    private readonly registry: CapabilityRegistryServiceProvider,
  ) {
    super({
      id: "capability-invoker.memory",
      kind: "capability-invoker",
      description: "In-memory capability invoker backed by a capability registry.",
    });
  }

  public override async invoke(
    capabilityId: string,
    input: unknown,
    context?: CapabilityContext,
  ): Promise<CapabilityResult> {
    const allProviders = await this.registry.get(capabilityId);
    const providers = applyRestriction(allProviders, context);

    if (providers.length === 0) {
      return {
        ok: false,
        error: `Capability not found: ${capabilityId}`,
        results: [],
      };
    }

    const dispatches: CapabilityDispatchResult[] = [];

    for (const provider of providers) {
      const pluginName = provider.descriptor.pluginName;
      const available = await provider.isAvailable();

      if (!available) {
        dispatches.push({
          pluginName,
          capabilityId,
          ok: false,
          error: `Capability is not available: ${capabilityId}`,
        });
        continue;
      }

      try {
        const result = await provider.invoke(input, context);
        dispatches.push({
          pluginName,
          capabilityId,
          ok: result.ok,
          value: result.value,
          error: result.error,
          metadata: result.metadata,
        });
      } catch (error) {
        dispatches.push({
          pluginName,
          capabilityId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return aggregateResult(capabilityId, dispatches);
  }
}
