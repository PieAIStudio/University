import { CLAIMS } from "./arcade-content.js";
import type { Words } from "./material.js";

export type WorkshopMode = "slice" | "wire" | "rank";
export type WorkshopPhase = "ready" | "playing" | "running" | "round" | "won" | "lost";
export interface ProcessStep {
  text: Words;
  requires: readonly number[];
  why: Words;
}
export const PROCESS_TASKS: readonly { title: Words; steps: readonly ProcessStep[] }[] = [
  {
    title: ["用 AI 写一条活动提醒", "Make an event reminder with AI"],
    steps: [
      {
        text: ["定好要交什么", "Define the result"],
        requires: [],
        why: [
          "先说清要的是活动提醒，不只是一个主题。",
          "Define a reminder as the result, not just a topic.",
        ],
      },
      {
        text: ["列出必留信息", "List required details"],
        requires: [0],
        why: [
          "知道要做什么后，列出时间、地点等不能丢的信息。",
          "Once the result is clear, list details such as time and place.",
        ],
      },
      {
        text: ["把要求发给 AI", "Send the request to AI"],
        requires: [0, 1],
        why: ["要求还没定好，不急着发送。", "Set the result and requirements before sending."],
      },
      {
        text: ["对照公告检查", "Check the announcement"],
        requires: [2],
        why: [
          "拿到草稿后，才有结果可以逐条检查。",
          "There must be a draft before you check its details.",
        ],
      },
    ],
  },
  {
    title: ["核对一段图片说明", "Check an image caption"],
    steps: [
      {
        text: ["打开待查说明", "Open the caption"],
        requires: [],
        why: ["先知道要检查的是哪段说明。", "First identify the caption you are checking."],
      },
      {
        text: ["看图核对画面", "Inspect the photo"],
        requires: [0],
        why: [
          "这一步查画面内容；它和查记录可以互换先后。",
          "Check visible details; this can come before or after checking the record.",
        ],
      },
      {
        text: ["查记录核对背景", "Read the image record"],
        requires: [0],
        why: [
          "这一步查日期和摄影者；它和看图可以互换先后。",
          "Check the date and author; this can come before or after inspecting the photo.",
        ],
      },
      {
        text: ["修好说明再交付", "Revise and deliver"],
        requires: [1, 2],
        why: [
          "画面和背景都核对过，再交付这段说明。",
          "Check both kinds of detail before delivering the revised caption.",
        ],
      },
    ],
  },
  {
    title: ["只修改草稿中的一段", "Revise just one part"],
    steps: [
      {
        text: ["选中要改的段落", "Select the passage"],
        requires: [],
        why: [
          "先确定修改范围，避免整篇被重写。",
          "Set the editing scope to avoid rewriting the whole draft.",
        ],
      },
      {
        text: ["说清改什么留什么", "State changes and limits"],
        requires: [0],
        why: [
          "选好范围，再说明要改的地方和不能动的信息。",
          "Specify the changes and what must stay within the selected scope.",
        ],
      },
      {
        text: ["让 AI 修改这一段", "Ask AI to revise it"],
        requires: [0, 1],
        why: ["范围和要求都清楚了，再交给 AI。", "Give AI both the scope and requirements."],
      },
      {
        text: ["对照原稿检查", "Compare with the original"],
        requires: [2],
        why: [
          "比较改前改后，确认没有误改其他地方。",
          "Compare versions to check that other parts stayed unchanged.",
        ],
      },
    ],
  },
];
export const WIRING_ROUNDS = [
  [0, 1, 2, 4],
  [3, 5, 7, 6],
  [8, 9, 10, 11],
] as const;
export interface Capsule {
  id: number;
  card: number;
  x: number;
  y: number;
  age: number;
  cutAt: number | null;
  good: boolean;
}
export interface WorkshopState {
  mode: WorkshopMode;
  phase: WorkshopPhase;
  elapsed: number;
  score: number;
  round: number;
  correct: number;
  mistakes: number;
  selected: number | null;
  links: number[];
  checked: boolean;
  order: number[];
  train: number;
  runClock: number;
  capsules: Capsule[];
  sent: number;
  resolved: number;
  missed: number;
  combo: number;
  notice: Words;
  errors: number[];
  collisionCount: number;
}
export type WorkshopAction =
  | { type: "start" | "reset" | "check" | "next" }
  | { type: "pick"; index: number }
  | { type: "connect"; index: number }
  | { type: "swap"; index: number }
  | { type: "cut"; id: number };
