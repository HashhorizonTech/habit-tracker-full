import { readFileSync } from "node:fs";

// src/lib and dist/lib are both two levels below package.json.
const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };

export const APP_VERSION = pkg.version;
