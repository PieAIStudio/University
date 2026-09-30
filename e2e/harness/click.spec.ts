import { expect, test } from "@playwright/test";
import { humanClick } from "./click.js";

test.describe("trusted pointer harness", () => {
  test("follows a hover-shifted target before sending exactly one trusted click", async ({
    page,
  }) => {
    await page.setContent(`
      <style>button{position:absolute;left:20px;top:80px;width:140px;height:48px}</style>
      <button>Target</button><output>0</output>
      <script>
        let moved = false;
        const button = document.querySelector('button');
        const events = [];
        window.pointerProof = events;
        button.addEventListener('pointerenter', () => {
          if (!moved) { moved = true; button.style.left = '240px'; }
        });
        button.addEventListener('click', event => {
          events.push({ trusted: event.isTrusted, x: event.clientX, y: event.clientY });
          document.querySelector('output').textContent = String(events.length);
        });
      </script>
    `);
    let presses = 0;
    await humanClick(page, page.getByRole("button", { name: "Target" }), "hover shift", {
      beforePress: () => {
        presses += 1;
      },
    });
    await expect(page.locator("output")).toHaveText("1");
    expect(presses).toBe(1);
    const events = await page.evaluate(
      () => (window as unknown as { pointerProof: { trusted: boolean; x: number }[] }).pointerProof,
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.trusted).toBe(true);
    expect(events[0]!.x).toBeGreaterThanOrEqual(240);
    expect(events[0]!.x).toBeLessThanOrEqual(380);
  });

  test("holds one trusted pointer through a transition without releasing early", async ({
    page,
  }) => {
    await page.setContent(`<button style="width:140px;height:48px">Target</button><output>0</output>
      <script>window.heldEvents=[]; const button=document.querySelector('button');
      for(const type of ['pointerdown','pointerup','click']) button.addEventListener(type, event=>{
        window.heldEvents.push([event.type,event.isTrusted]);
        document.querySelector('output').textContent=String(window.heldEvents.length);
      });</script>`);
    let calls = 0;
    await humanClick(page, page.getByRole("button"), "held target", {
      whilePressed: async () => {
        calls++;
        await expect(page.locator("output")).toHaveText("1");
        await page.getByRole("button").evaluate((node) => {
          node.textContent = "Same target, new state";
        });
        await expect(page.locator("output")).toHaveText("1");
      },
    });
    expect(calls).toBe(1);
    expect(await page.evaluate(() => (window as any).heldEvents)).toEqual([
      ["pointerdown", true],
      ["pointerup", true],
      ["click", true],
    ]);
  });

  test("does not chase a target that moves away after the held press", async ({ page }) => {
    await page.setContent(`<button style="position:absolute;left:20px;top:80px;width:140px;height:48px"
      onclick="document.querySelector('output').textContent='1'">Target</button><output>0</output>`);
    let calls = 0;
    await humanClick(page, page.getByRole("button"), "moving during press", {
      whilePressed: async () => {
        calls++;
        await page.getByRole("button").evaluate((node) => {
          node.style.left = "500px";
        });
      },
    });
    expect(calls).toBe(1);
    await expect(page.locator("output")).toHaveText("0");
  });

  test("does not force a click through an invisible overlay", async ({ page }) => {
    await page.setContent(`
      <button style="position:absolute;left:20px;top:80px;width:140px;height:48px"
        onclick="document.querySelector('output').textContent='1'">Target</button>
      <output>0</output>
      <div style="position:fixed;inset:0;z-index:10;opacity:0"></div>
    `);
    let presses = 0;
    await expect(
      humanClick(page, page.getByRole("button", { name: "Target" }), "blocked target", {
        beforePress: () => {
          presses += 1;
        },
      }),
    ).rejects.toThrow("真人指针点不中");
    expect(presses).toBe(0);
    await expect(page.locator("output")).toHaveText("0");
  });

  test("reacquires a replaced control and scrolls its new position before pressing", async ({
    page,
  }) => {
    await page.setContent(`
      <style>body{margin:0;height:2200px}button{position:absolute;left:20px;top:80px;width:140px;height:48px}</style>
      <button>Target</button><output>0</output>
      <script>
        const button = document.querySelector('button');
        window.pointerProof = [];
        button.addEventListener('pointerenter', () => {
          const replacement = button.cloneNode(true);
          replacement.style.top = '1800px';
          replacement.addEventListener('click', event => {
            window.pointerProof.push(event.isTrusted);
            document.querySelector('output').textContent = String(window.pointerProof.length);
          });
          button.replaceWith(replacement);
        }, {once:true});
      </script>
    `);
    let presses = 0;
    await humanClick(page, page.getByRole("button", { name: "Target" }), "replacement", {
      beforePress: () => {
        presses += 1;
      },
    });
    await expect(page.locator("output")).toHaveText("1");
    expect(presses).toBe(1);
    expect(
      await page.evaluate(() => (window as unknown as { pointerProof: boolean[] }).pointerProof),
    ).toEqual([true]);
  });
});
