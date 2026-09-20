/** Export the actual map adapters' normalized mesh data for offline experiments.
 * Start this checkout's preview, then: node scripts/export-prop-finish.mjs
 * Does not modify model sources or course data. One explicit loopback origin.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const origin=process.argv[2]??'http://127.0.0.1:23220';
const output=resolve(process.argv[3]??'.scratch/prop-finish/input.json');
const url=new URL(origin);if(url.hostname!=='127.0.0.1' || url.protocol!=='http:')throw new Error('Use the explicit local worktree preview');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1050},storageState:{cookies:[],origins:[{origin,localStorage:[{name:'university.welcome.v1',value:'acknowledged'}]}]}});
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${origin}/play-lab/prop-finish?export=1&method=original&lang=zh-CN`);
 await page.waitForFunction(()=>document.querySelector('[data-testid="finish-viewport"] canvas')?.__propFinish?.().loaded===10,{},{timeout:90000});
 const objects=await page.locator('[data-testid="finish-viewport"] canvas').evaluate(n=>n.__exportMapProps());
 if(errors.length)throw new Error(errors.join('\n'));
 await mkdir(dirname(output),{recursive:true});
 await writeFile(output,JSON.stringify({version:1,objects},null,2));
 console.log(JSON.stringify(objects.map(o=>({id:o.sample.id,parts:o.parts.length,triangles:o.parts.reduce((n,p)=>n+p.geometry.index.length/3,0),signature:o.sourceSignatures}))));
} finally {await browser.close();}
