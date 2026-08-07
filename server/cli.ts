import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CourseRevisionPartialError } from "./workflows/revise-course.js";
import { CliUsageError, HELP } from "./cli/commands.js";
import { executeUniversityLocalCli } from "./cli/execute.js";
import { parseUniversityLocalCli } from "./cli/parse.js";

export { CliUsageError, type UniversityLocalCliCommand } from "./cli/commands.js";
export { parseUniversityLocalCli } from "./cli/parse.js";
export { executeUniversityLocalCli, type ExecuteCliInput } from "./cli/execute.js";

export interface CliIo {
  readonly stdout: { write(value: string): unknown };
  readonly stderr: { write(value: string): unknown };
}

export interface MainOptions {
  readonly projectRoot?: string;
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly io?: CliIo;
}

export async function main(
  argv = process.argv.slice(2),
  options: MainOptions = {},
): Promise<number> {
  const io = options.io ?? process;
  try {
    const command = parseUniversityLocalCli(argv);
    if (command.kind === "help") {
      io.stdout.write(HELP);
      return 0;
    }
    const projectRoot =
      options.projectRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const result = await executeUniversityLocalCli({
      command,
      projectRoot,
      cwd: options.cwd,
      env: options.env,
    });
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (
      command.kind === "refresh-verify" &&
      result !== null &&
      typeof result === "object" &&
      "failures" in result &&
      Array.isArray((result as { failures: unknown }).failures) &&
      (result as { failures: unknown[] }).failures.length > 0
    ) {
      return 1;
    }
    return 0;
  } catch (error) {
    const usage = error instanceof CliUsageError;
    const message = error instanceof Error ? error.message : String(error);
    const busy = /\b(?:busy|locked)\b/i.test(message);
    io.stderr.write(
      `${JSON.stringify(
        {
          ok: false,
          error: message,
          ...(error instanceof CourseRevisionPartialError
            ? {
                retry: {
                  required: true,
                  proposalId: error.receipt.proposalId,
                  receipt: error.receipt,
                },
              }
            : {}),
          hint: usage
            ? "Run this command with --help to see valid UniversityLocal commands."
            : busy
              ? "Stop the UniversityLocal local server and any other process using learning.sqlite, then retry."
              : "The operation was stopped safely; inspect the message, fix the input, and retry.",
        },
        null,
        2,
      )}\n`,
    );
    return usage ? 2 : 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
