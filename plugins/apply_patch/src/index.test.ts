import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Application } from "../../../src/application.js";
import ApplyPatchPlugin from "./index.js";

const testRoot = path.join(process.cwd(), ".openintern3", "tests", "apply_patch");

async function resetTestRoot(): Promise<void> {
  await rm(testRoot, { recursive: true, force: true });
}

afterEach(async () => {
  await resetTestRoot();
});

describe("apply_patch capability e2e", () => {
  test("invoke edits target file content", async () => {
    await mkdir(testRoot, { recursive: true });

    const targetPath = path.join(testRoot, "sample.txt");
    await writeFile(targetPath, "before\nvalue\n", "utf8");

    const application = new Application();
    await application.init();
    await application.registerPlugin(new ApplyPatchPlugin());

    const patch = [
      "*** APPLY PATCH START ***",
      `*** ${targetPath} -> EDIT ***`,
      "*** REPLACEE START ***",
      "before",
      "value",
      "*** REPLACEE END ***",
      "*** REPLACER START ***",
      "after",
      "value",
      "*** REPLACER END ***",
      "*** APPLY PATCH END ***",
    ].join("\n");

    const beforeContent = await readFile(targetPath, "utf8");
    const result = await application.capabilityInvoker.invoke("apply_patch.apply", { patch });
    const afterContent = await readFile(targetPath, "utf8");

    expect(result.ok).toBe(true);
    expect(beforeContent).toBe("before\nvalue\n");
    expect(afterContent).toBe("after\nvalue\n");
    expect(afterContent).not.toBe(beforeContent);
    expect(result.value).toEqual({
      action: "EDIT",
      path: targetPath,
      changed: true,
    });
  });
});
