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
  assert.equal(await page.$$eval('[data-room-chart]',nodes=>nodes.length),4,'demo includes the room whose current snapshot is unavailable');
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

test('historical charts remain visible when the current hourly snapshot is unavailable', async t => {
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),logLevel:'error',appType:'custom'});
  t.after(()=>server.close());
  const {default:React}=await import('react');
  const {renderToStaticMarkup}=await import('react-dom/server');
  const {default:Overview}=await server.ssrLoadModule('/src/components/overview/FailingRoomCharts.jsx');
  const staleRoom={
    id:'C1.R8', name:'Phòng có chuỗi cũ', _isLive:true, noData:true, duLieuCu:true,
    window:'08:00–09:00', lastSeen:'09/09 09:00',
    sensors:[{k:'DP',min:10,max:30,_live:{hourly8:[
      {label:'01:00',avg:19},{label:'02:00',avg:null},{label:'03:00',avg:31},
      {label:'04:00',avg:20},{label:'05:00',avg:21},{label:'06:00',avg:22},
      {label:'07:00',avg:23},{label:'08:00',avg:24},
    ]}}],
  };
  const html=renderToStaticMarkup(React.createElement(Overview,{rooms:[staleRoom],sourceInterrupted:true}));
  assert.match(html,/data-room-chart="C1.R8"/,'history must not disappear with an unavailable current snapshot');
  assert.match(html,/kỳ hiện tại chưa đánh giá/,'current status must remain uncertain');
  assert.match(html,/lịch sử 8 giờ gần nhất/,'chart scope must be explicit even when a last snapshot window exists');
  assert.doesNotMatch(html,/>100%<|>Đạt</,'a stale snapshot must never be presented as a current pass');
  assert.match(html,/Thiếu số liệu/,'null hourly gaps remain explicit in the accessible table');
  const {OosTheoGio8h}=await server.ssrLoadModule('/src/features/dashboard/DashboardParts.jsx');
  const oosHtml=renderToStaticMarkup(React.createElement(OosTheoGio8h,{room:{...staleRoom,_hourlyOOS:[{label:'08:00',oos:0}]}}));
  assert.match(oosHtml,/0 điểm OOS trong lịch sử 8h/);
  assert.doesNotMatch(oosHtml,/· đạt/,'historical OOS must not imply current pass');
});

test('room drawer keeps 8h history but hides current values during source interruption', async t => {
  const source = `import React from 'react'; import {createRoot} from 'react-dom/client'; import {RoomDetailModal} from '/src/features/dashboard/DashboardParts.jsx';
    const room={id:'C1.R8',name:'Lịch sử 8h',_isLive:true,noData:false,sensors:[{k:'DP',min:10,max:30,_live:{cur:99,avg1h:99,oos1h:0,err10:0,hourly8:[{label:'08:00',avg:21},{label:'09:00',avg:22}]}}],_hourlyOOS:[{label:'08:00',oos:0}]};
    createRoot(document.getElementById('root')).render(<RoomDetailModal room={room} cfg={{}} sourceInterrupted={true} onClose={()=>{}}/>);`;
  const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),logLevel:'error',plugins:[{
    name:'drawer-test-fixture',resolveId(id){if(id==='/drawer-fixture.jsx')return id},load(id){if(id==='/drawer-fixture.jsx')return source},
    configureServer(s){s.middlewares.use('/drawer-fixture.html',async (_req,res)=>{res.setHeader('content-type','text/html');res.end(await s.transformIndexHtml('/drawer-fixture.html','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/drawer-fixture.jsx"></script></body></html>'))})}
  }],server:{host:'127.0.0.1',strictPort:false}});
  let browser;t.after(async()=>{await browser?.close();await server.close()});await server.listen();
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();
  page.on('pageerror',e=>console.error('drawer fixture:',e.message));
  await page.setViewport({width:390,height:844});await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/drawer-fixture.html`,{waitUntil:'networkidle2'});
  await page.waitForSelector('[role="dialog"]');
  const body=await page.$eval('[role="dialog"]',e=>e.textContent);
  assert.match(body,/Nguồn dữ liệu gián đoạn/);
  assert.doesNotMatch(body,/99|· đạt/,'current readings and verdicts must not leak through the detail drawer');
  assert.match(body,/TB 8h/);assert.match(body,/21.5/,'historical mean remains visible');
});
