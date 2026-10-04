import {
  primmBuildVerdict,
  primmRequestPrompt,
  primmSentences,
  primmSentencesMentioning,
} from "@pieai/university-core";

/** The Writer uses the product's existing V3 union, never a parallel step enum. */
export function stepAuthoringShape(PrimmPayloadSchema, z) {
  const native = PrimmPayloadSchema;
  if (!native) throw Error("Native PRIMM step schema is unavailable; build core first");
  return native
    .omit({ method: true, experienceVersion: true, sources: true })
    .extend({
      make: native.shape.make.omit({ exerciseId: true }).required({ artifactLabel: true }),
      finish: native.shape.finish.required({ didYouKnow: true, today: true }),
    })
    .strict();
}

/** These are reviewed authoring metadata, bound to the already-rendered native
 * door/wait/after fields below. They are not new, unread product JSON fields. */
export function realWorldPlanSchema(z) {
  return z
    .array(
      z
        .object({
          placement: z.enum(["door", "wait", "after"]),
          sourceId: z.string().min(1),
          kind: z.enum(["usage", "news", "research", "fact", "repo-code", "web-code"]),
          relatesTo: z.string().min(1).describe("扣住本关带走的话，不写无关趣闻"),
          reviewBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .strict(),
    )
    .length(3);
}

export function isStructuralStepPath(path) {
  return /(^|\.)(?:phase|request|requestId|requestIds|answerId|answers)(?:\.|$)/.test(path);
}

/** Extra teaching constraints supplement, never replace, native primmIssues. */
export function stepTeachingIssues(draft, packet) {
  const a = draft.activity;
  if (!Array.isArray(a?.steps)) return [];
  const issues = [];
  const add = (where, detail) => issues.push({ code: "shape", where, detail });
  if (a.steps.length + 2 < 8 || a.steps.length + 2 > 12)
    add("steps", "A step lesson has 8–12 screens including its door and finish");
  const rounds = a.steps.filter((step) => step.kind === "sort");
  if (rounds.length > 1) add("steps", "At most one small round per lesson");
  for (const step of rounds)
    if (step.cards.length < 3 || step.cards.length > 6)
      add(`steps.${step.id}`, "A small round has 3–6 decisions of the same kind");
  for (const step of a.steps) {
    if (step.kind === "send") {
      if (!step.after?.trim() && !step.debriefs?.length)
        add(`steps.${step.id}`, "A real result must be followed by the teacher's explanation");
      if (step.phase !== "run" && step.wait)
        add(`steps.${step.id}.wait`, "The waiting fact belongs only to the Run send");
    }
    if (step.kind === "choose" && step.phase === "predict" && step.answerId)
      add(`steps.${step.id}.answerId`, "Predict chooses a use; it does not grade a correct answer");
    if (step.kind === "point") {
      const verified = packet.assets.find((asset) => asset.id === step.assetId)?.verifiedFacts;
      if (!verified?.regions?.length)
        add(
          `steps.${step.id}`,
          "Image targets require host-verified regions, not guessed coordinates",
        );
      else
        for (const region of step.regions)
          if (
            !verified.regions.some((known) =>
              ["x", "y", "width", "height"].every((key) => known[key] === region[key]),
            )
          )
            add(
              `steps.${step.id}.${region.id}`,
              "Image coordinates must match the host-verified region exactly",
            );
    }
  }
  const facts = draft.plan?.realWorld ?? [];
  const placements = facts.map((fact) => fact.placement);
  if (facts.length !== 3 || new Set(placements).size !== 3)
    add("plan.realWorld", "Exactly one reviewed source fact at door, wait and after");
  const run = a.steps.find((step) => step.kind === "send" && step.phase === "run");
  const sourceIds = new Set(draft.sources.map((source) => source.id));
  for (const fact of facts) {
    const where = `plan.realWorld.${fact.placement}`;
    const source = packet.library.find((entry) => entry.id === fact.sourceId);
    if (!source || !sourceIds.has(fact.sourceId)) {
      add(where, "Use a selected verified source, not a new URL or an unselected library entry");
      continue;
    }
    if (!source.publisher || !source.supports || !source.accessedOn)
      add(where, "A real-world fact needs publisher, supported claim and inspection date");
    if (
      !source.sourceAuthority ||
      ["news-report", "journalism", "secondary", "community"].includes(source.sourceAuthority)
    )
      add(where, "Use a first-hand source for the lesson's real-world fact");
    if (!fact.relatesTo?.trim()) add(where, "Explain the link to this lesson's takeaway");
    const accessed = new Date(`${source.accessedOn}T00:00:00Z`);
    const due = new Date(`${fact.reviewBy}T00:00:00Z`);
    const today = packet.createdAt.slice(0, 10);
    const maximum = new Date(accessed);
    maximum.setUTCMonth(maximum.getUTCMonth() + (fact.kind === "research" ? 12 : 6));
    if (
      !Number.isFinite(accessed.getTime()) ||
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== fact.reviewBy ||
      fact.reviewBy < today ||
      due > maximum
    )
      add(
        where,
        "Source review date is invalid, expired or beyond its six/twelve-month review window",
      );
    if (fact.placement === "door" && !a.intro.sourceIds?.includes(fact.sourceId))
      add(where, "The door must cite the same source through native intro.sourceIds");
    if (fact.placement === "wait" && run?.wait?.sourceId !== fact.sourceId)
      add(where, "The Run waiting text must cite this fact's source");
    if (fact.placement === "after" && a.finish.didYouKnow?.sourceId !== fact.sourceId)
      add(where, "The finish fact must cite this source");
  }
  if (!a.finish.today?.trim() || !a.finish.didYouKnow?.text?.trim())
    add(
      "finish",
      "Finish needs a takeaway, sourced fact, today's action and the existing review cards",
    );
  return issues;
}

/** Enumerate actual selectable requests with the native resolver; no canned output. */
export function stepSampleRequests(activity) {
  const run = activity.steps.find((step) => step.kind === "send" && step.phase === "run");
  const choice = activity.steps.find((step) => step.kind === "choose" && step.phase === "predict");
  const firstId = run?.request === "chosen" ? choice?.options[0]?.requestId : run?.request;
  if (!firstId) throw Error("No executable Run request");
  const ids = new Set([firstId]);
  if (run.request === "chosen") for (const option of choice.options) ids.add(option.requestId);
  for (const step of activity.steps)
    if (step.kind === "match") for (const id of step.requestIds) ids.add(id);
  return [...ids].map((id) => {
    const prompt = primmRequestPrompt(activity, id);
    if (!prompt) throw Error(`Unknown executable request ${id}`);
    return { id, phase: "run", prompt };
  });
}

export function stepModifyPrompt(activity) {
  const send = activity.steps.find((step) => step.kind === "send" && step.phase === "modify");
  if (!send) throw Error("No Modify send");
  if (send.request === "built") {
    const before = activity.steps.slice(0, activity.steps.indexOf(send));
    const build = before.findLast((step) => step.kind === "build" && step.phase === "modify");
    if (!build?.answers?.[0]) throw Error("Modify needs an executable native build answer");
    const verdict = primmBuildVerdict(build, build.answers[0]);
    if (!verdict.ok) throw Error("The native build engine rejected the authored answer");
    return verdict.prompt;
  }
  const prompt = primmRequestPrompt(activity, send.request);
  if (!prompt) throw Error(`Unknown Modify request ${send.request}`);
  return prompt;
}

const sampleText = (sample) =>
  sample?.text ??
  `〔检查者注：真实运行未成功：${sample?.error ?? "没有运行回执"}；没有替换成示例〕`;

/** A reading view of the existing step schema, for the independent Detector.
 * Model answers stay complete. Structural/rubric annotations are not learner copy. */
export function renderStepLesson(a, draft, samples, makeSample) {
  const rows = [
    `# ${draft.title}`,
    `\n## 开场\n${a.intro.connection}\n${a.intro.situation}\n${a.intro.need}`,
  ];
  const materialText = (ids) =>
    ids
      .map((id) => {
        const material = a.materials.find((entry) => entry.id === id);
        return material
          ? `\n### ${material.label}\n${material.text}`
          : `〔检查者注：缺少材料 ${id}〕`;
      })
      .join("\n");
  rows.push(materialText(a.starter.materialIds));
  const selectedRun = stepSampleRequests(a)[0];
  rows.push(
    `〔检查者注：本次样例选择 ${selectedRun.id}；其他选择会执行各自绑定的请求。以下不是所有选项同时发生的课堂。〕`,
  );
  let activeResult = samples.run;
  for (const [index, step] of a.steps.entries()) {
    rows.push(
      `\n## ${index + 1}. ${step.title}\n〔检查者注：阶段 ${step.phase}；原生动作 ${step.kind}〕`,
    );
    switch (step.kind) {
      case "choose":
        if (step.phase === "make" && !step.answerId)
          rows.push(
            "〔检查者注：这是独立作品通过评分后的不评分自查，没有标准答案，也不是第二份独立测验；所选反馈仍须诚实、具体。〕",
          );
        for (const option of step.options)
          rows.push(
            `- ${option.label}${option.requestId ? `\n  〔检查者注：绑定请求 ${option.requestId}〕` : ""}${option.after ? `\n  选择该项后的反馈：${option.after}` : ""}`,
          );
        if (step.answerId) rows.push(`〔检查者注：判断目标 ${step.answerId}，不是预想题〕`);
        break;
      case "send":
        activeResult = step.phase === "run" ? samples.run : samples.modify;
        rows.push(
          `\n${step.attachmentLabel ?? ""}\n\n请求：\n${activeResult?.prompt ?? "〔检查者注：缺少执行请求〕"}`,
        );
        if (step.wait)
          rows.push(`等待时：${step.wait.text}\n〔检查者注：出处 ${step.wait.sourceId}〕`);
        rows.push(`\n真实回答：\n${sampleText(activeResult)}`);
        for (const item of step.debriefs ?? [])
          rows.push(
            `〔检查者注：仅选择 ${item.requestId} 时显示的老师话；其他分支不同时显示〕\n${item.text}`,
          );
        break;
      case "find": {
        const sentences = primmSentences(activeResult?.text ?? "");
        const matches = primmSentencesMentioning(sentences, step.terms);
        rows.push(sampleText(activeResult));
        rows.push(
          `〔检查者注：真实回答中可点 ${matches.length} 处；点中后〕\n${step.found}\n没有找到时：${step.absent}`,
        );
        break;
      }
      case "match":
        for (const id of step.requestIds) {
          const result = samples.requests?.[id];
          rows.push(
            `\n问法：${primmRequestPrompt(a, id)}\n该问法的真实回答：\n${sampleText(result)}`,
          );
        }
        if (step.miss) rows.push(`没连对时：${step.miss}`);
        break;
      case "sort":
        rows.push(`格子：${step.buckets.map((bucket) => bucket.label).join(" / ")}`);
        for (const card of step.cards)
          rows.push(
            `\n卡片：${card.text}\n〔检查者注：目标 ${card.bucketId}；放后解释〕\n${card.why}${card.miss ? `\n放错时：${card.miss}` : ""}`,
          );
        break;
      case "build":
        if (step.context) rows.push(step.context);
        for (const piece of step.pieces)
          rows.push(`- ${piece.text}${piece.why ? `\n  ${piece.why}` : ""}`);
        if (step.hint)
          rows.push(`〔检查者注：仅拼接失败后显示的提示，不是操作前给出的答案〕\n${step.hint}`);
        rows.push(
          `〔检查者注：拼接由原生 primmBuildVerdict 检查；以下每一种都是合法拼法，不限于真实运行样例。学习者看不到这份答案表。〕`,
        );
        for (const answer of step.answers) {
          const verdict = primmBuildVerdict(step, answer);
          if (!verdict.ok) throw Error("The native build engine rejected an authored answer");
          rows.push(`〔检查者注：${answer.length} 块即可通过〕${verdict.prompt}`);
        }
        rows.push(`〔检查者注：本次真实运行仅用了这一种拼法：${stepModifyPrompt(a)}〕`);
        break;
      case "point":
        rows.push(`〔检查者注：已核实图片 ${step.assetId}；目标 ${step.targetId}〕`);
        rows.push(step.regions.map((region) => region.label).join(" / "));
        if (step.miss) rows.push(step.miss);
        break;
      case "make":
        rows.push(
          "〔检查者注：下面的模型返回是未经学习者编辑、未经评分的真实初稿。学习者可改请求及最终作品；原生评分为 pass 后才能继续，fail / undecided 留在本步。后续自查选项不是对这份未评分初稿的判定。〕",
        );
        rows.push(
          a.make.scenario,
          a.make.goal,
          materialText(a.make.materialIds),
          a.make.promptPlaceholder,
        );
        rows.push(a.make.checklist.map((item) => `- ${item}`).join("\n"));
        rows.push(
          `\n${a.make.artifactLabel}\n〔检查者注：初学者样例请求，不是给学习者的答案〕\n${draft.samples.makePrompt}\n实际运行：\n${sampleText(makeSample)}`,
        );
        if (draft.exercise?.rubric)
          rows.push(
            `〔检查者注：原生独立评分依据，不是给学习者抄的答案〕\n${draft.exercise.rubric.join("\n")}`,
          );
        break;
      default:
        throw Error(`Unsupported native step renderer: ${step.kind}`);
    }
    if (step.after) rows.push(`\n做完后老师说：${step.after}`);
  }
  rows.push(
    `\n## ${a.finish.title}\n${a.finish.note}\n你知道吗：${a.finish.didYouKnow?.text ?? ""}\n今天试一次：${a.finish.today ?? ""}`,
  );
  rows.push("\n宝箱复习卡：", ...draft.cards.map((card) => `${card.front}\n${card.back}`));
  rows.push("\n〔检查者注：来源审核元数据〕", JSON.stringify(draft.plan.realWorld, null, 2));
  return rows.join("\n");
}
