import { expect, test } from "@playwright/test";
import { prototypeClick } from "./prototype-click.js";

async function mount(page: import("@playwright/test").Page, shift = false) {
  await page.setContent(
    '<iframe sandbox="allow-scripts" style="width:700px;height:420px;border:0"></iframe>',
  );
  await page.locator("iframe").evaluate((element, moving) => {
    element.srcdoc = `<button style="position:absolute;left:80px;top:100px;width:160px;height:50px">Target</button><output>0</output>
      <script>const button=document.querySelector('button');window.events=[];
      for(const type of ['pointerdown','pointerup','click']) button.addEventListener(type,e=>{
        window.events.push([e.type,e.isTrusted]);if(type==='click')document.querySelector('output').textContent='1';
      });
      ${moving ? "button.addEventListener('pointerenter',()=>{button.style.left='380px'}, {once:true});" : ""}
      </script>`;
  }, shift);
  const frame = page.frameLocator("iframe");
  await expect(frame.getByRole("button")).toBeVisible();
  return frame;
}

test("prototype pointer follows a pre-press hover shift and emits one trusted click", async ({
  page,
}) => {
  const frame = await mount(page, true);
  await prototypeClick(page, frame.getByRole("button"));
  await expect(frame.locator("output")).toHaveText("1");
  expect(await frame.locator("body").evaluate(() => (window as any).events)).toEqual([
    ["pointerdown", true],
    ["pointerup", true],
    ["click", true],
  ]);
});

test("prototype pointer cannot pass through an invisible parent overlay", async ({ page }) => {
  const frame = await mount(page);
  await page.evaluate(() => {
    const cover = document.createElement("div");
    cover.style.cssText = "position:fixed;inset:0;z-index:100;opacity:0";
    document.body.append(cover);
  });
  await expect(prototypeClick(page, frame.getByRole("button"))).rejects.toThrow();
  await expect(frame.locator("output")).toHaveText("0");
});

test("prototype pointer cannot pass through an invisible child overlay", async ({ page }) => {
  const frame = await mount(page);
  await frame.locator("body").evaluate(() => {
    const cover = document.createElement("div");
    cover.style.cssText = "position:fixed;inset:0;z-index:100;opacity:0";
    document.body.append(cover);
  });
  await expect(prototypeClick(page, frame.getByRole("button"))).rejects.toThrow();
  await expect(frame.locator("output")).toHaveText("0");
});
