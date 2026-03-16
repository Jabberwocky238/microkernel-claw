import { z } from "zod";
import {
  CapabilityProvider,
  type CapabilityDescriptor,
  type CapabilityContext,
  type CapabilityResult,
} from "@openintern/kernel/capability";
import type {
  TerminalCommandOptions,
  TerminalCommandResult,
  TerminalOutputLine,
  TerminalOutputStream,
  TerminalProcessOptions,
  TerminalProcessSummary,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

interface TerminalsPluginLike {
  readonly name: string;
  readonly version: string;
  readonly isInitialized: boolean;
  start(command: string, options?: TerminalProcessOptions): { pid: number; description: string };
  list(): TerminalProcessSummary[];
  tail(pid: number, lines?: number, stream?: TerminalOutputStream): Promise<TerminalOutputLine[]>;
  kill(pid: number): { pid: number; status: "killed" };
  cmd(command: string, options?: TerminalCommandOptions): PromiseLike<TerminalCommandResult>;
}

const emptyObjectSchema = z.object({}).strict();
const terminalEnvSchema = z.record(z.string(), z.string());
const terminalCommandInputSchema = z.object({
  command: z.string().trim().min(1),
  description: z.string().optional(),
  cwd: z.string().optional(),
  shell: z.string().optional(),
  env: terminalEnvSchema.optional(),
}).strict();
const terminalProcessSummarySchema = z.object({
  pid: z.int(),
  command: z.string(),
  description: z.string(),
  cwd: z.string(),
  status: z.string(),
  startedAt: z.string(),
  runtimeMs: z.int(),
  exitCode: z.int().nullable().optional(),
  signal: z.string().nullable().optional(),
}).strict();
const terminalTailInputSchema = z.object({
  pid: z.int(),
  lines: z.int().optional(),
  stream: z.enum(["stdout", "stderr", "combine"]).optional(),
}).strict();
const terminalOutputLineSchema = z.object({
  source: z.enum(["stdout", "stderr", "combine"]),
  content: z.string(),
}).strict();
const terminalKillInputSchema = z.object({
  pid: z.int(),
}).strict();
const terminalKillOutputSchema = z.object({
  pid: z.int(),
  status: z.literal("killed"),
}).strict();
const terminalExecOutputSchema = z.object({
  command: z.string(),
  cwd: z.string(),
  exitCode: z.int().nullable().optional(),
  signal: z.string().nullable().optional(),
  stdout: z.string(),
  stderr: z.string(),
}).strict();

abstract class TerminalsCapabilityProvider extends CapabilityProvider {
  constructor(
    descriptor: CapabilityDescriptor,
    protected readonly plugin: TerminalsPluginLike,
  ) {
    super(descriptor);
  }

  public override isAvailable(): boolean {
    return this.plugin.isInitialized;
  }
}

export class TerminalStartCapabilityProvider extends TerminalsCapabilityProvider {
  constructor(plugin: TerminalsPluginLike) {
    super(
      {
        description: "Start a child process for a shell command and return its pid.",
        pluginName: plugin.name,
        version: plugin.version,
        namespaces: ["terminals"],
        signature: "start",
        inputSchema: terminalCommandInputSchema,
        outputSchema: z.object({
          pid: z.int(),
          description: z.string(),
        }).strict(),
      },
      plugin,
    );
  }

  protected override async invokeImpl(input: unknown, _context?: CapabilityContext): Promise<CapabilityResult> {
    const parsed = terminalCommandInputSchema.parse(input);

    try {
      return {
        ok: true,
        value: this.plugin.start(parsed.command, {
          description: parsed.description,
          cwd: parsed.cwd,
          shell: parsed.shell,
          env: toStringRecord(parsed.env),
        }),
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class TerminalListCapabilityProvider extends TerminalsCapabilityProvider {
  constructor(plugin: TerminalsPluginLike) {
    super(
      {
        description: "List all tracked child processes with description, runtime and status.",
        pluginName: plugin.name,
        version: plugin.version,
        namespaces: ["terminals"],
        signature: "list",
        inputSchema: emptyObjectSchema,
        outputSchema: z.array(terminalProcessSummarySchema),
      },
      plugin,
    );
  }

  protected override async invokeImpl(_input: unknown, _context?: CapabilityContext): Promise<CapabilityResult> {
    return { ok: true, value: this.plugin.list() };
  }
}

export class TerminalTailCapabilityProvider extends TerminalsCapabilityProvider {
  constructor(plugin: TerminalsPluginLike) {
    super(
      {
        description: "Get the last n output lines of a tracked child process.",
        pluginName: plugin.name,
        version: plugin.version,
        namespaces: ["terminals"],
        signature: "tail",
        inputSchema: terminalTailInputSchema,
        outputSchema: z.array(terminalOutputLineSchema),
      },
      plugin,
    );
  }

  protected override async invokeImpl(input: unknown, _context?: CapabilityContext): Promise<CapabilityResult> {
    const { pid, lines, stream } = terminalTailInputSchema.parse(input);

    try {
      return {
        ok: true,
        value: await this.plugin.tail(pid, lines, stream),
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class TerminalKillCapabilityProvider extends TerminalsCapabilityProvider {
  constructor(plugin: TerminalsPluginLike) {
    super(
      {
        description: "Kill a tracked child process by pid.",
        pluginName: plugin.name,
        version: plugin.version,
        namespaces: ["terminals"],
        signature: "kill",
        inputSchema: terminalKillInputSchema,
        outputSchema: terminalKillOutputSchema,
      },
      plugin,
    );
  }

  protected override async invokeImpl(input: unknown, _context?: CapabilityContext): Promise<CapabilityResult> {
    const { pid } = terminalKillInputSchema.parse(input);

    try {
      return { ok: true, value: this.plugin.kill(pid) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export class TerminalExecCapabilityProvider extends TerminalsCapabilityProvider {
  constructor(plugin: TerminalsPluginLike) {
    super(
      {
        description: "Execute a shell command and await the completed stdout/stderr result.",
        pluginName: plugin.name,
        version: plugin.version,
        namespaces: ["terminals"],
        signature: "exec",
        inputSchema: terminalCommandInputSchema,
        outputSchema: terminalExecOutputSchema,
      },
      plugin,
    );
  }

  protected override async invokeImpl(input: unknown, _context?: CapabilityContext): Promise<CapabilityResult> {
    const parsed = terminalCommandInputSchema.parse(input);

    try {
      const result = await this.plugin.cmd(parsed.command, {
        description: parsed.description,
        cwd: parsed.cwd,
        shell: parsed.shell,
        env: toStringRecord(parsed.env),
      });
      return { ok: true, value: result };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
