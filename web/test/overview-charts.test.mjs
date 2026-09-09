import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

test('overview exposes failing room charts and keyboard-accessible data without opening a modal', async t => {
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),logLevel:'error',server:{host:'127.0.0.1',strictPort:false},define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_ANON_KEY':'""'}});
  let browser;t.after(async()=>{await browser?.close();await server.close()});await server.listen();
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();
  await page.setViewport({width:390,height:844});await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?tab=home`,{waitUntil:'networkidle2'});
  assert.ok(await page.$('.bms-failing-charts'),'overview should display failing room charts');
  assert.equal(await page.$$eval('[data-room-chart]',nodes=>nodes.length),3,'demo has three failing rooms');
  await page.select('[aria-label="Chỉ tiêu phòng C4.R7"]','RH');
  await page.waitForFunction(()=>document.querySelector('[data-room-chart="C4.R7"] figure').getAttribute('aria-label').startsWith('Độ ẩm'));
  const summary=await page.$('[data-room-chart="C4.R7"] summary');await summary.focus();await page.keyboard.press('Enter');
  assert.equal(await page.$eval('[data-room-chart="C4.R7"] details',e=>e.open),true);
  assert.ok(await page.$eval('[data-room-chart="C4.R7"] table',e=>e.textContent.includes('Trung bình')));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute("aria-label")), "Xem chi tiết biểu đồ phòng C4.R7");
  await page.keyboard.press("Enter");
  await page.waitForSelector('[role="dialog"]');
});

test('overview empty, interrupted and loading states never imply a healthy room', async t => {
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),logLevel:'error',appType:'custom'});
  t.after(()=>server.close());
  const {default:React}=await import('react');
  const {renderToStaticMarkup}=await import('react-dom/server');
  const {default:Overview}=await server.ssrLoadModule('/src/components/overview/FailingRoomCharts.jsx');
  const render=props=>renderToStaticMarkup(React.createElement(Overview,props));
  assert.match(render({rooms:[]}),/trong số phòng đủ dữ liệu/);
  const lost=render({rooms:[],sourceInterrupted:true});assert.match(lost,/gián đoạn/);assert.doesNotMatch(lost,/Không có phòng không đạt/);
  assert.match(render({rooms:[],loading:true}),/Đang tải biểu đồ phòng/);
  assert.match(render({rooms:[],error:new Error('network')}),/Chưa tải được dữ liệu/);
  const rooms=Array.from({length:5},(_,i)=>({id:`C1.R${i}`,name:'Phòng',_isLive:true,_compliance:60,noData:false,sensors:[{k:'DP',min:10,max:30,_live:{hourly8:[]}}]}));
  const cards=render({rooms});
  assert.equal((cards.match(/data-room-chart=/g)||[]).length,4);
  assert.match(cards,/Min/);assert.match(cards,/Max/);
  assert.match(cards,/Nhóm phòng tiếp/);assert.match(cards,/Chưa có chuỗi số liệu/);
  const pending=render({rooms:[{...rooms[0],_historyState:'loading'}]});
  assert.match(pending,/Đang tải chuỗi số liệu/);assert.doesNotMatch(pending,/Chưa có chuỗi số liệu/);
  assert.match(render({rooms:[{...rooms[0],_historyState:'error'}]}),/Chưa tải được chuỗi số liệu/);
});
