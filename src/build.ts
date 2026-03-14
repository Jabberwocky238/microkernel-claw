declare const Bun: {
  build(options: {
    entrypoints: string[];
    outdir: string;
    target: string;
    format: string;
    sourcemap: string;
    naming: {
      entry: string;
    };
  }): Promise<unknown>;
};

export {};

await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "dist",
  target: "bun",
  format: "esm",
  sourcemap: "external",
  naming: {
    entry: "[dir]/[name].js",
  },
});
