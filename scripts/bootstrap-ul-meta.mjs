/**
 * Register the out-of-tree SpecialStudies curriculum as study `ul-meta`
 * and create Course A (four-layer-workbench) if missing.
 *
 * Source: /Users/yuanfei/PieAI/UniversityLocal-SpecialStudies
 * Usage: node scripts/bootstrap-ul-meta.mjs
 * Requires: pnpm exec tsc -p tsconfig.server.build.json first.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { loadUniversityLocalConfig } from "../.university-local-build/server/config/load-config.js";
import { SqliteLearningStore } from "../.university-local-build/server/learning/sqlite-learning-store.js";
import { getStudyPaths, getCoursePaths } from "../.university-local-build/server/studies/paths.js";
import {
  createStudy,
  readStudy,
  registerLocalGitSource,
  setDefaultCourse,
} from "../.university-local-build/server/studies/repository.js";
import { createCleanSnapshot } from "../.university-local-build/server/studies/snapshots.js";
import { createCourse } from "../.university-local-build/server/workflows/create-course.js";

const projectRoot = resolve(import.meta.dirname, "..");
const sourceRoot = "/Users/yuanfei/PieAI/UniversityLocal-SpecialStudies";
const studyId = "ul-meta";
const courseId = "four-layer-workbench";

const config = loadUniversityLocalConfig({ projectRoot });
const paths = getStudyPaths(config.studiesRoot, studyId);

const study = existsSync(paths.manifest)
  ? readStudy(config.studiesRoot, studyId)
  : createStudy(config.studiesRoot, {
      id: studyId,
      title: "UniversityLocal 元学习",
      description:
        "学这所私人大学本身：AI 宿主与胶水层、Web 题册边界、以及如何用宿主答疑桥学习。教材源在仓外 SpecialStudies。",
      goals: [
        "分清宿主、胶水、产品、凭证四层",
        "会用宿主无关的答疑包向任意 AI 助手请教",
        "理解学自己时为何教材要在仓外",
      ],
    });

if (!existsSync(paths.source.registration)) {
  registerLocalGitSource(config.studiesRoot, studyId, sourceRoot);
}

const snapshot = createCleanSnapshot(config.studiesRoot, studyId, "HEAD");
const store = new SqliteLearningStore(paths.learner.database);
store.close();

if (existsSync(getCoursePaths(config.studiesRoot, studyId, courseId).manifest)) {
  const current = setDefaultCourse(config.studiesRoot, studyId, courseId);
  console.log(
    JSON.stringify(
      {
        ok: true,
        skipped: "course-exists",
        studyId,
        courseId,
        defaultCourseId: current.defaultCourseId,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const lessonRel =
  "curriculum/course-a-four-layer-workbench/lessons/01-four-layers-names-and-auth.md";
const lessonContent = readFileSync(resolve(sourceRoot, lessonRel), "utf8");
const snapId = snapshot.id;
const commit = snapshot.sourceCommit;

const evidenceBase = {
  kind: "fact",
  snapshotId: snapId,
  sourceCommit: commit,
  sourcePath: lessonRel,
  lineStart: 1,
  lineEnd: 40,
  nodeIds: [],
};

const proposal = {
  schemaVersion: 1,
  proposalId: "create-four-layer-workbench-v1",
  targetSnapshotId: snapId,
  course: {
    id: courseId,
    title: "AI 时代的四层工作台",
    description:
      "宿主、胶水、UniversityLocal、凭证如何分工；为何 Web 题册与 AI 宿主教学不是同一条接线。证据来自仓外元学习教材厂。",
    audience: "使用 UniversityLocal + 多 AI 宿主的独立开发者",
    objectives: [
      "用四层图说明宿主、胶水、产品、凭证各管什么",
      "把 Grok Build、pi、Mastra、UniversityLocal 放进正确的层",
      "说明 short-answer 程序判分与宿主讲解的分工",
      "会使用宿主无关的答疑包三步粘贴法",
    ],
    units: [
      {
        id: "layering-and-names",
        title: "分层与名词",
        objective: "建立 AI 工作台四层心智模型，并会用答疑包向任意宿主请教",
        lessons: [
          {
            id: "four-layers-names-and-auth",
            title: "四层、名词与凭证",
            content: lessonContent,
            evidence: [
              { ...evidenceBase, note: "第 1 课正文：四层与名词（教材厂）" },
              {
                kind: "fact",
                snapshotId: snapId,
                sourceCommit: commit,
                sourcePath: "README.md",
                lineStart: 1,
                lineEnd: 15,
                nodeIds: [],
                note: "教材厂定位：仓外、非 studies 成绩柜",
              },
            ],
            cards: [
              {
                id: "host-vs-glue",
                front: "AI 宿主和胶水框架（如 Mastra）差在哪里？各举一例。",
                back: "宿主给人用（对话、改代码），如 Grok Build、pi；胶水给应用代码编排 agent，如 Mastra。",
                tags: ["four-layers"],
                evidence: [{ ...evidenceBase, lineStart: 20, lineEnd: 55, note: "四层表与名词" }],
              },
              {
                id: "packet-not-grade",
                front: "提交练习后复制的「答疑包」是用来让 AI 判分的吗？",
                back: "不是。对错由 Web 程序判定；答疑包给任意 AI 宿主做讲解与巩固。",
                tags: ["b1a"],
                evidence: [
                  {
                    kind: "fact",
                    snapshotId: snapId,
                    sourceCommit: commit,
                    sourcePath: "templates/exercise-coaching-packet.example.md",
                    lineStart: 1,
                    lineEnd: 20,
                    nodeIds: [],
                    note: "答疑包样例",
                  },
                ],
              },
            ],
            exercises: [
              {
                id: "name-the-host-layer",
                title: "哪一层是宿主",
                prompt:
                  "Grok Build、Claude Code、pi 属于哪一层？只写两个字：宿主 或 胶水 或 产品。",
                expectedAnswer: "宿主",
                evidence: [{ ...evidenceBase, lineStart: 45, lineEnd: 70, note: "名词" }],
              },
              {
                id: "packet-steps-count",
                title: "答疑包几步",
                prompt:
                  "复制答疑包后，初学者要做的固定步骤有几步？（打开助手、新开对话、粘贴发送）只写数字。",
                expectedAnswer: "3",
                evidence: [
                  {
                    kind: "fact",
                    snapshotId: snapId,
                    sourceCommit: commit,
                    sourcePath: "templates/exercise-coaching-packet.example.md",
                    lineStart: 40,
                    lineEnd: 47,
                    nodeIds: [],
                    note: "三步",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

mkdirSync(resolve(projectRoot, ".scratch/courses"), { recursive: true });
writeFileSync(
  resolve(projectRoot, ".scratch/courses/four-layer-workbench.json"),
  JSON.stringify(proposal, null, 2),
);

const result = createCourse({
  studiesRoot: config.studiesRoot,
  studyId,
  proposal,
});
const withDefault = setDefaultCourse(config.studiesRoot, studyId, courseId);

console.log(
  JSON.stringify(
    {
      ok: true,
      study: withDefault,
      snapshot: { id: snapId, sourceCommit: commit },
      course: result,
    },
    null,
    2,
  ),
);
