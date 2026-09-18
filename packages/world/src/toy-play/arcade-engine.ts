import { CATEGORIES, type ToyMode, type Words } from "./material.js";
import { CLAIMS, FLIGHT_CARDS, SENTENCES, VOCABULARY, wordIndex } from "./arcade-content.js";

export type Phase = "ready" | "playing" | "upgrade" | "won" | "lost";
export interface Foe {
  id: number;
  card: number;
  x: number;
  z: number;
  vx: number;
  age: number;
  diving: boolean;
  revealed: boolean;
  cooldown: number;
  speed: number;
}
export interface Shot {
  id: number;
  x: number;
  z: number;
  kind: number;
}
export interface Row {
  id: number;
  card: number;
  filled: boolean;
  until: number;
  review: boolean;
  wrong: boolean;
}
export interface Spark {
  id: number;
  x: number;
  y: number;
  z: number;
  age: number;
  good: boolean;
}
export interface Review {
  key: string;
  text: Words;
  answer: Words;
  why: Words;
  corrected: boolean;
}
export interface ArcadeState {
  mode: ToyMode;
  phase: Phase;
  elapsed: number;
  score: number;
  combo: number;
  best: number;
  lives: number;
  wave: number;
  waveRemaining: number;
  challengeLeft: number;
  challengeExpired: boolean;
  resolved: number;
  correct: number;
  firstTry: number;
  goal: number;
  seed: number;
  shipX: number;
  targetX: number;
  direction: number;
  fireEvery: number;
  slow: number;
  enemies: Foe[];
  shots: Shot[];
  sparks: Spark[];
  queue: number[];
  spawnIn: number;
  fireIn: number;
  diveIn: number;
  piles: number[][];
  falling: { card: number; y: number } | null;
  lane: number;
  pendingIn: number;
  rows: Row[];
  rowQueue: { card: number; review: boolean }[];
  bag: number[];
  selectedWord: number | null;
  junk: number;
  riseIn: number;
  reviewScheduled: number[];
  reviews: Review[];
  notice: {
    kind: "none" | "hit" | "wrong" | "miss" | "cleared" | "revisit";
    text: Words;
    id: number;
  };
}
export type ArcadeAction =
  | { type: "start" }
  | { type: "reset" }
  | { type: "upgrade"; choice: "rapid" | "heart" | "slow" }
  | { type: "aim"; x: number }
  | { type: "direction"; value: number }
  | { type: "lane"; index: number }
  | { type: "drop" }
  | { type: "word"; index: number }
  | { type: "fit"; rowId: number; word?: number };
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const isIndex = (x: number, n: number) => Number.isInteger(x) && x >= 0 && x < n;

/** One simulation for all input paths. Stage supplies seconds; no timer, DOM,
 * renderer, model, account or course writes occur here. Snapshots are published
 * at 10Hz; positions are read directly by the unique render loop. */
