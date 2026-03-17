import { z } from "zod";
import {
  CapabilityProvider,
  type CapabilityContext,
  type CapabilityResult,
} from "@openintern/kernel/capability";
import type {
  ApplyPatchPluginLike,
  ApplyPatchResult,
} from "./types.js";

const applyPatchInputSchema = z.object({
  patch: z.string().trim().min(1).describe("Patch text in apply_patch plugin format."),
}).strict();

const applyPatchResultSchema = z.object({
  action: z.enum(["CREATE", "EDIT", "DELETE"]),
  path: z.string(),
  changed: z.boolean(),
}).strict();

export class ApplyPatchCapabilityProvider extends CapabilityProvider {
  constructor(private readonly plugin: ApplyPatchPluginLike) {
    super({
      description: [
        "Apply a single-file patch using one of these exact formats:",
        "",
        "Create:",
        "*** APPLY PATCH START ***",
        "*** path/to/file -> CREATE ***",
        "<entire new file content>",
        "*** APPLY PATCH END ***",
        "",
        "Edit:",
        "*** APPLY PATCH START ***",
        "*** path/to/file -> EDIT ***",
        "*** REPLACEE START ***",
        "<exact old content>",
        "*** REPLACEE END ***",
        "*** REPLACER START ***",
        "<exact new content>",
        "*** REPLACER END ***",
        "*** APPLY PATCH END ***",
        "",
        "Delete:",
        "*** APPLY PATCH START ***",
        "*** path/to/file -> DELETE ***",
        "*** APPLY PATCH END ***",
        "",
        "ACTION supports only: CREATE, EDIT, DELETE.",
        "Prefer small, precise replacements.",
        "Do not attempt to replace hundreds of lines in one edit.",
      ].join("\n"),
      pluginName: plugin.name,
      version: plugin.version,
      namespaces: ["apply_patch"],
      signature: "apply",
      inputSchema: applyPatchInputSchema,
      outputSchema: applyPatchResultSchema,
    });
  }

  public override isAvailable(): boolean {
    return this.plugin.isInitialized;
  }

  protected override async invokeImpl(
    input: unknown,
    _context?: CapabilityContext,
  ): Promise<CapabilityResult> {
    const { patch } = applyPatchInputSchema.parse(input);
    const result = await this.plugin.applyPatch(patch);

    return {
      ok: true,
      value: result,
    };
  }
}

export {
  applyPatchInputSchema,
  applyPatchResultSchema,
};
export type { ApplyPatchResult };
