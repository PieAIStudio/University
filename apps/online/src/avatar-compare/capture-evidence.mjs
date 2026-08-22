#!/usr/bin/env node
/**
 * Headless evidence for `#/avatar-compare`.
 *
 * Usage (dev server already on :9998):
 *   node apps/online/src/avatar-compare/capture-evidence.mjs
 *
 * Writes PNGs and measurements.json under ./evidence/
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.join(__dirname, "evidence");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ORIGIN = process.env.ORIGIN ?? "http://127.0.0.1:9998";

const PRESETS = [
  { seed: "ak1-bear", species: "bear" },
  { seed: "ak1-bunny", species: "bunny" },
  { seed: "ak1-cat", species: "cat" },
  { seed: "ak1-robot", species: "robot" },
  { seed: "ak1-slime", species: "slime" },
  { seed: "ak1-humanoid", species: "humanoid" },
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function listenFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not bind a debugging port."));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
    server.on("error", reject);
  });
}

async function waitForHttp(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok || response.status === 304) return;
    } catch {
      // server not up yet
    }
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id == null) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? "Runtime.evaluate failed");
    }
    return result.result?.value;
  }
}

function connectWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", () => reject(new Error(`WebSocket error: ${url}`)));
  });
}

function spawnChrome(port, headed) {
  const args = [
    `--remote-debugging-port=${port}`,
    "--remote-debugging-address=127.0.0.1",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--use-angle=metal",
    "--window-size=1600,900",
    "--hide-scrollbars",
    "--disable-gpu-vsync",
    "--disable-frame-rate-limit",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=/tmp/ak1-chrome-${port}`,
    "about:blank",
  ];
  if (!headed) args.unshift("--headless=new");
  const child = spawn(CHROME, args, { stdio: "ignore" });
  return child;
}

async function connectCdp(port) {
  const start = Date.now();
  while (Date.now() - start < 15_000) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (!response.ok) throw new Error(String(response.status));
      const info = await response.json();
      const ws = await connectWs(info.webSocketDebuggerUrl);
      return new Cdp(ws);
    } catch {
      await wait(150);
    }
  }
  throw new Error("Chrome DevTools endpoint never came up.");
}

async function waitForFlag(cdp, flag, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await cdp.evaluate(`document.querySelector("[${flag}='1']") ? "1" : "0"`);
    if (value === "1") return;
    await wait(200);
  }
  throw new Error(`Timed out waiting for ${flag}`);
}

async function snapshotPair(cdp) {
  const shot = await cdp.evaluate(`(function () {
    const oursCanvas = document.querySelector('[data-compare-side="ours"] canvas');
    const kitCanvas = document.querySelector('[data-compare-side="kit"] canvas');
    if (!oursCanvas || !kitCanvas) throw new Error("Missing compare canvases");
    const root = document.querySelector("[data-compare-ready]");
    const w = oursCanvas.width;
    const h = oursCanvas.height;
    if (w !== kitCanvas.width || h !== kitCanvas.height) {
      throw new Error("Canvas sizes differ: " + w + "x" + h + " vs " + kitCanvas.width + "x" + kitCanvas.height);
    }
    function lumaOf(canvas) {
      const scratch = document.createElement("canvas");
      scratch.width = canvas.width;
      scratch.height = canvas.height;
      const ctx = scratch.getContext("2d");
      ctx.drawImage(canvas, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
      return sum / (canvas.width * canvas.height * 3);
    }
    const scratch = document.createElement("canvas");
    scratch.width = w;
    scratch.height = h;
    const ctx = scratch.getContext("2d");
    ctx.drawImage(oursCanvas, 0, 0);
    const oursData = ctx.getImageData(0, 0, w, h).data;
    ctx.drawImage(kitCanvas, 0, 0);
    const kitData = ctx.getImageData(0, 0, w, h).data;
    const diff = ctx.createImageData(w, h);
    let changed = 0;
    let maxDelta = 0;
    let sumSq = 0;
    for (let i = 0; i < oursData.length; i += 4) {
      const dr = Math.abs(oursData[i] - kitData[i]);
      const dg = Math.abs(oursData[i + 1] - kitData[i + 1]);
      const db = Math.abs(oursData[i + 2] - kitData[i + 2]);
      const da = Math.abs(oursData[i + 3] - kitData[i + 3]);
      const d = Math.max(dr, dg, db, da);
      maxDelta = Math.max(maxDelta, d);
      sumSq += dr * dr + dg * dg + db * db;
      if (d > 2) {
        changed += 1;
        diff.data[i] = 255;
        diff.data[i + 1] = 0;
        diff.data[i + 2] = 0;
        diff.data[i + 3] = 255;
      } else {
        const luma = Math.round(oursData[i] * 0.3 + oursData[i + 1] * 0.59 + oursData[i + 2] * 0.11);
        diff.data[i] = luma;
        diff.data[i + 1] = luma;
        diff.data[i + 2] = luma;
        diff.data[i + 3] = 255;
      }
    }
    ctx.putImageData(diff, 0, 0);
    const pair = document.createElement("canvas");
    pair.width = w * 2;
    pair.height = h;
    const pctx = pair.getContext("2d");
    pctx.drawImage(oursCanvas, 0, 0);
    pctx.drawImage(kitCanvas, w, 0);
    pctx.fillStyle = "rgba(20,24,36,0.72)";
    pctx.fillRect(8, 8, 92, 28);
    pctx.fillRect(w + 8, 8, 80, 28);
    pctx.fillStyle = "#e9edf5";
    pctx.font = "16px ui-monospace, monospace";
    pctx.fillText("ours", 18, 28);
    pctx.fillText("kit", w + 18, 28);
    return {
      width: w,
      height: h,
      pixels: w * h,
      changed,
      changedPct: (changed / (w * h)) * 100,
      maxDelta,
      rmse: Math.sqrt(sumSq / (w * h * 3)),
      oursLuma: lumaOf(oursCanvas),
      kitLuma: lumaOf(kitCanvas),
      recipeEqual: root.getAttribute("data-recipe-equal") === "1",
      seed: root.getAttribute("data-seed"),
      species: root.getAttribute("data-species"),
      ours: {
        verts: Number(root.getAttribute("data-ours-verts")),
        buildMs: Number(root.getAttribute("data-ours-build-ms")),
        meshes: Number(root.getAttribute("data-ours-meshes")),
      },
      kit: {
        verts: Number(root.getAttribute("data-kit-verts")),
        buildMs: Number(root.getAttribute("data-kit-build-ms")),
        meshes: Number(root.getAttribute("data-kit-meshes")),
      },
      oursPng: oursCanvas.toDataURL("image/png"),
      kitPng: kitCanvas.toDataURL("image/png"),
      diffPng: scratch.toDataURL("image/png"),
      pairPng: pair.toDataURL("image/png"),
    };
  })()`);
  if (shot.oursLuma < 8 || shot.kitLuma < 8) {
    throw new Error(
      `Canvas capture is too dark (ours luma ${shot.oursLuma.toFixed(1)}, kit luma ${shot.kitLuma.toFixed(1)}). WebGL buffer was empty.`,
    );
  }
  return shot;
}

async function snapshotSolo(cdp, side) {
  return cdp.evaluate(`(function () {
    const root = document.querySelector("[data-compare-ready]");
    return {
      side: ${JSON.stringify(side)},
      seed: root.getAttribute("data-seed"),
      species: root.getAttribute("data-species"),
      verts: Number(root.getAttribute(${JSON.stringify(`data-${side}-verts`)})),
      buildMs: Number(root.getAttribute(${JSON.stringify(`data-${side}-build-ms`)})),
      meshes: Number(root.getAttribute(${JSON.stringify(`data-${side}-meshes`)})),
      frameMs: Number(root.getAttribute(${JSON.stringify(`data-${side}-frame-ms`)})),
    };
  })()`);
}

function pngFromDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(",");
  return Buffer.from(dataUrl.slice(comma + 1), "base64");
}

async function main() {
  await waitForHttp(ORIGIN, 5_000);
  await mkdir(EVIDENCE, { recursive: true });
  const port = await listenFreePort();
  const headed = process.env.HEADED !== "0";
  const chrome = spawnChrome(port, headed);
  const measurements = {
    capturedAt: new Date().toISOString(),
    origin: ORIGIN,
    headed,
    presets: [],
    solo: [],
  };
  try {
    const browser = await connectCdp(port);
    const created = await browser.send("Target.createTarget", { url: "about:blank" });
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) =>
      response.json(),
    );
    const target =
      pages.find((entry) => entry.id === created.targetId) ??
      pages.find((entry) => entry.type === "page");
    if (!target) throw new Error("No Chrome page target.");
    const cdp = new Cdp(await connectWs(target.webSocketDebuggerUrl));
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1600,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    for (const preset of PRESETS) {
      const url = `${ORIGIN}/?ak1=${preset.seed}#/avatar-compare?${new URLSearchParams({
        seed: preset.seed,
        species: preset.species,
        gaze: "0",
        orbit: "0",
      }).toString()}`;
      await cdp.send("Page.navigate", { url });
      await waitForFlag(cdp, "data-compare-ready", 20_000);
      await wait(800);
      const shot = await snapshotPair(cdp);
      const stem = `${preset.species}-${preset.seed}`;
      await writeFile(path.join(EVIDENCE, `${stem}-ours.png`), pngFromDataUrl(shot.oursPng));
      await writeFile(path.join(EVIDENCE, `${stem}-kit.png`), pngFromDataUrl(shot.kitPng));
      await writeFile(path.join(EVIDENCE, `${stem}-diff.png`), pngFromDataUrl(shot.diffPng));
      await writeFile(path.join(EVIDENCE, `${stem}-pair.png`), pngFromDataUrl(shot.pairPng));
      const record = {
        seed: preset.seed,
        species: preset.species,
        recipeEqual: shot.recipeEqual,
        width: shot.width,
        height: shot.height,
        pixels: shot.pixels,
        changed: shot.changed,
        changedPct: shot.changedPct,
        maxDelta: shot.maxDelta,
        rmse: shot.rmse,
        ours: shot.ours,
        kit: shot.kit,
        files: {
          ours: `apps/online/src/avatar-compare/evidence/${stem}-ours.png`,
          kit: `apps/online/src/avatar-compare/evidence/${stem}-kit.png`,
          diff: `apps/online/src/avatar-compare/evidence/${stem}-diff.png`,
          pair: `apps/online/src/avatar-compare/evidence/${stem}-pair.png`,
        },
      };
      measurements.presets.push(record);
      console.log(
        `${preset.species}: verts ours=${shot.ours.verts} kit=${shot.kit.verts} ` +
          `buildMs ours=${shot.ours.buildMs} kit=${shot.kit.buildMs} ` +
          `changed=${shot.changedPct.toFixed(3)}% maxΔ=${shot.maxDelta} rmse=${shot.rmse.toFixed(3)}`,
      );
    }

    for (const side of ["ours", "kit"]) {
      const url = `${ORIGIN}/?ak1=solo-${side}#/avatar-compare?${new URLSearchParams({
        seed: "ak1-bear",
        species: "bear",
        gaze: "0",
        orbit: "0",
        solo: side,
      }).toString()}`;
      await cdp.send("Page.navigate", { url });
      await waitForFlag(cdp, "data-compare-ready", 20_000);
      await waitForFlag(cdp, "data-frames-ready", 20_000);
      const solo = await snapshotSolo(cdp, side);
      measurements.solo.push(solo);
      console.log(
        `solo ${side}: verts=${solo.verts} buildMs=${solo.buildMs} frameMs=${solo.frameMs}`,
      );
    }

    await writeFile(
      path.join(EVIDENCE, "measurements.json"),
      `${JSON.stringify(measurements, null, 2)}\n`,
    );
    console.log(`wrote ${path.join(EVIDENCE, "measurements.json")}`);
  } finally {
    chrome.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
