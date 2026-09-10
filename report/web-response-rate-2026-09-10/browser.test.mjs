import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire}from'node:module';
const require=createRequire(process.cwd()+'/web/package.json');
const fixture='web/.response-report-preview.html';
await fs.mkdir('output/web-response-rate-2026-09-10',{recursive:true});
await fs.writeFile(fixture,`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const {default:React}=await import('/node_modules/.vite/deps/react.js');const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');const {createRoot}=ReactDOM;const {default:Report}=await import('/src/features/reports/ResponseRateReport.jsx');const M=await import('/src/features/reports/responseRateModel.js');await import('/src/index.css');await import('/src/theme/product.css');
const root=createRoot(document.getElementById('root'));const latest=M.latestCompletedWeek();window.latest=latest;
const rows=[{role:'IPC',denominator:4,responded:3,rate_pct:75},{role:'MEP',denominator:2,responded:1,rate_pct:50},{role:'LOT',denominator:5,responded:2,rate_pct:40},{role:'QA',denominator:0,responded:0,rate_pct:null}];
window.paint=(state='ready',period=latest)=>{const prev=M.shiftResponseWeek(period,-1);root.render(React.createElement(Report,{isLive:true,start:period.start,end:period.end,loading:state==='loading',error:state==='error'?'Lỗi thử nghiệm':null,onRetry:()=>window.paint(),onChangePeriod:p=>window.paint('ready',p),data:{periods:[{...period,rows:state==='empty'?rows.map(r=>({...r,denominator:0,responded:0,rate_pct:null})):rows,details:[],has_legacy:state==='legacy'},{...prev,rows:state==='empty'?[]:rows.map(r=>({...r,responded:0,rate_pct:r.denominator?0:null})),details:[]}]}}));};window.paint();
</script></body></html>`);
const browser=await require('puppeteer').launch({headless:true,args:['--no-sandbox']});
try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
for(const [name,width]of [['desktop',1366],['mobile',390],['print',794]]){
await page.setViewport({width,height:1000});await page.emulateMediaType(name==='print'?'print':'screen');await page.goto('http://127.0.0.1:5178/.response-report-preview.html');await page.waitForSelector('table',{timeout:8000});
assert.match(await page.$eval('body',e=>e.textContent),/So sánh với tuần trước/);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,name+' page overflow');
await page.screenshot({path:'output/web-response-rate-2026-09-10/'+name+'.png',fullPage:true});
}
assert.equal((await page.$$('[data-legacy-note]')).length,0);await page.evaluate(()=>window.paint('legacy'));await page.waitForSelector('[data-legacy-note]');
await page.emulateMediaType('screen');await page.setViewport({width:1366,height:1000});await page.evaluate(()=>window.paint('empty'));await page.waitForFunction(()=>document.body.textContent.includes('Chưa có lượt gửi'));
assert.ok(await page.$('button[aria-label="Xem tuần trước"]'));await page.click('button[aria-label="Xem tuần trước"]');await page.waitForSelector('table',{timeout:8000});assert.equal(await page.$eval('button[aria-label="Xem tuần kế tiếp"]',e=>e.disabled),false);await page.click('button[aria-label="Xem tuần kế tiếp"]');await page.waitForFunction(()=>document.querySelector('button[aria-label="Xem tuần kế tiếp"]').disabled);
await page.evaluate(()=>window.paint('error'));await page.waitForSelector('[role="alert"]');assert.equal((await page.$$('table')).length,0);
await page.evaluate(()=>window.paint('loading'));await page.waitForSelector('[role="status"]');assert.equal((await page.$$('table')).length,0);
assert.deepEqual(errors,[]);console.log('PASS desktop/mobile/print; previous-next navigation, empty, error, loading.');
}finally{await browser.close();await fs.rm(fixture,{force:true});}