export class ArcadeSession {
  private data: ArcadeState;
  private snapshot: ArcadeState;
  private listeners = new Set<() => void>();
  private carry = 0;
  private publishIn = 0;
  private serial = 0;
  private suspended = false;
  private rng: number;
  constructor(
    readonly mode: ToyMode,
    readonly seed = 7103,
    readonly pace = 1,
  ) {
    this.rng = seed >>> 0 || 1;
    this.data = this.initialize();
    this.snapshot = structuredClone(this.data);
  }
  getState = (): Readonly<ArcadeState> => this.data;
  getSnapshot = (): ArcadeState => this.snapshot;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private publish() {
    this.snapshot = structuredClone(this.data);
    this.listeners.forEach((fn) => fn());
  }
  private random() {
    this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }
  private shuffle<T>(values: readonly T[]): T[] {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }
  private initialize(): ArcadeState {
    const data: ArcadeState = {
      mode: this.mode,
      phase: "ready",
      elapsed: 0,
      score: 0,
      combo: 0,
      best: 0,
      lives: 3,
      wave: 1,
      waveRemaining: 0,
      challengeLeft: 22,
      challengeExpired: false,
      resolved: 0,
      correct: 0,
      firstTry: 0,
      goal: this.mode === "invaders" ? 10 : 24,
      seed: this.seed,
      shipX: 0,
      targetX: 0,
      direction: 0,
      fireEvery: 0.48,
      slow: 1,
      enemies: [],
      shots: [],
      sparks: [],
      queue: [],
      spawnIn: 0,
      fireIn: 0.7,
      diveIn: 7,
      piles: [[], [], []],
      falling: null,
      lane: 1,
      pendingIn: 0,
      rows: [],
      rowQueue: [],
      bag: [],
      selectedWord: null,
      junk: 0,
      riseIn: 10,
      reviewScheduled: [],
      reviews: [],
      notice: { kind: "none", text: ["", ""], id: 0 },
    };
    return data;
  }
  private note(kind: ArcadeState["notice"]["kind"], text: Words) {
    this.data.notice = { kind, text, id: ++this.serial };
  }
  private review(key: string, text: Words, answer: Words, why: Words) {
    const existing = this.data.reviews.find((r) => r.key === key);
    if (existing) existing.corrected = false;
    else this.data.reviews.push({ key, text, answer, why, corrected: false });
  }
  private correctReview(key: string) {
    const r = this.data.reviews.find((r) => r.key === key);
    if (r) r.corrected = true;
  }
  private burst(x: number, y: number, z: number, good: boolean) {
    this.data.sparks.push({ id: ++this.serial, x, y, z, good, age: 0 });
    if (this.data.sparks.length > 5) this.data.sparks.shift();
  }
  private award(points: number) {
    const s = this.data;
    s.combo++;
    s.best = Math.max(s.best, s.combo);
    s.score += points;
    s.correct++;
  }
  private prepareWave() {
    const s = this.data;
    const n = s.wave % 5 === 0 ? 6 : Math.min(4 + Math.floor(s.wave / 2), 7);
    const pics = this.shuffle(
      FLIGHT_CARDS.map((_, i) => i).filter((i) => FLIGHT_CARDS[i]![2] === 0),
    );
    const records = this.shuffle(
      FLIGHT_CARDS.map((_, i) => i).filter((i) => FLIGHT_CARDS[i]![2] === 1),
    );
    s.queue = this.shuffle(
      Array.from({ length: n }, (_, i) =>
        i % 2
          ? records[Math.floor(i / 2) % records.length]!
          : pics[Math.floor(i / 2) % pics.length]!,
      ),
    );
    s.enemies = [];
    s.shots = [];
    s.spawnIn = 0;
    s.fireIn = 0.7;
    s.diveIn = 7;
    s.waveRemaining = n;
    s.challengeLeft = 22;
    s.challengeExpired = false;
    this.spawnFoe();
  }
  private spawnFoe() {
    const s = this.data;
    const card = s.queue.shift();
    if (card === undefined) return;
    const side = this.random() < 0.5 ? -1 : 1;
    s.enemies.push({
      id: ++this.serial,
      card,
      x: side * 2.8,
      z: -3.4,
      vx: -side * (0.55 + 0.06 * s.wave),
      age: 0,
      diving: false,
      revealed: false,
      cooldown: 0,
      speed: 1,
    });
    s.spawnIn = 3.8;
  }
  private nextBlock() {
    const s = this.data;
    if (s.resolved >= s.goal) {
      s.phase = "won";
      return;
    }
    if (!s.queue.length) s.queue = this.shuffle(CLAIMS.map((_, i) => i));
    s.falling = { card: s.queue.shift()!, y: 6.2 };
    s.pendingIn = 0;
  }
  private settleBlock() {
    const s = this.data;
    if (!s.falling) return;
    const card = CLAIMS[s.falling.card]!;
    const good = s.lane === card.answer;
    const x = (s.lane - 1) * 2.7;
    this.burst(x, 0.9 + s.piles[s.lane]!.length * 0.7, 1, good);
    s.resolved++;
    if (good) {
      this.award(10 + Math.min(15, s.combo * 3));
      if (!s.reviews.some((r) => r.key === card.id)) s.firstTry++;
      this.correctReview(card.id);
      this.note("hit", card.explanation);
    } else {
      s.combo = 0;
      s.piles[s.lane]!.push(s.falling.card);
      this.review(card.id, card.prompt, CATEGORIES[card.answer]!, card.explanation);
      this.note("wrong", card.explanation);
      if (s.piles[s.lane]!.length >= 4) s.phase = "lost";
    }
    s.falling = null;
    s.pendingIn = 0.8;
  }
  private refillWords() {
    const s = this.data;
    const needed = [...new Set(s.rows.filter((r) => !r.filled).map((r) => wordIndex(r.card)))];
    const topic = s.rows.find((r) => !r.filled)?.card ?? 0;
    const pool = [
      ...new Set(
        SENTENCES.filter((c) => c.topic === SENTENCES[topic]!.topic).map((c) =>
          VOCABULARY.findIndex((w) => w[0] === c.answer[0]),
        ),
      ),
    ];
    const bag = s.bag.length === 6 ? [...s.bag] : (Array(6).fill(-1) as number[]);
    const present = new Set(bag);
    for (const w of this.shuffle(needed))
      if (!present.has(w)) {
        const slots = bag
          .map((v, i) => i)
          .filter((i) => !needed.includes(bag[i]!) && bag[i] !== s.selectedWord);
        const target = slots[Math.floor(this.random() * slots.length)];
        if (target !== undefined) {
          bag[target] = w;
          present.add(w);
        }
      }
    for (let i = 0; i < 6; i++)
      if (bag[i] === -1) {
        let options = pool.filter((w) => !bag.includes(w));
        if (!options.length) options = VOCABULARY.map((_, j) => j).filter((w) => !bag.includes(w));
        bag[i] = options[Math.floor(this.random() * options.length)]!;
      }
    s.bag = bag;
  }
  private spawnRow() {
    const s = this.data;
    const item = s.rowQueue.shift();
    if (!item) return;
    s.rows.push({
      id: ++this.serial,
      card: item.card,
      filled: false,
      until: 0,
      review: item.review,
      wrong: false,
    });
    this.refillWords();
    this.checkHeight();
  }
  private checkHeight() {
    if (this.data.rows.length + this.data.junk * 0.5 > 5.5) this.data.phase = "lost";
  }
  private floorRows() {
    while (this.data.phase === "playing" && this.data.rows.length < 3 && this.data.rowQueue.length)
      this.spawnRow();
  }
  private fit(rowId: number, word: number | null) {
    const s = this.data;
    const row = s.rows.find((r) => r.id === rowId && !r.filled);
    if (!row || word === null || !s.bag.includes(word)) return;
    const card = SENTENCES[row.card]!;
    s.selectedWord = null;
    if (word !== wordIndex(row.card)) {
      row.wrong = true;
      s.junk++;
      s.combo = 0;
      this.review(card.id, card.text, card.answer, card.why);
      this.note("wrong", card.why);
      this.burst(0, 1, 0, false);
      this.checkHeight();
    } else {
      row.filled = true;
      row.until = s.elapsed + 1.05;
      if (!row.review) s.resolved++;
      this.award(10 + Math.min(15, s.combo * 3));
      if (!row.wrong && !row.review) s.firstTry++;
      this.correctReview(card.id);
      this.note("cleared", card.why);
      this.burst(0, 2, 0, true);
      if (row.wrong && !s.reviewScheduled.includes(row.card)) {
        s.reviewScheduled.push(row.card);
        s.rowQueue.splice(Math.min(4, s.rowQueue.length), 0, { card: row.card, review: true });
        this.note("revisit", [
          "这句稍后会再来一次。先读一遍补完整的句子。",
          "This sentence will return later. Read the completed sentence first.",
        ]);
      }
      const slot = s.bag.indexOf(word);
      if (slot >= 0) s.bag[slot] = -1;
      this.refillWords();
    }
  }
  act = (action: ArcadeAction) => {
    const s = this.data;
    if (action.type === "reset") {
      this.rng = this.seed >>> 0 || 1;
      this.serial = 0;
      this.carry = 0;
      this.data = this.initialize();
      this.publish();
      return;
    }
    if (action.type === "start" && s.phase === "ready") {
      s.phase = "playing";
      if (s.mode === "invaders") this.prepareWave();
      else if (s.mode === "stack") this.nextBlock();
      else {
        s.rowQueue = [0, 1, 2].flatMap((topic) =>
          this.shuffle(
            SENTENCES.map((c, i) => ({ c, i }))
              .filter((x) => x.c.topic === topic)
              .map((x) => ({ card: x.i, review: false })),
          ),
        );
        this.floorRows();
      }
    } else if (
      action.type === "upgrade" &&
      s.phase === "upgrade" &&
      ["rapid", "heart", "slow"].includes(action.choice)
    ) {
      if (action.choice === "heart") s.lives = Math.min(4, s.lives + 1);
      if (action.choice === "rapid") s.fireEvery = Math.max(0.22, s.fireEvery - 0.07);
      s.slow = action.choice === "slow" ? 0.72 : 1;
      s.wave++;
      s.phase = "playing";
      this.prepareWave();
    } else if (s.phase === "playing") {
      if (action.type === "aim" && Number.isFinite(action.x)) {
        s.targetX = clamp(action.x, -3.5, 3.5);
        s.direction = 0;
        return;
      }
      if (action.type === "direction" && [-1, 0, 1].includes(action.value)) {
        s.direction = action.value;
        return;
      }
      if (action.type === "lane" && isIndex(action.index, 3)) s.lane = action.index;
      if (action.type === "drop" && s.mode === "stack") this.settleBlock();
      if (
        action.type === "word" &&
        s.mode === "cloze-tetris" &&
        isIndex(action.index, VOCABULARY.length) &&
        s.bag.includes(action.index)
      )
        s.selectedWord = action.index;
      if (action.type === "fit" && s.mode === "cloze-tetris")
        this.fit(action.rowId, action.word ?? s.selectedWord);
    }
    this.publish();
  };
  /** Explicitly clear held directions whenever the host pauses; no catch-up. */
  freeze = () => {
    this.carry = 0;
    this.data.direction = 0;
  };
  setSuspended = (value: boolean) => {
    this.suspended = value;
    if (value) this.freeze();
  };
  advance = (delta: number) => {
    if (this.suspended || !Number.isFinite(delta) || delta <= 0 || this.data.phase !== "playing")
      return;
    this.carry += Math.min(delta, 0.1);
    while (this.carry + 1e-9 >= 1 / 60 && this.data.phase === "playing") {
      this.step(1 / 60);
      this.carry -= 1 / 60;
    }
    this.publishIn -= delta;
    if (this.publishIn <= 0 || this.data.phase !== this.snapshot.phase) {
      this.publishIn = 0.1;
      this.publish();
    }
  };
  private step(dt: number) {
    const s = this.data;
    s.elapsed += dt;
    s.sparks = s.sparks.filter((p) => (p.age += dt) < 0.75);
    if (s.mode === "invaders") this.flight(dt);
    else if (s.mode === "stack") {
      if (s.falling) {
        s.falling.y -= dt * this.pace * (0.5 + s.resolved * 0.016);
        if (s.falling.y <= 1 + s.piles[s.lane]!.length * 0.7) this.settleBlock();
      } else if ((s.pendingIn -= dt) <= 0) this.nextBlock();
    } else {
      s.rows = s.rows.filter((r) => !r.filled || s.elapsed < r.until);
      this.floorRows();
      if (!s.rows.length && !s.rowQueue.length) {
        s.phase = "won";
        return;
      }
      s.riseIn -= dt * this.pace;
      if (s.riseIn <= 0) {
        s.riseIn = Math.max(6.5, 10 - s.resolved * 0.1);
        this.spawnRow();
      }
    }
  }
  private flight(dt: number) {
    const s = this.data;
    const challenge = s.wave % 5 === 0;
    if (s.direction) s.targetX = clamp(s.targetX + s.direction * dt * 6, -3.5, 3.5);
    s.shipX += (s.targetX - s.shipX) * (1 - Math.exp(-dt * 18));
    s.fireIn -= dt;
    s.spawnIn -= dt;
    s.diveIn -= dt;
    if (s.fireIn <= 0) {
      s.fireIn = s.fireEvery;
      s.shots.push({ id: ++this.serial, x: s.shipX, z: 3.25, kind: s.shipX < 0 ? 0 : 1 });
    }
    if (s.queue.length && s.enemies.length < 3 && s.spawnIn <= 0) this.spawnFoe();
    if (!challenge && s.diveIn <= 0) {
      const f = s.enemies.find((e) => !e.diving && e.age > 3.5);
      if (f) {
        f.diving = true;
        s.diveIn = 7;
      }
    }
    for (const f of s.enemies) {
      f.age += dt;
      f.cooldown -= dt;
      f.x += f.vx * dt * this.pace * s.slow;
      if (f.x < -3.3 || f.x > 3.3) {
        f.x = clamp(f.x, -3.3, 3.3);
        f.vx *= -1;
      }
      const pace = this.pace * s.slow;
      if (!challenge)
        f.z += dt * pace * (f.diving ? 0.72 + s.wave * 0.025 : 0.22 + s.wave * 0.014) * f.speed;
      else f.z = -2.4 + Math.sin(f.age * 0.6 + f.id) * 0.55;
      if (f.z >= 3.25) {
        s.enemies = s.enemies.filter((e) => e.id !== f.id);
        s.lives--;
        s.waveRemaining--;
        s.combo = 0;
        const card = FLIGHT_CARDS[f.card]!;
        this.review(
          `flight-${f.card}`,
          [card[0], card[1]],
          card[2] ? ["查记录", "Read record"] : ["看照片", "Look at photo"],
          card[2]
            ? [
                "这不是画面直接给出的信息，需要查相关记录。",
                "The image alone does not establish this; consult the record.",
              ]
            : [
                "这可以对照照片的画面来检查。",
                "This can be checked against the visible photograph.",
              ],
        );
        this.note("miss", [
          "漏过一条，少一颗心。停下来查材料也可以。",
          "One got through; one heart lost. You can pause to consult the material.",
        ]);
        this.burst(f.x, 0.8, 3, false);
        if (s.lives <= 0) {
          s.phase = "lost";
          return;
        }
      }
    }
    for (const shot of s.shots) {
      const from = shot.z;
      shot.z -= dt * 8.5;
      const f = s.enemies
        .filter(
          (e) =>
            e.age >= 1.2 &&
            e.z >= -3.4 &&
            Math.abs(e.x - shot.x) < 0.72 &&
            from >= e.z - 0.38 &&
            shot.z <= e.z + 0.38,
        )
        .sort((a, b) => b.z - a.z)[0];
      if (!f) continue;
      s.shots = s.shots.filter((b) => b.id !== shot.id);
      const card = FLIGHT_CARDS[f.card]!;
      if (shot.kind === card[2]) {
        s.enemies = s.enemies.filter((e) => e.id !== f.id);
        s.waveRemaining--;
        this.award(f.diving ? 30 : 15);
        if (!f.revealed) s.firstTry++;
        this.correctReview(`flight-${f.card}`);
        this.burst(f.x, 0.8, f.z, true);
        this.note(
          "hit",
          f.diving
            ? ["拦住俯冲目标，+30。", "Diving target intercepted, +30."]
            : ["核对方式选对了，+15。", "Right checking tool, +15."],
        );
      } else if (f.cooldown <= 0) {
        f.cooldown = 1.5;
        f.revealed = true;
        f.speed = Math.min(1.65, f.speed + 0.25);
        s.combo = 0;
        const why: Words = card[2]
          ? [
              "这条要查记录。飞到右边，换一种核对方式。",
              "This needs the record. Fly right to change tools.",
            ]
          : [
              "这条能看照片核对。飞到左边，再拦截它。",
              "This can be checked in the photo. Fly left and intercept it.",
            ];
        this.review(
          `flight-${f.card}`,
          [card[0], card[1]],
          card[2] ? ["查记录", "Read record"] : ["看照片", "Look at photo"],
          why,
        );
        this.note("wrong", why);
        this.burst(f.x, 0.8, f.z, false);
      }
    }
    s.shots = s.shots.filter((b) => b.z > -4.3).slice(-32);
    if (challenge) {
      s.challengeLeft -= dt * this.pace;
      if (s.challengeLeft <= 0) {
        s.challengeExpired = s.waveRemaining > 0;
        for (const cardIndex of [...s.queue, ...s.enemies.map((e) => e.card)]) {
          const c = FLIGHT_CARDS[cardIndex]!;
          this.review(
            `flight-${cardIndex}`,
            [c[0], c[1]],
            c[2] ? ["查记录", "Read record"] : ["看照片", "Look at photo"],
            [
              "挑战时间结束时还没拦住。再看看应该用哪种方式核对。",
              "Still pending when the challenge ended. Review the appropriate checking tool.",
            ],
          );
        }
        s.queue = [];
        s.enemies = [];
      }
    }
    if (!s.queue.length && !s.enemies.length) {
      if (challenge && !s.challengeExpired) s.score += 60;
      s.shots = [];
      s.resolved = s.wave;
      s.phase = s.wave === 10 ? (s.challengeExpired ? "lost" : "won") : "upgrade";
    }
  }
}
