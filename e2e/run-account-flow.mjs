#!/usr/bin/env node
import { createServer } from "node:net";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(new URL(".", import.meta.url)));

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
    server.on("error", reject);
  });
}

const port = await freePort();
if (!Number.isInteger(port) || port < 1) {
  throw new Error("Could not reserve a free loopback port for account-flow acceptance");
}
const origin = `http://127.0.0.1:${port}`;
const scratch = join(ROOT, `.scratch/account-closeout/flows/${Date.now()}-${process.pid}`);
mkdirSync(scratch, { recursive: true });
writeFileSync(
  join(scratch, "account-flow-port.json"),
  `${JSON.stringify({ port, origin }, null, 2)}\n`,
);

const child = spawn(
  "pnpm",
  ["exec", "playwright", "test", "--config", "e2e/account-flow.config.ts"],
  {
    cwd: ROOT,
    env: {
      ...process.env,
      ACCOUNT_FLOW_ORIGIN: origin,
      ACCOUNT_FLOW_OUTPUT_DIR: join(scratch, "results"),
    },
    stdio: "inherit",
  },
);
console.log(`Account-flow evidence: ${scratch}`);
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
