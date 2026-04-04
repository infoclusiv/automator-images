import { copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const buildFile = resolve(rootDir, ".vite-flow-build", "flowContentScript.js");
const targetFile = resolve(rootDir, "flowContentScript.js");

await copyFile(buildFile, targetFile);
console.log("Copied build output to flowContentScript.js");