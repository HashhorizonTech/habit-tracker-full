import dotenv from "dotenv";
import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";

dotenv.config({ quiet: true });

const env = loadEnv();
const app = await buildApp({ env, logger: { level: process.env.LOG_LEVEL ?? "info" } });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "shutting down");
    void app.close().then(() => process.exit(0));
  });
}

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
