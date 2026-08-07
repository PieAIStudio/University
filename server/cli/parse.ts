import { parseArgs } from "node:util";

import { CliUsageError, type UniversityLocalCliCommand } from "./commands.js";

type ParsedValues = {
  readonly study?: string;
  readonly input?: string;
  readonly analysis?: string;
  readonly snapshot?: string;
  readonly course?: string;
  readonly requires?: string;
  readonly ref?: string;
  readonly host?: string;
  readonly objective?: string;
  readonly session?: string;
  readonly confirm?: string;
  readonly from?: string;
  readonly reason?: string;
  readonly "superseded-by"?: string;
  readonly "dry-run"?: boolean;
  readonly apply?: boolean;
  readonly force?: boolean;
  readonly "acknowledge-dirty-excluded"?: boolean;
  readonly takeover?: boolean;
  readonly title?: string;
  readonly source?: string;
  readonly airlock?: string;
  readonly upstream?: string;
  readonly limit?: string;
  readonly goal?: string;
  readonly help?: boolean;
};

function required(value: string | undefined, option: string): string {
  if (!value) throw new CliUsageError(`Missing required option: --${option}`);
  return value;
}

function rejectUnrelatedOptions(
  values: ParsedValues,
  allowed: readonly (keyof ParsedValues)[],
): void {
  const permitted = new Set<keyof ParsedValues>([...allowed, "help"]);
  for (const [key, value] of Object.entries(values) as Array<
    [keyof ParsedValues, string | boolean | undefined]
  >) {
    if (value !== undefined && !permitted.has(key)) {
      throw new CliUsageError(`Option --${key} does not belong to this command`);
    }
  }
}