const indexOK = (n: number, count: number) => Number.isInteger(n) && n >= 0 && n < count;
export class WorkshopSession {
  private data: WorkshopState;
  private snap: WorkshopState;
  private listeners = new Set<() => void>();
  private suspended = false;
  private carry = 0;
  private publishIn = 0;
  private spawnIn = 0;
  private serial = 0;
  private randomState: number;
  private queue: number[] = [];
  constructor(
    readonly mode: WorkshopMode,
    readonly seed = 391,
    readonly pace = 1,
  ) {
    this.randomState = seed;
    this.data = this.initial();
    this.snap = structuredClone(this.data);
  }
  private initial(): WorkshopState {
    return {
      mode: this.mode,
      phase: "ready",
      elapsed: 0,
      score: 0,
      round: 0,
      correct: 0,
      mistakes: 0,
      selected: null,
      links: [-1, -1, -1, -1],
      checked: false,
      order: [2, 0, 3, 1],
      train: -1,
      runClock: 0,
      capsules: [],
      sent: 0,
      resolved: 0,
      missed: 0,
      combo: 0,
      notice: ["", ""],
      errors: [],
      collisionCount: 0,
    };
  }
  getState = () => this.data;
  getSnapshot = () => this.snap;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private publish() {
    this.snap = structuredClone(this.data);
    this.listeners.forEach((fn) => fn());
  }
  setSuspended = (paused: boolean) => {
    this.suspended = paused;
    if (paused) this.carry = 0;
  };
  private random() {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }
  private shuffle(values: number[]) {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [values[i], values[j]] = [values[j]!, values[i]!];
    }
    return values;
  }
  act = (a: WorkshopAction) => {
    const s = this.data;
    if (a.type === "reset") {
      this.randomState = this.seed;
      this.data = this.initial();
      this.serial = 0;
      this.spawnIn = 0;
      this.queue = [];
      this.carry = 0;
    } else if (a.type === "start" && s.phase === "ready") {
      s.phase = "playing";
      this.queue = this.shuffle([...CLAIMS.map((_, i) => i), ...CLAIMS.map((_, i) => i)]);
    } else if (a.type === "next" && s.phase === "round") {
      s.round++;
      s.links = [-1, -1, -1, -1];
      s.checked = false;
      s.order = [2, 0, 3, 1];
      s.selected = null;
      s.train = -1;
      s.notice = ["", ""];
      s.phase = "playing";
    } else if (s.phase === "playing" && !this.suspended) {
      if (a.type === "pick" && indexOK(a.index, 4)) s.selected = a.index;
      if (a.type === "connect" && s.mode === "wire" && indexOK(a.index, 3) && s.selected !== null) {
        s.links[s.selected] = a.index;
        s.selected = null;
        s.checked = false;
        s.notice = [
          "已接好一根线。全部接好后，通电检查。",
          "Cable connected. Test after connecting all four.",
        ];
      }
      if (a.type === "swap" && s.mode === "rank" && indexOK(a.index, 4)) {
        if (s.selected === null) s.selected = a.index;
        else {
          [s.order[s.selected], s.order[a.index]] = [s.order[a.index]!, s.order[s.selected]!];
          s.selected = null;
          s.train = -1;
          s.notice = ["顺序改好了，试着发车。", "Order changed. Try running the train."];
        }
      }
      if (a.type === "check" && s.mode === "wire") {
        if (s.links.some((n) => n < 0))
          s.notice = ["还有没接好的线。先接好四条。", "Connect all four cables first."];
        else {
          s.checked = true;
          const bad = WIRING_ROUNDS[s.round]!.findIndex((c, i) => CLAIMS[c]!.answer !== s.links[i]);
          if (bad >= 0) {
            s.mistakes++;
            s.notice = CLAIMS[WIRING_ROUNDS[s.round]![bad]!]!.explanation;
          } else {
            s.phase = "running";
            s.runClock = 1.5;
            s.notice = [
              "这组都接对了，信号正在通过。",
              "Connections match. The signal is passing through.",
            ];
          }
        }
      }
      if (a.type === "check" && s.mode === "rank") {
        s.phase = "running";
        s.train = -1;
        s.runClock = 0.6;
        s.selected = null;
        s.notice = ["列车开始执行这组步骤。", "The train is following these steps."];
      }
      if (a.type === "cut" && s.mode === "slice") {
        const f = s.capsules.find((c) => c.id === a.id && c.cutAt === null);
        if (f && f.age >= 0.45) {
          f.cutAt = s.elapsed;
          s.collisionCount++;
          if (f.good) {
            s.correct++;
            s.combo++;
            s.score += 10 + Math.min(s.combo * 2, 10);
            s.notice = CLAIMS[f.card]!.explanation;
          } else {
            s.mistakes++;
            s.combo = 0;
            s.score = Math.max(0, s.score - 20);
            if (!s.errors.includes(f.card)) s.errors.push(f.card);
            s.notice = CLAIMS[f.card]!.explanation;
            if (s.mistakes >= 3) s.phase = "lost";
          }
        }
      }
    }
    this.publish();
  };
  advance = (delta: number) => {
    if (
      this.suspended ||
      !Number.isFinite(delta) ||
      delta <= 0 ||
      !["playing", "running"].includes(this.data.phase)
    )
      return;
    this.carry += Math.min(delta, 0.1);
    while (this.carry + 1e-9 >= 1 / 60) {
      this.step(1 / 60);
      this.carry -= 1 / 60;
    }
    this.publishIn -= delta;
    if (this.publishIn <= 0 || this.data.phase !== this.snap.phase) {
      this.publishIn = 0.1;
      this.publish();
    }
  };
  private finishRound() {
    const s = this.data;
    s.correct += s.mode === "wire" ? 4 : 1;
    s.score += 40;
    s.phase = s.round === 2 ? "won" : "round";
  }
  private step(dt: number) {
    const s = this.data;
    if (!["playing", "running"].includes(s.phase)) return;
    s.elapsed += dt * this.pace;
    if (s.phase === "running") {
      s.runClock -= dt * this.pace;
      if (s.runClock > 0) return;
      if (s.mode === "wire") {
        this.finishRound();
        return;
      }
      const next = s.train + 1;
      if (next === 4) {
        this.finishRound();
        return;
      }
      const step = PROCESS_TASKS[s.round]!.steps[s.order[next]!]!;
      const before = s.order.slice(0, next);
      if (!step.requires.every((r) => before.includes(r))) {
        s.train = next;
        s.phase = "playing";
        s.checked = true;
        s.mistakes++;
        s.notice = step.why;
        return;
      }
      s.train = next;
      s.runClock = 0.75;
      s.checked = false;
      s.notice = step.why;
      return;
    }
    if (s.mode !== "slice") return;
    this.spawnIn -= dt * this.pace;
    if (this.queue.length && this.spawnIn <= 0 && s.capsules.length < 2) {
      const card = this.queue.shift()!;
      s.capsules.push({
        id: ++this.serial,
        card,
        x: (s.sent % 2 ? -1 : 1) * (1.2 + this.random() * 0.8),
        y: -1,
        age: 0,
        cutAt: null,
        good: CLAIMS[card]!.answer < 2,
      });
      s.sent++;
      this.spawnIn = 3.0;
    }
    for (const c of s.capsules) {
      c.age += dt * this.pace;
      c.y = -1 + 3.4 * c.age - 0.5 * c.age * c.age;
    }
    s.capsules = s.capsules.filter((c) => {
      const cutDone = c.cutAt !== null && s.elapsed - c.cutAt > 0.65;
      const fallen = c.age > 6.8;
      if (!cutDone && !fallen) return true;
      s.resolved++;
      if (fallen && c.cutAt === null && c.good) {
        s.missed++;
        s.combo = 0;
        if (!s.errors.includes(c.card)) s.errors.push(c.card);
      }
      return false;
    });
    if (!this.queue.length && !s.capsules.length) s.phase = "won";
  }
}
