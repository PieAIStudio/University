/**
 * What a promotion refuses to carry into the airlock.
 *
 * This is a safety net, not the main defence. The main defence is that these
 * paths are gitignored and so cannot be tracked in the first place. But
 * `.gitignore` only governs files Git is not yet tracking — a `git add -f`, or
 * a file committed before the ignore rule existed, stays tracked forever. Sol's
 * review named this exact hole: relying on the ignore file alone would mean a
 * learner database or a private key could reach an analysis run.
 *
 * So the gate reads the tree that is actually about to be promoted and refuses
 * on what it finds there. Refusing is the whole behaviour: there is no "skip
 * it and carry on", because a repository that really does track a secret is a
 * problem the owner has to see, not one a tool should route around.
 */

export interface ImportCandidate {
  readonly path: string;
  readonly sizeBytes: number | null;
}

export interface ImportGateReport {
  readonly trackedFileCount: number;
  readonly largestBlobBytes: number;
  readonly blocked: readonly ImportGateFinding[];
}

export interface ImportGateFinding {
  readonly path: string;
  readonly reason: string;
}

/**
 * A blob this large is not source anybody studies; it is a build artefact, a
 * media file, or a database that got committed. Analysing it costs time and
 * teaches nothing, and its presence is worth surfacing on its own.
 */
export const MAX_IMPORT_BLOB_BYTES = 5 * 1024 * 1024;

interface DenyRule {
  readonly test: RegExp;
  readonly reason: string;
}

const DENY_RULES: readonly DenyRule[] = [
  {
    test: /(^|\/)studies\//,
    reason: "学习数据（课程进度、复习记录）绝不能进入被分析的源",
  },
  {
    test: /(^|\/)\.env(\.|$)(?!example)/,
    reason: "环境变量文件通常含密钥",
  },
  {
    test: /\.(pem|key|p12|pfx|keystore)$/i,
    reason: "私钥或证书文件",
  },
  {
    test: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/,
    reason: "SSH 私钥",
  },
  {
    test: /\.sqlite(-wal|-shm)?$/i,
    reason: "数据库文件；学习记录就存在这类文件里",
  },
  {
    test: /(^|\/)\.npmrc$/,
    reason: ".npmrc 常含发布令牌",
  },
];

/**
 * Inspects the exact tree a promotion would import.
 *
 * Pure by design: it takes the entries and returns a verdict, so the rules can
 * be tested without a repository and read without following a git invocation.
 */
export function inspectImportRisk(entries: readonly ImportCandidate[]): ImportGateReport {
  const blocked: ImportGateFinding[] = [];
  let largestBlobBytes = 0;

  for (const entry of entries) {
    const size = entry.sizeBytes ?? 0;
    if (size > largestBlobBytes) largestBlobBytes = size;

    const rule = DENY_RULES.find((candidate) => candidate.test.test(entry.path));
    if (rule) {
      blocked.push({ path: entry.path, reason: rule.reason });
      continue;
    }
    if (size > MAX_IMPORT_BLOB_BYTES) {
      blocked.push({
        path: entry.path,
        reason: `单个文件超过 ${Math.round(MAX_IMPORT_BLOB_BYTES / 1024 / 1024)}MB 导入上限`,
      });
    }
  }

  return {
    trackedFileCount: entries.length,
    largestBlobBytes,
    blocked: blocked.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export function describeImportRefusal(report: ImportGateReport): string {
  const shown = report.blocked.slice(0, 10);
  const lines = shown.map((finding) => `  - ${finding.path} —— ${finding.reason}`);
  if (report.blocked.length > shown.length) {
    lines.push(`  - …还有 ${report.blocked.length - shown.length} 个`);
  }
  return [
    "这次提升被拒绝：被学项目里跟踪着不该进入分析的文件。",
    ...lines,
    "",
    "这些文件已经被 Git 跟踪，`.gitignore` 对它们无效。请先把它们从跟踪中移除",
    "（`git rm --cached <路径>` 并提交），再重新提升。",
  ].join("\n");
}
