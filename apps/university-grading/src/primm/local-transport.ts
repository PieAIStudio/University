import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChatCompletionTransport } from "@pieai/swimmer-ai-kit/chat";
import { PreviewFailure } from "./errors.js";
import type { BoundedTranscriber } from "./runtime.js";

export const PREVIEW_MODEL = "university-primm-local";

/** Some local weights emit a tagged reasoning prelude even with the instruct
 * renderer. Never show it, grade it, or promote a thinking-only result to output. */
export function finalCompletionText(content: string): string {
  const text = content
    .trim()
    .replace(/^<think>[\s\S]*?<\/think>\s*/i, "")
    .trim();
  if (!text || /<\/?think>/i.test(text)) throw new PreviewFailure("unavailable", 503);
  return text;
}

/** Local host tools, supplied through AI Kit's transport/generator extension points.
 * This module is never part of the browser/public grading handler. */
export async function runLocalTool(
  command: string,
  args: string[],
  input: string,
  signal: AbortSignal,
  cwd?: string,
): Promise<string> {
  if (signal.aborted) throw new PreviewFailure("cancelled", 499);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      detached: true,
      shell: false,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        LANG: "en_US.UTF-8",
        OLLAMA_HOST: "127.0.0.1:11434",
        OLLAMA_NOHISTORY: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let text = "",
      errorBytes = 0,
      failure: PreviewFailure | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      try {
        if (child.pid) process.kill(-child.pid, "SIGTERM");
      } catch {
        /* Already exited. */
      }
      killTimer = setTimeout(() => {
        try {
          if (child.pid) process.kill(-child.pid, "SIGKILL");
        } catch {
          /* Already exited. */
        }
      }, 1000);
      killTimer.unref();
    };
    const abort = () => {
      failure = new PreviewFailure("cancelled", 499);
      stop();
    };
    signal.addEventListener("abort", abort, { once: true });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      text += chunk;
      if (Buffer.byteLength(text) > 32 * 1024) {
        failure = new PreviewFailure("rejected");
        stop();
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      errorBytes += chunk.length;
      if (errorBytes > 2 * 1024 * 1024) {
        failure = new PreviewFailure("unavailable", 503);
        stop();
      }
    });
    child.on("error", () => {
      signal.removeEventListener("abort", abort);
      reject(new PreviewFailure("unavailable", 503));
    });
    child.on("close", (code) => {
      clearTimeout(killTimer);
      signal.removeEventListener("abort", abort);
      if (failure) reject(failure);
      else if (code !== 0 || !text.trim()) reject(new PreviewFailure("unavailable", 503));
      else resolve(text.trim());
    });
    child.stdin.on("error", () => {
      /* A cancelled child can close its input first. */
    });
    child.stdin.end(input);
  });
}

/** Host-local implementation of AI Kit's transport seam. The Ollama HTTP API
 * accepts explicit roles and base64 images, so learner text is never parsed as
 * a local filename by a CLI. No tools or remote URL loading are offered.
 * Protocol: https://docs.ollama.com/api/chat and /capabilities/vision. */
export function createLocalOllamaTransport(
  options: { fetchImpl?: typeof fetch; model?: string } = {},
): ChatCompletionTransport {
  const model = options.model ?? PREVIEW_MODEL;
  if (model !== PREVIEW_MODEL)
    throw new Error("The preview only uses its explicitly prepared local model");
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    provider: "local-ollama",
    async complete(request) {
      const signal = request.signal ?? AbortSignal.timeout(110_000);
      let imageCount = 0;
      const messages = request.messages.map((message) => {
        if (typeof message.content === "string")
          return { role: message.role, content: message.content };
        const texts: string[] = [],
          images: string[] = [];
        for (const part of message.content) {
          if (part.type === "text") texts.push(part.text);
          else {
            const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(part.url);
            if (!match || ++imageCount > 2) throw new PreviewFailure("rejected");
            const bytes = Buffer.from(match[2]!, "base64");
            if (!bytes.length || bytes.length > 5 * 1024 * 1024)
              throw new PreviewFailure("rejected");
            images.push(match[2]!);
          }
        }
        return {
          role: message.role,
          content: texts.join("\n"),
          ...(images.length ? { images } : {}),
        };
      });
      if (
        messages.reduce((sum, message) => sum + Buffer.byteLength(message.content), 0) >
        64 * 1024
      )
        throw new PreviewFailure("rejected");
      const response = await fetchImpl("http://127.0.0.1:11434/api/chat", {
        method: "POST",
        redirect: "error",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          think: false,
          keep_alive: "5m",
          options: {
            num_ctx: 8192,
            num_predict: Math.min(request.maxTokens ?? 1200, 1600),
            temperature: request.temperature ?? (request.responseFormat ? 0 : 0.2),
          },
          ...(request.responseFormat?.type === "json_object" ? { format: "json" } : {}),
        }),
      });
      if (!response.ok || !response.body) throw new PreviewFailure("unavailable", 503);
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.length;
          if (size > 128 * 1024) throw new PreviewFailure("rejected");
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel();
      }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (
        data.done !== true ||
        data.done_reason === "length" ||
        data.message?.tool_calls?.length ||
        typeof data.message?.content !== "string" ||
        !data.message.content.trim()
      )
        throw new PreviewFailure("unavailable", 503);
      return {
        content: finalCompletionText(data.message.content),
        raw: { provider: "local-ollama", model, executed: true },
        usage: { inputTokens: data.prompt_eval_count, outputTokens: data.eval_count },
      };
    },
  };
}

export function createLocalWhisperTranscriber(options: {
  python: string;
  script: string;
  modelsRoot: string;
}): BoundedTranscriber {
  return {
    async transcribe({ asset, signal }) {
      if (asset.mime !== "audio/wav" || asset.bytes.length > 2 * 1024 * 1024)
        throw new PreviewFailure("rejected");
      const root = await mkdtemp(join(tmpdir(), "university-asr-"));
      try {
        const file = join(root, "approved.wav");
        await writeFile(file, asset.bytes, { flag: "wx", mode: 0o600 });
        const raw = await runLocalTool(
          options.python,
          [options.script, "--audio", file, "--models-root", options.modelsRoot],
          "",
          signal,
          root,
        );
        const result: unknown = JSON.parse(raw);
        if (
          !result ||
          typeof result !== "object" ||
          !("text" in result) ||
          typeof result.text !== "string" ||
          !result.text.trim()
        )
          throw new PreviewFailure("unavailable", 503);
        return { text: result.text, model: "Whisper tiny.en (local)" };
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  };
}
