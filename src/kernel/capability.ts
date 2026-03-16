import { z, type ZodType } from "zod";

export type CapabilitySchema = ZodType<unknown>;
export type CapabilityJsonSchema = Record<string, unknown>;

export interface CapabilityDescriptor {
  description: string;
  pluginName: string;
  version: string;
  namespaces: string[];
  signature: string;
  inputSchema: CapabilitySchema;
  outputSchema: CapabilitySchema;
}

export interface CapabilityInvokeRestriction {
  includePlugins?: string[];
  excludePlugins?: string[];
}

export interface CapabilityContext {
  callerPluginName?: string;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
  restriction?: CapabilityInvokeRestriction;
}

export interface CapabilityDispatchResult {
  pluginName: string;
  capabilityId: string;
  ok: boolean;
  value?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface CapabilityResult {
  ok: boolean;
  value?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
  results?: CapabilityDispatchResult[];
}

function formatZodError(prefix: string, error: z.ZodError): string {
  const issue = error.issues[0];

  if (!issue) {
    return prefix;
  }

  const path = issue.path.length > 0 ? issue.path.join(".") : "root";
  return `${prefix} at ${path}: ${issue.message}`;
}

function normalizeSegment(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new TypeError(`${fieldName} must contain only letters, numbers, '_' or '-'.`);
  }

  return normalized;
}

function permute(values: string[]): string[][] {
  if (values.length <= 1) {
    return [values];
  }

  const result: string[][] = [];

  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    const rest = values.filter((_, restIndex) => restIndex !== index);

    for (const permutation of permute(rest)) {
      result.push([current, ...permutation]);
    }
  }

  return result;
}

function enumerateNamespaceVariants(namespaces: string[]): string[][] {
  const variants: string[][] = [];
  const visited = new Set<string>();

  for (let mask = 1; mask < (1 << namespaces.length); mask += 1) {
    const subset = namespaces.filter((_, index) => ((mask >> index) & 1) === 1);

    for (const permutation of permute(subset)) {
      const key = permutation.join(".");

      if (visited.has(key)) {
        continue;
      }

      visited.add(key);
      variants.push(permutation);
    }
  }

  return variants;
}

export function normalizeCapabilityDescriptor(
  descriptor: CapabilityDescriptor,
): CapabilityDescriptor {
  const namespaces = [...new Set(descriptor.namespaces.map((namespace, index) => (
    normalizeSegment(namespace, `namespaces[${index}]`)
  )))];

  if (namespaces.length === 0) {
    throw new TypeError("namespaces must contain at least one namespace.");
  }

  return {
    ...descriptor,
    description: descriptor.description.trim(),
    pluginName: descriptor.pluginName.trim(),
    version: descriptor.version.trim(),
    namespaces,
    signature: normalizeSegment(descriptor.signature, "signature"),
  };
}

export function capabilityPrimaryRouteKey(descriptor: CapabilityDescriptor): string {
  const normalized = normalizeCapabilityDescriptor(descriptor);
  return `${normalized.namespaces[0]}.${normalized.signature}`;
}

export function enumerateCapabilityRouteKeys(
  descriptor: CapabilityDescriptor,
): string[] {
  const normalized = normalizeCapabilityDescriptor(descriptor);

  return enumerateNamespaceVariants(normalized.namespaces).map((namespaces) => (
    `${namespaces.join(".")}.${normalized.signature}`
  ));
}

export function capabilitySchemaToJsonSchema(
  schema: CapabilitySchema,
  io: "input" | "output",
): CapabilityJsonSchema {
  return z.toJSONSchema(schema, {
    io,
    unrepresentable: "any",
  }) as CapabilityJsonSchema;
}

export abstract class CapabilityProvider {
  public readonly descriptor: CapabilityDescriptor;

  protected constructor(descriptor: CapabilityDescriptor) {
    this.descriptor = normalizeCapabilityDescriptor(descriptor);
  }

  public get id(): string {
    return capabilityPrimaryRouteKey(this.descriptor);
  }

  public get routingKeys(): string[] {
    return enumerateCapabilityRouteKeys(this.descriptor);
  }

  public abstract isAvailable(): boolean | Promise<boolean>;

  public async invoke(
    input: unknown,
    context?: CapabilityContext,
  ): Promise<CapabilityResult> {
    const parsedInput = this.descriptor.inputSchema.safeParse(input);

    if (!parsedInput.success) {
      return {
        ok: false,
        error: formatZodError(
          `Invalid capability input for ${this.id}`,
          parsedInput.error,
        ),
      };
    }

    const result = await this.invokeImpl(parsedInput.data, context);

    if (!result.ok) {
      return result;
    }

    const parsedOutput = this.descriptor.outputSchema.safeParse(result.value);

    if (!parsedOutput.success) {
      return {
        ok: false,
        error: formatZodError(
          `Invalid capability output for ${this.id}`,
          parsedOutput.error,
        ),
        metadata: result.metadata,
        results: result.results,
      };
    }

    return {
      ...result,
      value: parsedOutput.data,
    };
  }

  protected abstract invokeImpl(
    input: unknown,
    context?: CapabilityContext,
  ): Promise<CapabilityResult>;
}