export function parseUniversityLocalCli(argv: readonly string[]): UniversityLocalCliCommand {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: true,
      options: {
        study: { type: "string" },
        input: { type: "string" },
        analysis: { type: "string" },
        snapshot: { type: "string" },
        course: { type: "string" },
        requires: { type: "string" },
        ref: { type: "string" },
        host: { type: "string" },
        objective: { type: "string" },
        session: { type: "string" },
        confirm: { type: "string" },
        from: { type: "string" },
        reason: { type: "string" },
        "superseded-by": { type: "string" },
        "dry-run": { type: "boolean" },
        apply: { type: "boolean" },
        force: { type: "boolean" },
        "acknowledge-dirty-excluded": { type: "boolean" },
        takeover: { type: "boolean" },
        title: { type: "string" },
        source: { type: "string" },
        airlock: { type: "string" },
        upstream: { type: "string" },
        limit: { type: "string" },
        goal: { type: "string" },
        help: { type: "boolean" },
      },
    });
  } catch (error) {
    throw new CliUsageError(error instanceof Error ? error.message : String(error));
  }
  const values = parsed.values as ParsedValues;
  const positionals = parsed.positionals;
  if (values.help) return { kind: "help" };

  if (positionals.length === 1 && positionals[0] === "status") {
    rejectUnrelatedOptions(values, ["study"]);
    return { kind: "status", studyId: required(values.study, "study") };
  }
  if (positionals.length === 1 && positionals[0] === "capture") {
    rejectUnrelatedOptions(values, ["study", "input", "dry-run"]);
    return {
      kind: "capture",
      studyId: required(values.study, "study"),
      inputPath: required(values.input, "input"),
      dryRun: values["dry-run"] ?? false,
    };
  }
  if (positionals.length === 2 && positionals[0] === "knowledge" && positionals[1] === "list") {
    rejectUnrelatedOptions(values, ["study"]);
    return { kind: "knowledge-list", studyId: required(values.study, "study") };
  }
  if (positionals.length === 2 && positionals[0] === "refresh") {
    if (positionals[1] === "prepare") {
      rejectUnrelatedOptions(values, ["study", "ref", "acknowledge-dirty-excluded", "takeover"]);
      return {
        kind: "refresh-prepare",
        studyId: required(values.study, "study"),
        ...(values.ref ? { reference: values.ref } : {}),
        acknowledgeDirtyExcluded: values["acknowledge-dirty-excluded"] ?? false,
        ...(values.takeover ? { takeover: true } : {}),
      };
    }
    if (positionals[1] === "finalize") {
      rejectUnrelatedOptions(values, ["study", "analysis"]);
      return {
        kind: "refresh-finalize",
        studyId: required(values.study, "study"),
        analysisId: required(values.analysis, "analysis"),
      };
    }
    if (positionals[1] === "verify") {
      rejectUnrelatedOptions(values, ["study", "analysis"]);
      return {
        kind: "refresh-verify",
        studyId: required(values.study, "study"),
        analysisId: required(values.analysis, "analysis"),
      };
    }
    if (positionals[1] === "retire") {
      rejectUnrelatedOptions(values, ["study", "analysis", "reason", "superseded-by", "force"]);
      return {
        kind: "refresh-retire",
        studyId: required(values.study, "study"),
        analysisId: required(values.analysis, "analysis"),
        reason: required(values.reason, "reason"),
        ...(values["superseded-by"] ? { supersededBy: values["superseded-by"] } : {}),
        force: values.force ?? false,
      };
    }
    if (positionals[1] === "audit") {
      rejectUnrelatedOptions(values, ["study", "snapshot", "analysis", "apply"]);
      return {
        kind: "refresh-audit",
        studyId: required(values.study, "study"),
        snapshotId: required(values.snapshot, "snapshot"),
        ...(values.analysis ? { analysisId: values.analysis } : {}),
        apply: values.apply ?? false,
      };
    }
  }
  if (positionals.length === 2 && positionals[0] === "course") {
    if (positionals[1] === "create") {
      rejectUnrelatedOptions(values, ["study", "input", "dry-run"]);
      return {
        kind: "course-create",
        studyId: required(values.study, "study"),
        inputPath: required(values.input, "input"),
        dryRun: values["dry-run"] ?? false,
      };
    }
    if (positionals[1] === "revise") {
      rejectUnrelatedOptions(values, ["study", "input", "dry-run"]);
      return {
        kind: "course-revise",
        studyId: required(values.study, "study"),
        inputPath: required(values.input, "input"),
        dryRun: values["dry-run"] ?? false,
      };
    }
    if (positionals[1] === "reactivate") {
      rejectUnrelatedOptions(values, ["study", "course", "snapshot", "analysis"]);
      return {
        kind: "course-reactivate",
        studyId: required(values.study, "study"),
        courseId: required(values.course, "course"),
        snapshotId: required(values.snapshot, "snapshot"),
        ...(values.analysis ? { analysisId: values.analysis } : {}),
      };
    }
    if (positionals[1] === "set-default") {
      rejectUnrelatedOptions(values, ["study", "course"]);
      return {
        kind: "course-set-default",
        studyId: required(values.study, "study"),
        courseId: required(values.course, "course"),
      };
    }
    if (positionals[1] === "pin" || positionals[1] === "follow") {
      rejectUnrelatedOptions(values, ["study", "course"]);
      return {
        kind: positionals[1] === "pin" ? "course-pin" : "course-follow",
        studyId: required(values.study, "study"),
        courseId: required(values.course, "course"),
      };
    }
    if (positionals[1] === "set-prerequisites") {
      rejectUnrelatedOptions(values, ["study", "course", "requires"]);
      // Comma-separated, same convention as `focus set --course`. Omitting
      // --requires clears the list — the course becomes a fresh starting point.
      const prerequisiteCourseIds = (values.requires ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      return {
        kind: "course-set-prerequisites",
        studyId: required(values.study, "study"),
        courseId: required(values.course, "course"),
        prerequisiteCourseIds,
      };
    }
    if (positionals[1] === "open-for-edit") {
      rejectUnrelatedOptions(values, ["study", "course"]);
      return {
        kind: "course-open-for-edit",
        studyId: required(values.study, "study"),
        courseId: required(values.course, "course"),
      };
    }
    if (positionals[1] === "add-lessons") {
      rejectUnrelatedOptions(values, ["study", "input", "dry-run"]);
      return {
        kind: "course-add-lessons",
        studyId: required(values.study, "study"),
        inputPath: required(values.input, "input"),
        dryRun: values["dry-run"] ?? false,
      };
    }
  }
  if (positionals.length === 2 && positionals[0] === "focus") {
    if (positionals[1] === "set") {
      rejectUnrelatedOptions(values, ["study", "course"]);
      // Comma-separated because a focus is a run in order, and typing the run
      // out is the whole point: the learner is saying "these, in this order".
      const courseIds = (values.course ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      return { kind: "focus-set", studyId: required(values.study, "study"), courseIds };
    }
    if (positionals[1] === "show") {
      rejectUnrelatedOptions(values, []);
      return { kind: "focus-show" };
    }
    if (positionals[1] === "clear") {
      rejectUnrelatedOptions(values, []);
      return { kind: "focus-clear" };
    }
  }
  if (positionals.length === 2 && positionals[0] === "session") {
    if (positionals[1] === "start") {
      rejectUnrelatedOptions(values, ["study", "host", "objective"]);
      return {
        kind: "session-start",
        studyId: required(values.study, "study"),
        host: required(values.host, "host"),
        objective: required(values.objective, "objective"),
      };
    }
    if (positionals[1] === "status") {
      rejectUnrelatedOptions(values, ["study"]);
      return { kind: "session-status", studyId: required(values.study, "study") };
    }
    if (positionals[1] === "end") {
      rejectUnrelatedOptions(values, ["study", "session"]);
      return {
        kind: "session-end",
        studyId: required(values.study, "study"),
        ...(values.session ? { sessionId: values.session } : {}),
      };
    }
  }
  if (
    positionals.length === 2 &&
    positionals[0] === "exercise" &&
    positionals[1] === "host-grade"
  ) {
    rejectUnrelatedOptions(values, ["study", "input"]);
    return {
      kind: "exercise-host-grade",
      studyId: required(values.study, "study"),
      inputPath: required(values.input, "input"),
    };
  }
  if (
    positionals.length === 2 &&
    positionals[0] === "study" &&
    (positionals[1] === "archive" || positionals[1] === "unarchive")
  ) {
    rejectUnrelatedOptions(values, ["study"]);
    return {
      kind: positionals[1] === "archive" ? "study-archive" : "study-unarchive",
      studyId: required(values.study, "study"),
    };
  }
  if (positionals.length === 2 && positionals[0] === "study" && positionals[1] === "create") {
    rejectUnrelatedOptions(values, ["study", "title", "source", "ref"]);
    return {
      kind: "study-create",
      studyId: required(values.study, "study"),
      title: required(values.title, "title"),
      sourceRoot: required(values.source, "source"),
      ...(values.ref ? { reference: values.ref } : {}),
    };
  }
  if (positionals.length === 2 && positionals[0] === "airlock") {
    if (positionals[1] === "promote") {
      rejectUnrelatedOptions(values, ["airlock", "upstream", "ref", "acknowledge-dirty-excluded"]);
      return {
        kind: "airlock-promote",
        airlockRoot: required(values.airlock, "airlock"),
        upstreamRoot: required(values.upstream, "upstream"),
        ...(values.ref ? { reference: values.ref } : {}),
        ...(values["acknowledge-dirty-excluded"] ? { acknowledgeDirtyExcluded: true } : {}),
      };
    }
    if (positionals[1] === "doctor" || positionals[1] === "status") {
      rejectUnrelatedOptions(values, ["airlock", "study"]);
      return {
        kind: positionals[1] === "doctor" ? "airlock-doctor" : "airlock-status",
        airlockRoot: required(values.airlock, "airlock"),
        ...(values.study ? { studyId: values.study } : {}),
      };
    }
  }
  if (positionals.length === 2 && positionals[0] === "language" && positionals[1] === "annotate") {
    rejectUnrelatedOptions(values, ["study", "input"]);
    return {
      kind: "language-annotate",
      studyId: required(values.study, "study"),
      inputPath: required(values.input, "input"),
    };
  }
  if (positionals.length === 2 && positionals[0] === "express" && positionals[1] === "review") {
    rejectUnrelatedOptions(values, ["study", "limit", "goal"]);
    const limit = values.limit === undefined ? undefined : Number(values.limit);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      throw new CliUsageError("--limit must be a positive whole number");
    }
    return {
      kind: "express-review",
      studyId: required(values.study, "study"),
      ...(limit === undefined ? {} : { limit }),
      ...(values.goal ? { goal: values.goal } : {}),
    };
  }
  if (positionals.length === 2 && positionals[0] === "learner") {
    if (positionals[1] === "backup") {
      rejectUnrelatedOptions(values, ["study"]);
      return { kind: "learner-backup", studyId: required(values.study, "study") };
    }
    if (positionals[1] === "reset") {
      rejectUnrelatedOptions(values, ["study", "confirm"]);
      return {
        kind: "learner-reset",
        studyId: required(values.study, "study"),
        confirmStudyId: required(values.confirm, "confirm"),
      };
    }
    if (positionals[1] === "restore") {
      rejectUnrelatedOptions(values, ["study", "from"]);
      return {
        kind: "learner-restore",
        studyId: required(values.study, "study"),
        fromPath: required(values.from, "from"),
      };
    }
  }
  throw new CliUsageError("Unknown command or unexpected positional argument");
}
