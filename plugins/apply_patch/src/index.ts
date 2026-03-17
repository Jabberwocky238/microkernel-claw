import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CapabilityProvider, Plugin } from "@openintern/kernel";
import { ApplyPatchCapabilityProvider } from "./capabilities.js";
import type {
  ApplyPatchAction,
  ApplyPatchRequest,
  ApplyPatchResult,
} from "./types.js";

const APPLY_PATCH_START = "*** APPLY PATCH START ***";
const APPLY_PATCH_END = "*** APPLY PATCH END ***";
const REPLACEE_START = "*** REPLACEE START ***";
const REPLACEE_END = "*** REPLACEE END ***";
const REPLACER_START = "*** REPLACER START ***";
const REPLACER_END = "*** REPLACER END ***";

export default class ApplyPatchPlugin extends Plugin {
  constructor() {
    super({
      name: "apply_patch",
      version: "0.0.0",
      namespaces: ["apply_patch"],
    });
  }

  public override capabilities(): CapabilityProvider[] {
    return [
      new ApplyPatchCapabilityProvider(this),
    ];
  }

  public parsePatch(patch: string): ApplyPatchRequest {
    if (typeof patch !== "string" || patch.trim().length === 0) {
      throw new TypeError("patch must be a non-empty string.");
    }

    const normalized = patch.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");

    if (lines[0] !== APPLY_PATCH_START) {
      throw new Error(`First line must be '${APPLY_PATCH_START}'.`);
    }

    if (lines[lines.length - 1] !== APPLY_PATCH_END) {
      throw new Error(`Last line must be '${APPLY_PATCH_END}'.`);
    }

    if (lines.length < 3) {
      throw new Error("Patch must contain header, path/action line and end marker.");
    }

    const header = lines[1]?.trim() ?? "";
    const match = header.match(/^(?:\*\*\*\s+)(.+?)(?:\s+->\s+)(CREATE|EDIT|DELETE)(?:\s+\*\*\*)$/);

    if (!match) {
      throw new Error("Second line must be '*** PATH -> ACTION ***'. ACTION must be CREATE, EDIT or DELETE.");
    }

    const rawPath = match[1] ?? "";
    const action = (match[2] ?? "") as ApplyPatchAction;
    const body = lines.slice(2, -1).join("\n");
    const filePath = rawPath.trim();

    if (!filePath) {
      throw new Error("Patch path must be a non-empty string.");
    }

    if (action === "CREATE") {
      return {
        action,
        path: filePath,
        content: body,
      };
    }

    if (action === "DELETE") {
      if (body.trim().length > 0) {
        throw new Error("Delete patch must not contain body content.");
      }

      return {
        action,
        path: filePath,
      };
    }

    const replacee = this.readSection(body, REPLACEE_START, REPLACEE_END);
    const replacer = this.readSection(body, REPLACER_START, REPLACER_END);

    return {
      action,
      path: filePath,
      replacee,
      replacer,
    };
  }

  public async applyPatch(patch: string): Promise<ApplyPatchResult> {
    const request = this.parsePatch(patch);
    const targetPath = this.resolveTargetPath(request.path);

    if (request.action === "CREATE") {
      await this.createFile(targetPath, request.content ?? "");
      return {
        action: request.action,
        path: targetPath,
        changed: true,
      };
    }

    if (request.action === "DELETE") {
      await this.deleteFile(targetPath);
      return {
        action: request.action,
        path: targetPath,
        changed: true,
      };
    }

    await this.editFile(targetPath, request.replacee ?? "", request.replacer ?? "");
    return {
      action: request.action,
      path: targetPath,
      changed: true,
    };
  }

  private readSection(body: string, startMarker: string, endMarker: string): string {
    const startIndex = body.indexOf(startMarker);
    const endIndex = body.indexOf(endMarker);

    if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
      throw new Error(`Missing section markers: ${startMarker} ... ${endMarker}`);
    }

    const contentStart = startIndex + startMarker.length;
    let raw = body.slice(contentStart, endIndex);

    if (raw.startsWith("\n")) {
      raw = raw.slice(1);
    }

    if (raw.endsWith("\n")) {
      raw = raw.slice(0, -1);
    }

    return raw;
  }

  private resolveTargetPath(target: string): string {
    return path.isAbsolute(target)
      ? path.normalize(target)
      : path.resolve(process.cwd(), target);
  }

  private async createFile(targetPath: string, content: string): Promise<void> {
    await mkdir(path.dirname(targetPath), { recursive: true });

    try {
      await access(targetPath);
      throw new Error(`File already exists: ${targetPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    await writeFile(targetPath, content, "utf8");
  }

  private async deleteFile(targetPath: string): Promise<void> {
    await access(targetPath);
    await rm(targetPath);
  }

  private async editFile(targetPath: string, replacee: string, replacer: string): Promise<void> {
    if (replacee.length === 0) {
      throw new Error("Edit patch replacee must not be empty.");
    }

    const original = await readFile(targetPath, "utf8");
    const occurrences = original.split(replacee).length - 1;

    if (occurrences === 0) {
      throw new Error(`Replacee block not found in file: ${targetPath}`);
    }

    if (occurrences > 1) {
      throw new Error(`Replacee block is ambiguous in file: ${targetPath}`);
    }

    await writeFile(targetPath, original.replace(replacee, replacer), "utf8");
  }
}

export type {
  ApplyPatchAction,
  ApplyPatchRequest,
  ApplyPatchResult,
} from "./types.js";
