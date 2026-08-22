#!/usr/bin/env node
/**
 * One command that opens the university.
 *
 * There are two shells and they answer different questions — 「我自己学」 and
 * 「这个产品怎么样」 — so the honest launcher starts both and says which is
 * which. Before this, `pnpm dev` started only the delivery shell, the README's
 * quick start named only that command, and the authoring shell was reachable
 * exclusively by knowing a pnpm filter by heart. The person who owns the
 * product could not open half of it without reading the source.
 *
 * It also builds the delivery shell's content when it is missing. A fresh
 * clone has no `apps/online/content`, and the failure that produces is an
 * empty archipelago rather than an error, which reads as a broken product
 * rather than a missing step.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

const SHELLS = [
  {
    name: "在线端",
    purpose: "试用、提意见 — 3D 世界、关卡、复习",
    url: "http://localhost:9998",
    filter: "@pieai/university-online",
    script: "dev",
  },
  {
    name: "本地端",
    purpose: "自己学习、写课 — 文件系统、剪贴板判分",
    url: "http://localhost:9999",
    filter: "@pieai/university-local",
    script: "dev",
  },
];

/**
 * `detached` so each shell gets its own process group, and stopping means
 * signalling the group rather than the child.
 *
 * The authoring shell is a chain — pnpm runs tsc, which runs `dev.mjs`, which
 * spawns an API server and Vite. A signal to the pnpm wrapper reaches none of
 * those. Measured: Ctrl-C stopped the delivery shell and left the authoring
 * one holding 9999, so the next `pnpm start` failed on a taken port with an
 * error about something the person had already stopped.
 */
function run(command, args, label) {
  const child = spawn(command, args, { cwd: ROOT, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  const forward = (stream, sink) => {
    stream.setEncoding("utf8");
    let rest = "";
    stream.on("data", (chunk) => {
      const lines = (rest + chunk).split("\n");
      rest = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) sink.write(`${label} ${line}\n`);
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
  return child;
}

async function main() {
  if (!existsSync(join(ROOT, "apps/online/content"))) {
    console.log("· 第一次启动：先把课程内容导进在线端（一次性，约一分钟）");
    await new Promise((resolve, reject) => {
      const build = run("pnpm", ["content"], "[内容]");
      build.unref();
      build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`pnpm content 退出码 ${code}`))));
    });
  }

  const children = SHELLS.map((shell) =>
    run("pnpm", ["--filter", shell.filter, shell.script], `[${shell.name}]`),
  );

  console.log("");
  for (const shell of SHELLS) {
    console.log(`  ${shell.name}  ${shell.url}`);
    console.log(`         ${shell.purpose}`);
  }
  console.log("\n  Ctrl-C 停止两个。\n");

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    for (const child of children) {
      if (child.pid === undefined) continue;
      try {
        process.kill(-child.pid, "SIGINT");
      } catch {
        // Already gone. That is the outcome we wanted anyway.
      }
    }
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  // If either shell dies, say so and take the other down rather than leaving
  // half a university running and a person wondering which half.
  for (const [index, child] of children.entries()) {
    child.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`\n${SHELLS[index].name} 退出了（code ${code}）。另一个也停下。\n`);
      }
      stop();
    });
  }
}

main().catch((error) => {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
});
