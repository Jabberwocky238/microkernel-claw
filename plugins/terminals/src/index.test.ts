import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { Application } from "../../../src/application.js";
import TerminalsPlugin from "./index.js";

const testRoot = path.join(process.cwd(), ".openintern3", "tests", "terminals");

async function resetTestRoot(): Promise<void> {
  await rm(testRoot, { recursive: true, force: true });
}

function buildWriteFileCommand(filePath: string, content: string): string {
  if (process.platform === "win32") {
    return `Set-Content -Path '${filePath}' -Value '${content}'`;
  }

  return `touch '${filePath}'`;
}

afterEach(async () => {
  await resetTestRoot();
});

describe("terminals capability e2e", () => {
  test("invoke exec writes file in target cwd", async () => {
    await mkdir(testRoot, { recursive: true });

    const targetFilePath = path.join(testRoot, "terminal-e2e.txt");
    const expectedContent = "terminal e2e";
    const command = buildWriteFileCommand(targetFilePath, expectedContent);

    const application = new Application();
    await application.init();
    await application.registerPlugin(new TerminalsPlugin());

    const result = await application.capabilityInvoker.invoke("terminals.exec", {
      command,
      cwd: testRoot,
      description: "terminals e2e write file",
    });

    expect(result.ok).toBe(true);

    if (process.platform === "win32") {
      const fileContent = await readFile(targetFilePath, "utf8");
      expect(fileContent.replace(/\r\n/g, "\n")).toBe(`${expectedContent}\n`);
    }

    expect(result.value).toEqual({
      command,
      cwd: testRoot,
      exitCode: 0,
      signal: null,
      stdout: "",
      stderr: "",
    });
  });

  test("invoke exec rejects stacked commands", async () => {
    const application = new Application();
    await application.init();
    await application.registerPlugin(new TerminalsPlugin());

    const result = await application.capabilityInvoker.invoke("terminals.exec", {
      command: "echo hello && echo world",
      cwd: testRoot,
      description: "terminals e2e reject stacked command",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("terminals: Only a single command is allowed. Command chaining with &&, ||, ; or newlines is not permitted.");
  });

  test("invoke exec rejects nested shell wrappers", async () => {
    const application = new Application();
    await application.init();
    await application.registerPlugin(new TerminalsPlugin());

    const result = await application.capabilityInvoker.invoke("terminals.exec", {
      command: "powershell -Command Write-Host hi",
      cwd: testRoot,
      description: "terminals e2e reject nested shell",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("terminals: Do not wrap commands with bash/sh/zsh/pwsh/powershell. Provide a single direct command only.");
  });
});
