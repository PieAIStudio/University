/**
 * @vitest-environment jsdom
 *
 * What these tests are actually protecting.
 *
 * Not "does a sound come out" — that needs ears. They protect the three rules
 * that, when broken, break silently on someone else's machine: nothing plays
 * before a gesture, nothing plays when the learner said no, and nothing that
 * goes wrong in here is allowed to throw into a render.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CUE_FOR, INCIDENTAL, type SoundMoment } from "./cues.js";

const played: string[] = [];
let unlockResult = true;
let created = 0;

vi.mock("uisfx", () => ({
  createUISFX: () => {
    created += 1;
    return {
      unlock: () => Promise.resolve(unlockResult),
      play: (cue: string) => {
        played.push(cue);
        return null;
      },
      preload: () => Promise.resolve(),
      setPack: () => undefined,
      setVolume: () => undefined,
    };
  },
}));

const { armSoundUnlock, playSound, resetSoundForTests, writeSoundEnabled, isUnlocked } =
  await import("./sound.js");

async function gesture() {
  window.dispatchEvent(new Event("pointerdown"));
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  played.length = 0;
  created = 0;
  unlockResult = true;
  window.localStorage.clear();
  resetSoundForTests();
});

describe("the latch", () => {
  it("plays nothing before a gesture, which is baseline rule 5", async () => {
    const disarm = armSoundUnlock();
    playSound("answer.correct");
    expect(played).toEqual([]);
    disarm();
  });

  it("constructs no audio machinery merely by being imported or armed", () => {
    const disarm = armSoundUnlock();
    expect(created).toBe(0);
    disarm();
  });

  it("plays after a gesture", async () => {
    armSoundUnlock();
    await gesture();
    expect(isUnlocked()).toBe(true);
    playSound("answer.correct");
    expect(played).toEqual(["success"]);
  });

  it("stays silent when the browser refuses to start the context", async () => {
    unlockResult = false;
    armSoundUnlock();
    await gesture();
    playSound("answer.correct");
    expect(played).toEqual([]);
  });
});

describe("the preference", () => {
  it("is on by default, because the latch means it cannot ambush anyone", async () => {
    armSoundUnlock();
    await gesture();
    playSound("answer.correct");
    expect(played).toHaveLength(1);
  });

  it("silences everything once the learner says no", async () => {
    armSoundUnlock();
    await gesture();
    writeSoundEnabled(false);
    playSound("answer.correct");
    playSound("reward.course");
    expect(played).toEqual([]);
  });

  it("survives a reload", () => {
    writeSoundEnabled(false);
    resetSoundForTests();
    armSoundUnlock();
    playSound("answer.correct");
    expect(played).toEqual([]);
  });
});

describe("the cue table", () => {
  it("gives the three grading outcomes three different sounds", () => {
    const outcomes = [
      CUE_FOR["answer.correct"],
      CUE_FOR["answer.wrong"],
      CUE_FOR["answer.undecided"],
    ];
    expect(new Set(outcomes).size).toBe(3);
  });

  it("keeps the rarest cue for the rarest moment", () => {
    // `achievement` is the loudest thing in the vocabulary. If it ever appears
    // twice in this table, one of the two moments is being oversold.
    const uses = Object.values(CUE_FOR).filter((cue) => cue === "achievement");
    expect(uses).toHaveLength(1);
    expect(CUE_FOR["reward.course"]).toBe("achievement");
  });

  it("holds down the moments that fire on movement rather than intent", async () => {
    for (const moment of INCIDENTAL) {
      expect(CUE_FOR[moment]).toBeDefined();
    }
    // Hover is the one that fires on every pointer crossing, so it must be in
    // the held-down set or the map becomes a woodpecker.
    expect(INCIDENTAL.has("map.hover")).toBe(true);
  });

  it("names every moment exactly once", () => {
    const moments = Object.keys(CUE_FOR) as SoundMoment[];
    expect(new Set(moments).size).toBe(moments.length);
  });
});

describe("failure", () => {
  it("is silent rather than thrown, because a sound decorates a thing that already happened", async () => {
    armSoundUnlock();
    await gesture();
    expect(() => playSound("nope" as SoundMoment)).not.toThrow();
  });
});
