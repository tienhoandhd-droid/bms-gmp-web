// Real components + real preview CSS, isolated local state. No authenticated requests.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
const out='../output/playwright/bms-design-states';mkdirSync(out,{recursive:true});
const fixture=await build({stdin:{contents:`
import React from 'react';import{createRoot}from'react-dom/client';
import AuthGate from './src/AuthGate.jsx';
import{HopThoai}from'./src/components/ui/HopThoai.jsx';
import{ApprovalModal}from'./src/features/incidents/IncidentsParts.jsx';
const root=createRoot(document.getElementById('fixture'));
window.mountFixture=(kind)=>root.render(kind==='auth'?<AuthGate/>:kind==='approval'?<ApprovalModal incident={{id:'SC-1042',room:'C4.R7',sensor:'Chênh áp',trail:[]}} action={{label:'Tiếp nhận sự cố',next:'Đang xử lý'}} user={{name:'Người vận hành',role:'IPC'}} onClose={()=>{}} onCommit={async()=>{}}/>:<HopThoai tieuDe='Chi tiết hồ sơ' onDong={()=>{}} chanTrang={<button>Hoàn tất</button>}>{Array.from({length:40},(_,i)=><p key={i}>Dòng bằng chứng {i+1}: thông tin phục vụ kiểm tra hồ sơ.</p>)}</HopThoai>);
`,resolveDir:process.cwd(),loader:'jsx'},loader:{'.png':'dataurl'},bundle:true,write:false,format:'iife',define:{'import.meta.env':'{}'}});
const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const theme of ['light','dark']) for(const width of [1440,390]){
  await page.setViewport({width,height:844});
  await page.goto(process.argv[2]||'http://127.0.0.1:4190',{waitUntil:'networkidle0'});
  await page.evaluate(t=>{localStorage.setItem('bms-theme',t);document.documentElement.dataset.theme=t;document.body.innerHTML='<main id="fixture"></main>';},theme);
  await page.addScriptTag({content:fixture.outputFiles[0].text});
  for(const kind of ['auth','approval','long-dialog']){
   await page.evaluate(k=>window.mountFixture(k),kind);await new Promise(r=>setTimeout(r,100));
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme,'fixture must retain requested theme');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${kind} overflow at ${width}`);
   if(kind==='long-dialog'){
    const bounds=await page.$eval('[role=dialog]',e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,h:innerHeight}));
    assert.ok(bounds.top>=0&&bounds.bottom<=bounds.h,`long dialog exceeds viewport ${JSON.stringify(bounds)}`);
    await page.keyboard.press('Tab');
    const footer=await page.$eval('[role=dialog] button:last-child',e=>e.getBoundingClientRect().bottom);
    assert.ok(footer<=844,'long dialog footer clipped');
   }
   await page.screenshot({path:`${out}/${kind}-${theme}-${width}.png`,fullPage:true});
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS real AuthGate/ApprovalModal/long HopThoai: light+dark, 1440+390, no overflow/pageerror; long dialog bounded with visible footer');
}finally{await browser.close();}
