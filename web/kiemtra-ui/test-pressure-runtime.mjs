// Kiểm tra runtime có fixture: dùng CSS của preview đang chạy, không gọi dữ liệu thật.
import { build } from "esbuild";
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(WEB, "..", "output", "playwright");
mkdirSync(OUT, { recursive: true });

const fixture = `
  import React from "react";
  import { createRoot } from "react-dom/client";
  import ChenhApTheoAhu from "../src/features/pressure/ChenhApTheoAhu.jsx";
  createRoot(document.getElementById("root")).render(<ChenhApTheoAhu isLive active />);
`;

const mock = {
  card: `import React from "react"; export const Card=({children,className})=><section className={className}>{children}</section>; export const SectionTitle=({children})=><h2>{children}</h2>;`,
  drawer: `import React from "react"; export default function InspectorDrawer({title,children,onClose}) { return <aside role="dialog" aria-label={title}><button type="button" onClick={onClose}>Đóng</button><h2>{title}</h2>{children}</aside>; }`,
  range: `import React from "react"; export default function PressureRange(){return <div>Thước chênh áp</div>;}`,
  perms: `export const DS_KHU=["A"];`,
  data: `const row={ahu:"AHU-01",maPhong:"A.101",tenPhong:"Phòng pha chế",khuVuc:"A",uuTien:"P1",ghDuoi:10,ghTren:15,donVi:"Pa",giaTri:12,thoiDiem:"10:30",tuoiPhut:0,realtime:true,chuoi:[{t:"09:55",v:11},{t:"10:00",v:12},{t:"10:05",v:12},{t:"10:10",v:11},{t:"10:15",v:12},{t:"10:20",v:12},{t:"10:25",v:13},{t:"10:30",v:12}],dat:true,coDuLieu:true}; export const layChenhApTheoAhu=async()=>({error:null,rows:[row]}); export const layCamBienDungHinh=async()=>({error:null,rows:[]}); export const capNhatPhut8h=async()=>({ok:false}); export const chamNguoiXemChenhAp=async()=>({ok:true}); export const dungXemChenhAp=async()=>({ok:true}); export const dangKyRealtimeChenhAp=()=>()=>{};`,
  session: `export const createPressureViewerId=()=>"fixture"; export const isPressureViewerActive=()=>true; export const createPressureViewerSession=()=>({setActive:async()=>{},dispose:async()=>{}});`,
  tokens: `export const COLOR={};`,
};

const aliases = new Map([
  ["../../components/ui/Card", mock.card], ["../../components/layout/InspectorDrawer", mock.drawer],
  ["../../components/pressure/PressureRange", mock.range], ["../../lib/phanQuyen", mock.perms],
  ["../../lib/supabaseData", mock.data], ["./pressureViewerSession", mock.session], ["../../lib/designTokens", mock.tokens],
]);
console.log("· biên dịch fixture chênh áp");
const bundle = await build({
  stdin: { contents: fixture, resolveDir: resolve(WEB, "kiemtra-ui"), loader: "jsx" }, bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
  plugins: [{ name: "fixture", setup(buildApi) { buildApi.onResolve({ filter: /.*/ }, (args) => aliases.has(args.path) ? { path: args.path, namespace: "fixture" } : null); buildApi.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: aliases.get(args.path), loader: "jsx", resolveDir: WEB })); } }],
});
console.log("· mở trình duyệt fixture");
const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4190/?tab=recent", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { document.body.innerHTML = '<div id="root"></div>'; });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.waitForSelector('button', { timeout: 5000 });
  let button = null;
  for (const candidate of await page.$$('button')) {
    if (await candidate.evaluate((node) => node.textContent.includes("Xem chi tiết"))) { button = candidate; break; }
  }
  if (!button) throw new Error("Không render được nút xem chi tiết");
  const buttonBox = await button.boundingBox();
  if (!buttonBox || buttonBox.height < 44) throw new Error(`Nút xem chi tiết chỉ cao ${buttonBox?.height || 0}px`);
  const region = await page.$('[role="region"]');
  await region.focus();
  const overflow = await region.evaluate((el) => ({ focused: document.activeElement === el, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }));
  if (!overflow.focused || overflow.scrollWidth <= overflow.clientWidth) throw new Error(`Vùng chuỗi không focusable/cuộn được: ${JSON.stringify(overflow)}`);
  await page.screenshot({ path: resolve(OUT, "pressure-fixture-mobile.png"), fullPage: true });
  await button.focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector('[role="dialog"]', { timeout: 1000 });
  const drawer = await page.$eval('[role="dialog"]', (el) => el.textContent);
  if (!drawer.includes("A.101")) throw new Error("Bấm bàn phím không mở chi tiết phòng fixture");
  await page.screenshot({ path: resolve(OUT, "pressure-fixture-detail-mobile.png"), fullPage: true });
  console.log(`✓ pressure runtime: button ${Math.round(buttonBox.height)}px; scroll ${overflow.clientWidth}/${overflow.scrollWidth}px; Enter mở chi tiết`);
} finally {
  await browser.close();
}
