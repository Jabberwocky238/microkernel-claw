import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface PluginPreset {
  name: string;
  version: string;
  importPath: string;
  autoStart: boolean;
}

export interface OpenInternConfiguration {
  version: string;
  plugins: PluginPreset[];
}

export const OpenInternConfigDir = path.join(process.cwd(), ".openintern3");
export const OpenInternConfigPath = path.join(OpenInternConfigDir, "config.json");

export function defaultPluginPresets(): PluginPreset[] {
  return [
    {
      name: "echo",
      version: "0.0.0",
      importPath: "../plugins/echo/src/index.ts",
      autoStart: true,
    },
    {
      name: "cron",
      version: "0.0.0",
      importPath: "../plugins/cron/src/index.ts",
      autoStart: true,
    },
    {
      name: "agent",
      version: "0.0.0",
      importPath: "../plugins/agent/src/index.ts",
      autoStart: true,
    },
    {
      name: "apply_patch",
      version: "0.0.0",
      importPath: "../plugins/apply_patch/src/index.ts",
      autoStart: true,
    },
    {
      name: "terminals",
      version: "0.0.0",
      importPath: "../plugins/terminals/src/index.ts",
      autoStart: true,
    },
    {
      name: "feishu",
      version: "0.0.0",
      importPath: "../plugins/feishu/src/index.ts",
      autoStart: false,
    },
    {
      name: "whatsapp",
      version: "0.0.0",
      importPath: "../plugins/whatsapp/src/index.ts",
      autoStart: true,
    },
    {
      name: "wecom",
      version: "0.0.0",
      importPath: "../plugins/wecom/src/index.ts",
      autoStart: true,
    },
    {
      name: "telegram",
      version: "0.0.0",
      importPath: "../plugins/telegram/src/index.ts",
      autoStart: true,
    },
  ];
}

export function defaultConfiguration(): OpenInternConfiguration {
  return {
    version: "1",
    plugins: defaultPluginPresets(),
  };
}

export async function saveConfiguration(
  configuration: OpenInternConfiguration,
  filePath: string = OpenInternConfigPath,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(configuration, null, 2)}\n`, "utf8");
}

export async function ensureConfiguration(
  filePath: string = OpenInternConfigPath,
): Promise<OpenInternConfiguration> {
  if (!existsSync(filePath)) {
    const configuration = defaultConfiguration();
    await saveConfiguration(configuration, filePath);
    return configuration;
  }

  return loadConfiguration(filePath);
}

export async function loadConfiguration(
  filePath: string = OpenInternConfigPath,
): Promise<OpenInternConfiguration> {
  const content = await readFile(filePath, "utf8");
  const parsed = JSON.parse(content) as Partial<OpenInternConfiguration>;

  return {
    version: typeof parsed.version === "string" ? parsed.version : "1",
    plugins: Array.isArray(parsed.plugins)
      ? parsed.plugins.map((preset) => ({
        name: typeof preset?.name === "string" ? preset.name : "",
        version: typeof preset?.version === "string" ? preset.version : "0.0.0",
        importPath: typeof preset?.importPath === "string" ? preset.importPath : "",
        autoStart: preset?.autoStart !== false,
      }))
      : [],
  };
}

export function resolvePluginImportPath(importPath: string, fromUrl: string): string {
  return new URL(importPath, fromUrl).href;
}
