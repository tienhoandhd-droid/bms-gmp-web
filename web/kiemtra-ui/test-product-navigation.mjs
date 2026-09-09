import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const base = process.argv[2] || 'http://127.0.0.1:4190';
const browser = await puppeteer.launch({headless:true,args:['--no-sandbox']});
const errors=[];
async function check(name,run){try{await run();console.log('PASS '+name);}catch(e){errors.push(name+': '+e.message);console.error('FAIL '+name+': '+e.message);}}
try {
  const page=await browser.newPage();
  await page.setViewport({width:390,height:844});
  await page.goto(base+'/?tab=home',{waitUntil:'networkidle0'});
  await check('Mobile: tasks is one tap away and every navigation target is 44px',async()=>{
    const nav=await page.$('nav[aria-label="Điều hướng nhanh"]');
    const items=await nav.$$eval('button',els=>els.map(e=>({name:e.textContent,height:e.getBoundingClientRect().height})));
    assert.ok(items.some(x=>x.name.includes('Việc cần làm')),'tasks absent from quick navigation');
    assert.ok(items.every(x=>x.height>=44),'small mobile target');
  });
  await page.setViewport({width:1440,height:900});
  await page.goto(base+'/?tab=events',{waitUntil:'networkidle0'});
  await check('Find an incident from email, empty result and clear filter restore the list',async()=>{
    const input=await page.$('input[aria-label="Tìm sự cố"]');
    assert.ok(input,'missing incident search');
    await input.type('SC-1042');
    await page.waitForFunction(()=>document.querySelector('main').innerText.includes('1/6 sự cố'));
    assert.ok(await page.$eval('main',e=>e.innerText.includes('SC-1042')));
    await input.click({clickCount:3});await input.type('NO-MATCH-98273');
    await page.waitForFunction(()=>document.querySelector('main').innerText.includes('Không có sự cố khớp'));
    const clear=await page.$('button[aria-label="Xóa bộ lọc sự cố"]');
    assert.ok(clear,'missing reset');await clear.click();
    await page.waitForFunction(()=>document.querySelector('main').innerText.includes('6/6 sự cố'));
    assert.equal(await input.evaluate(e=>e.value),'');
  });
  await check('Keyboard navigation moves focus to the destination heading and browser Back restores tab',async()=>{
    const button=await page.$('nav[aria-label="Điều hướng chính"] button[aria-label="Tổng quan"]');
    assert.ok(button,'collapsed navigation accessible name missing');
    await button.focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.activeElement?.tagName==='H1');
    assert.equal(await page.$eval('h1',e=>e.textContent),'Tổng quan');
    await page.goBack();await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Sự cố');
  });
  await check('Browser Back keeps focus inside an open dialog',async()=>{
    await page.goto(base+'/?tab=home',{waitUntil:'networkidle0'});
    await page.click('nav[aria-label="Điều hướng chính"] button[aria-label="Sự cố"]');
    await page.click('button[aria-label="Đăng nhập"]');
    await page.waitForSelector('[role="dialog"]');
    await page.goBack();
    await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Tổng quan');
    await new Promise(r=>setTimeout(r,100));
    assert.ok(await page.$eval('[role="dialog"]',e=>e.contains(document.activeElement)),'page heading stole focus from the dialog');
    await page.keyboard.press('Escape');
  });
  await check('Reduced motion stops loading pulse',async()=>{
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
    const duration=await page.evaluate(()=>{const e=document.createElement('div');e.className='animate-pulse';document.body.append(e);const d=getComputedStyle(e).animationDuration;e.remove();return d;});
    assert.ok(parseFloat(duration)<=0.01,'pulse still animates: '+duration);
  });
}finally{await browser.close();}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
