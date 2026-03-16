import type { CapabilityDescriptor, CapabilityProvider } from "../../../kernel/capability.js";
import { CapabilityRegistryServiceProvider } from "../../capability-registry.js";

function matchesAllNamespaces(
  descriptor: CapabilityDescriptor,
  namespaces: string[] | undefined,
): boolean {
  if (!namespaces || namespaces.length === 0) {
    return true;
  }

  const descriptorNamespaces = new Set(descriptor.namespaces);
  return namespaces.every((namespace) => descriptorNamespaces.has(namespace));
}

export class InMemoryCapabilityRegistryService extends CapabilityRegistryServiceProvider {
  private readonly providersByRouteKey = new Map<string, Set<CapabilityProvider>>();
  private readonly providers = new Set<CapabilityProvider>();

  constructor() {
    super({
      id: "capability-registry.memory",
      kind: "capability-registry",
      description: "In-memory capability registry backed by a local Map.",
    });
  }

  public override register(provider: CapabilityProvider): void {
    if (this.providers.has(provider)) {
      return;
    }

    this.providers.add(provider);

    for (const routeKey of provider.routingKeys) {
      const existing = this.providersByRouteKey.get(routeKey) ?? new Set<CapabilityProvider>();
      existing.add(provider);
      this.providersByRouteKey.set(routeKey, existing);
    }
  }

  public override unregister(routeKey: string, pluginName?: string): void {
    const matchedProviders = this.get(routeKey);

    for (const provider of matchedProviders) {
      if (pluginName && provider.descriptor.pluginName !== pluginName) {
        continue;
      }

      this.removeProvider(provider);
    }
  }

  public override get(routeKey: string): CapabilityProvider[] {
    return [...(this.providersByRouteKey.get(routeKey) ?? new Set<CapabilityProvider>())];
  }

  public override list(namespaces?: string[]): CapabilityDescriptor[] {
    return [...this.providers]
      .map((provider) => provider.descriptor)
      .filter((descriptor) => matchesAllNamespaces(descriptor, namespaces));
  }

  private removeProvider(provider: CapabilityProvider): void {
    if (!this.providers.delete(provider)) {
      return;
    }

    for (const routeKey of provider.routingKeys) {
      const existing = this.providersByRouteKey.get(routeKey);

      if (!existing) {
        continue;
      }

      existing.delete(provider);

      if (existing.size === 0) {
        this.providersByRouteKey.delete(routeKey);
        continue;
      }

      this.providersByRouteKey.set(routeKey, existing);
    }
  }
}
