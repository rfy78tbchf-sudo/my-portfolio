import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
let source=readFileSync('tests/refresh_critical_path253.mjs','utf8');
const anchor=`await page.locator('#nav [data-tab="performance"]').click();`;
source=source.replace(anchor,anchor+`\n    await page.locator('[data-performance-scope="stocks"]').click();`);
source=source.replace('width:390,height:844','width:402,height:844');
source=source.replace('const expected=90000+generation*10000;',`const expected=90000+generation*10000;
        await page.evaluate(()=>{document.body.style.zoom='1.25';document.querySelector('.pnl-coverage').open=true;window.scrollTo(0,400)});
        const beforeScroll=await page.evaluate(()=>window.scrollY);assert.ok(beforeScroll>100);`);
source=source.replace('const metrics=await page.evaluate',`assert.ok(Math.abs((await page.evaluate(()=>window.scrollY))-beforeScroll)<=1,'preserved scroll after nested refresh');
        assert.equal(await page.locator('.pnl-coverage').evaluate(e=>e.open),true,'expanded evidence preserved');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'125% horizontal overflow');
        const metrics=await page.evaluate`);
const file='tests/.scroll-browser-'+randomUUID()+'.mjs';
try{writeFileSync(file,source);execFileSync(process.execPath,[file],{env:{...process.env,RUNS:'1',PERIODS:'1W,1M,3M,ALL',CONDITIONS:'none',HOLDINGS:'50'},stdio:['ignore','ignore','inherit']});console.log('Build255 scroll and expanded evidence retained at 402px/125%, four periods')}finally{unlinkSync(file)}
