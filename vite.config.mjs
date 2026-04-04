import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: resolve(__dirname, ".vite-flow-build"),
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    target: "es2020",
    reportCompressedSize: false,
    lib: {
      entry: resolve(__dirname, "src/content/index.js"),
      name: "FlowContentScript",
      formats: ["iife"],
      fileName: () => "flowContentScript.js",
    },
  },
});
