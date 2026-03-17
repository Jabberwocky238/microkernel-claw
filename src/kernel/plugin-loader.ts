import { Plugin } from "./plugin.js";

export type PluginClass = new () => Plugin;

export class PluginLoader {
  public async loadFromImport(modulePath: string): Promise<Plugin> {
    const imported = (await import(modulePath)) as {
      default?: PluginClass;
    };

    if (!imported.default) {
      throw new TypeError("Plugin module must provide a default export.");
    }

    return new imported.default();
  }
  public async loadFromLocal(modulePath: string): Promise<Plugin> {
    const imported = (await import(modulePath)) as {
      default?: PluginClass;
    };

    if (!imported.default) {
      throw new TypeError("Plugin module must provide a default export.");
    }

    return new imported.default();
  }
  public async loadFromURL(url: string): Promise<Plugin> {
    const downloadedBlob = await fetch(url).then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to download plugin from ${url}: ${res.statusText}`);
      }
      return res.blob();
    });
    const blobUrl = URL.createObjectURL(downloadedBlob);
    const imported = (await import(blobUrl)) as {
      default?: PluginClass;
    };

    if (!imported.default) {
      throw new TypeError("Plugin module must provide a default export.");
    }

    return new imported.default();
  }
}
