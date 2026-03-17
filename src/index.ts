import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";
export * from "./kernel/index.js";
export * from "./service/index.js";
export * from "./application.js";
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { PluginLoader } from "./kernel/plugin-loader.js";
import { Application } from "./application.js";
import {
  ensureConfiguration,
  resolvePluginImportPath,
} from "./configuration.js";

if (existsSync(".env.dev")) {
  dotenv.config({ path: ".env.dev" });
} else if (existsSync(".env")) {
  dotenv.config({ path: ".env" });
}

const application = new Application();
await application.init();

const pluginLoader = new PluginLoader();
const configuration = await ensureConfiguration();
const pluginModulePaths = configuration.plugins
  .filter((preset) => preset.autoStart)
  .map((preset) => resolvePluginImportPath(preset.importPath, import.meta.url));

for (const pluginModulePath of pluginModulePaths) {
  const plugin = await pluginLoader.loadFromImport(pluginModulePath);
  await application.registerPlugin(plugin);
}

const terminal = createInterface({
  input: stdin,
  output: stdout,
  prompt: application.getPrompt(),
  historySize: 1000,
});

(terminal as unknown as InterfaceWithHistory).history =
  application.getCliReadlineHistory();

terminal.prompt();

terminal.on("line", async (line) => {
  const output = await application.executeLine(line.trim());

  if (output) {
    stdout.write(`${output}\n`);
  }

  terminal.setPrompt(application.getPrompt());
  terminal.prompt();
});

interface InterfaceWithHistory {
  history: string[];
}
