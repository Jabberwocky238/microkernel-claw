import type { CapabilityDescriptor, CapabilityProvider } from "../kernel/capability.js";
import { ServiceProvider } from "./base.js";

export abstract class CapabilityRegistryServiceProvider extends ServiceProvider {
  public abstract register(provider: CapabilityProvider): void | Promise<void>;

  public abstract unregister(routeKey: string, pluginName?: string): void | Promise<void>;

  public abstract get(routeKey: string): CapabilityProvider[] | Promise<CapabilityProvider[]>;

  public abstract list(namespaces?: string[]): CapabilityDescriptor[] | Promise<CapabilityDescriptor[]>;
}
