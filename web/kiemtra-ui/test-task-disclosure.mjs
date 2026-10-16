import assert from 'node:assert/strict';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
const fixture = await build({stdin:{contents:`
import React from 'react'; import {createRoot} from 'react-dom/client';
import ViecCuaBan from './src/features/tasks/ViecCuaBan.jsx';
createRoot(document.getElementById('fixture')).render(<ViecCuaBan viecCuaToi={[{q:{ma_su_co:'SC-1'},inc:{id:'SC-1',room:'C1.R1',sensor:'DP'}}]} cumChoToi={[]} onXuLy={()=>{}} onGhiKetLuan={()=>{}}/>);
`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',define:{'import.meta.env':'{}'}});
const browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();await page.goto(process.argv[2]||'http://127.0.0.1:4190');
 await page.evaluate(()=>{document.body.innerHTML='<main id="fixture"></main>';});
 await page.addScriptTag({content:fixture.outputFiles[0].text});
 await page.waitForSelector('#fixture button');
 const triggers=await page.$$('#fixture button[aria-controls][aria-expanded]');
 assert.equal(triggers.length,1,'one named disclosure trigger must describe expansion');
 const trigger=triggers[0]; await trigger.focus();await page.keyboard.press('Enter');
 assert.equal(await trigger.evaluate(e=>e.getAttribute('aria-expanded')),'false');
 assert.equal(await trigger.evaluate(e=>document.getElementById(e.getAttribute('aria-controls')).hidden),true);
 await page.keyboard.press('Enter');
 assert.equal(await trigger.evaluate(e=>e.getAttribute('aria-expanded')),'true');
 assert.equal(await trigger.evaluate(e=>e.getBoundingClientRect().height>=44),true);
 console.log('PASS Task disclosure: single keyboard trigger, state and controlled content match, 44px target');
}finally{await browser.close();}
