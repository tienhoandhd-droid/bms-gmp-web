// TrendPage.jsx — trang Xu hướng (tách move-only từ App.jsx 17/08/2026).
import { AiSections } from "./AiSections";
import InspectorDrawer from "../../components/layout/InspectorDrawer";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, AlertOctagon, AlertTriangle, Check, CheckCircle2, ChevronDown, CircleDot, FileBarChart, Gauge, LineChart as LineIcon, Mail, Minus, Printer, Save, Search, Sparkles, TrendingDown, TrendingUp, Wifi } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import Chart from "../../components/ui/Chart";
import { KpiCard } from "../../components/ui/KpiCard";
import { COLOR, COMPLY_BAD, COMPLY_OK, SENSOR_COLOR, fmtPct } from "../../lib/designTokens";
import { deltaTone, fmtDelta, fmtH, toLocalInput } from "../../lib/dinhDang";
import { MASTER, RANGES, SCOPE_LEVELS, SENSORS, applySensor, byType, findScope, getSeries } from "../../lib/moPhong";
import { guiNhanDinhXuHuong, layChuoiGiaTriPhong, layChuoiXuHuong, layChuoiXuHuongChiTiet, layChuoiXuHuongDaSensor, layDuBaoXuHuong, layMaTranPhongNgay, layNguoiNhanBaoCao, layPhanTichSau, layQuetBatThuong, layWebhookAi, layWebhookAiSau, layWebhookWf7b, phanTichAiQuaWorkflow } from "../../lib/supabaseData";
import { SENSOR_META } from "../../lib/uiConst";
/* ===== XU HƯỚNG ===== */
// Thống kê hồi quy tuyến tính cho 1 chuỗi số: trung bình, độ lệch chuẩn, độ dốc/điểm, R², min, max
function regStat(ys) {
  const n = ys.length;
  if (!n) return { n: 0 };
  const mean = ys.reduce((a, v) => a + v, 0) / n;
  const std = Math.sqrt(ys.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
  let slope = 0, r2 = 0;
  if (n >= 2) {
    const xm = (n - 1) / 2; let sxy = 0, sxx = 0, syy = 0;
    ys.forEach((y, i) => { sxy += (i - xm) * (y - mean); sxx += (i - xm) ** 2; syy += (y - mean) ** 2; });
    slope = sxx ? sxy / sxx : 0; r2 = (sxx && syy) ? (sxy * sxy) / (sxx * syy) : 0;
  }
  return { n, mean, std, slope, r2, vmin: Math.min(...ys), vmax: Math.max(...ys) };
}


// In tab Xu hướng thành BÁO CÁO A4 chuẩn form: biểu đồ ECharts (canvas) được
// XUẤT THÀNH ẢNH (getDataURL, loại toolbox/dataZoom) — nếu chỉ copy innerHTML thì
// canvas ra TRẮNG. Giữ nguyên CSS ứng dụng để thẻ đẹp; thêm khổ giấy A4 + tiêu đề.
function printTrend(meta = {}) {
  try {
    const node = document.getElementById("trendPrintArea");
    if (!node) { window.print(); return; }
    const reg = window.__bmsEcharts;
    const instForCanvas = (canvas) => { let el = canvas.parentElement; while (el) { if (reg && reg.has(el)) return reg.get(el); el = el.parentElement; } return null; };
    // 1) Chụp từng canvas → ảnh (sạch, độ nét gấp đôi)
    const srcCanvases = Array.from(node.querySelectorAll("canvas"));
    const shots = srcCanvases.map((c) => {
      const w = c.clientWidth || c.width;
      try {
        const inst = instForCanvas(c);
        const url = inst ? inst.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fff", excludeComponents: ["toolbox", "dataZoom"] }) : c.toDataURL("image/png");
        return { url, w };
      } catch { try { return { url: c.toDataURL("image/png"), w }; } catch { return null; } }
    });
    // 2) Nhân bản vùng in, thay canvas bằng <img>
    const clone = node.cloneNode(true);
    Array.from(clone.querySelectorAll("canvas")).forEach((c, i) => {
      const s = shots[i];
      if (s && s.url) { const img = document.createElement("img"); img.src = s.url; img.style.width = "100%"; img.style.maxWidth = (s.w || 640) + "px"; img.style.height = "auto"; img.style.display = "block"; c.replaceWith(img); }
    });
    // 3) Giữ nguyên CSS ứng dụng (link tuyệt đối + style inline) để thẻ hiển thị đẹp
    const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => `<link rel="stylesheet" href="${l.href}">`).join("\n");
    const styleTags = Array.from(document.querySelectorAll("style")).map((n) => n.outerHTML).join("\n");
    const logo = document.querySelector('img[alt="CPC1 Hà Nội"]');
    const logoSrc = logo ? logo.src : "";
    const now = new Date().toLocaleString("vi-VN");
    const phamVi = meta.phamVi || meta.scope || "";
    const detail = [meta.sensor ? `Chỉ tiêu: ${meta.sensor}` : "", meta.range ? `Khoảng: ${meta.range}` : "", meta.res ? `Độ phân giải: ${meta.res}` : "", meta.window ? `Cửa sổ thời gian: ${meta.window}` : ""].filter(Boolean).join(" · ");
    const win = window.open("", "PRINT", "height=900,width=1200");
    // KHÔNG rơi về window.print() (sẽ in CẢ trang gồm tìm kiếm/xếp hạng) — báo người dùng cho phép pop-up.
    if (!win) { try { alert("Trình duyệt đang chặn cửa sổ in. Hãy CHO PHÉP pop-up cho trang này rồi bấm In lại — báo cáo chỉ in phần nội dung (không kèm tìm kiếm/xếp hạng)."); } catch (_) { /* bỏ qua */ } return; }
    win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo xu hướng GMP — ${meta.scope || ""}</title>
${linkTags}
${styleTags}
<style>
  @page { size: A4 portrait; margin: 12mm 10mm; }
  html, body { background:#fff !important; }
  body { font-family: Inter, 'Segoe UI', sans-serif; color:#102A3E; -webkit-print-color-adjust:exact; print-color-adjust:exact; margin:0; }
  .rp-wrap { max-width: 190mm; margin: 0 auto; }
  .rp-head { display:flex; align-items:center; gap:12px; border-bottom:2px solid #0E7C73; padding-bottom:10px; margin-bottom:14px; }
  .rp-head img { height:46px; width:auto; }
  .rp-title { font-size:15px; font-weight:800; color:#102A3E; line-height:1.25; }
  .rp-sub { font-size:10.5px; color:#5f7a90; margin-top:3px; }
  .rp-scope { font-size:12.5px; font-weight:800; color:#102A3E; margin-top:5px; letter-spacing:.2px; }
  .rp-scope b { color:#0E7C73; }
  .rp-meta { font-size:10.5px; color:#5f7a90; font-weight:600; margin-top:2px; }
  #trendPrintArea { display:block !important; }
  #trendPrintArea > * { break-inside: avoid; page-break-inside: avoid; margin-bottom:12px; }
  /* Bảng cuộn → in đầy đủ */
  .max-h-72, .max-h-32 { max-height:none !important; overflow:visible !important; }
  .overflow-auto, .overflow-x-auto, .overflow-y-auto { overflow:visible !important; }
  table { width:100%; border-collapse:collapse; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  img { break-inside: avoid; }
  .rp-foot { margin-top:10px; padding-top:8px; border-top:1px solid #e2e8f0; font-size:9.5px; color:#94a3b8; text-align:center; }
</style></head>
<body><div class="rp-wrap">
  <div class="rp-head">${logoSrc ? `<img src="${logoSrc}" alt="logo"/>` : ""}<div><div class="rp-title">CÔNG TY CPC1 HÀ NỘI — Giám sát môi trường HVAC phòng sạch GMP</div><div class="rp-sub">BÁO CÁO XU HƯỚNG · xuất lúc ${now}</div>${phamVi ? `<div class="rp-scope">PHẠM VI IN: <b>${phamVi}</b></div>` : ""}${detail ? `<div class="rp-meta">${detail}</div>` : ""}</div></div>
  ${clone.outerHTML}
  <div class="rp-foot">Số liệu tất định do hệ thống tính (giới hạn GHD/GHT theo phòng trong CSDL). Nhận định tự động chỉ dùng để tham khảo. IPC/QA chịu trách nhiệm đánh giá và kết luận GMP.</div>
</div>
<scr` + `ipt>window.onload=function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},450);};</scr` + `ipt>
</body></html>`);
    win.document.close(); win.focus();
  } catch (e) { try { window.print(); } catch (_) { /* bỏ qua */ } }
}


// ====== COMBOBOX TÌM KIẾM (kiểu web bán hàng) cho chọn đối tượng ======
// Gõ để lọc; danh sách thả xuống có highlight, %đạt, khu/AHU; chọn bằng chuột hoặc bàn phím.
function ScopeCombobox({ items, value, onPick, placeholder, levelLabel }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState(null);
  const boxRef = useRef(null);
  const listRef = useRef(null);
  const cur = items.find((o) => o.id === value) || null;

  // click ngoài: bỏ qua cả ô input (boxRef) lẫn danh sách trong portal (listRef)
  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && boxRef.current.contains(e.target)) return;
      if (listRef.current && listRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // tính vị trí cố định của danh sách theo ô input; cập nhật khi mở / cuộn / đổi kích thước
  useEffect(() => {
    if (!open) return;
    const upd = () => { if (boxRef.current) { const r = boxRef.current.getBoundingClientRect(); setPos({ left: r.left, top: r.bottom + 6, width: r.width }); } };
    upd();
    window.addEventListener("scroll", upd, true);
    window.addEventListener("resize", upd);
    return () => { window.removeEventListener("scroll", upd, true); window.removeEventListener("resize", upd); };
  }, [open]);
  useEffect(() => { setHi(0); }, [q, open]);

  const ql = q.trim().toLowerCase();
  const filtered = ql ? items.filter((o) => `${o.id} ${o.name}`.toLowerCase().includes(ql)) : items;

  const pick = (o) => { if (!o) return; onPick(o.id); setOpen(false); setQ(""); };
  const onKey = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) { setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(filtered[hi]); }
    else if (e.key === "Escape") { setOpen(false); }
  };
  useEffect(() => {
    if (open && listRef.current) { const el = listRef.current.querySelector(`[data-i="${hi}"]`); if (el) el.scrollIntoView({ block: "nearest" }); }
  }, [hi, open]);

  const pctColor = (p) => (p == null ? "#94a3b8" : p < 70 ? COMPLY_BAD : p < 88 ? "#d99a2b" : COMPLY_OK);
  const hl = (text) => {
    if (!ql) return text;
    const i = text.toLowerCase().indexOf(ql);
    if (i < 0) return text;
    return (<>{text.slice(0, i)}<mark className="bg-warning-soft/70 text-inherit rounded px-0.5">{text.slice(i, i + ql.length)}</mark>{text.slice(i + ql.length)}</>);
  };

  return (
    <div className="relative flex-1 min-w-[260px]" ref={boxRef}>
      <div className={`flex items-center gap-2 rounded-xl bg-surface px-3 py-2 ring-1 ${open ? "ring-2 ring-success-line" : "ring-line"} transition`}>
        <Search className="w-4 h-4 text-muted shrink-0" strokeWidth={1.8} />
        <input
          value={open ? q : (cur ? `${cur.id} — ${cur.name}` : q)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="w-full text-[13px] text-body outline-none bg-transparent placeholder:text-muted"
        />
        {cur && cur.latest && cur.latest.compliance != null && !open && (
          <span className="text-[12px] font-semibold tabular-nums shrink-0" style={{ color: pctColor(cur.latest.compliance) }}>{fmtPct(cur.latest.compliance)}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-muted shrink-0 transition cursor-pointer ${open ? "rotate-180" : ""}`} strokeWidth={1.8} onClick={() => setOpen((v) => !v)} />
      </div>
      {open && pos && createPortal(
        <div ref={listRef} style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width, zIndex: 9999 }} className="max-h-72 overflow-auto rounded-2xl bg-surface ring-1 ring-line shadow-2xl shadow-slate-400/30 py-1.5">
          <div className="px-3 py-1 text-[12px] uppercase tracking-wider text-muted font-semibold flex items-center justify-between"><span>{levelLabel}</span><span>{filtered.length} kết quả</span></div>
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-[12px] text-muted">Không tìm thấy — thử từ khoá khác</div>
          ) : filtered.map((o, i) => {
            const p = o.latest && o.latest.compliance != null ? o.latest.compliance : null;
            const isSel = o.id === value;
            return (
              <button key={o.id} data-i={i} onMouseEnter={() => setHi(i)} onClick={() => pick(o)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 ${i === hi ? "bg-success-soft" : ""} ${isSel ? "bg-success-soft/60" : ""}`}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: pctColor(p) }} />
                <span className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>{hl(o.id)}</span>
                  <span className="text-[13px] text-muted"> — {hl(o.name)}</span>
                  {(o.area || o.ahu) && <span className="block text-[12px] text-muted truncate">{[o.area, o.ahu].filter(Boolean).join(" · ")}</span>}
                </span>
                {p != null && <span className="text-[12px] font-semibold tabular-nums shrink-0" style={{ color: pctColor(p) }}>{fmtPct(p)}</span>}
                {isSel && <Check className="w-3.5 h-3.5 text-success shrink-0" strokeWidth={2.2} />}
              </button>
            );
          })}
        </div>, document.body)}
    </div>
  );
}

function TrendPage({ onAI, isLive = false, liveRisk = null, liveRooms = null, liveIncidents = null, khuChoPhep = null, onSaveAI = null }) {
  // Ghi nhớ lựa chọn giữa các lần vào (localStorage) — chỉ lưu tuỳ chọn nhẹ, không lưu dữ liệu.
  const LS_KEY = "bms_trend_prefs";
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } })();
  const [range, setRange] = useState(["1n", "7n", "30n", "90n", "180n"].includes(prefs.range) ? prefs.range : "30n");
  const [level, setLevel] = useState(["TOTAL", "AREA", "AHU", "ROOM"].includes(prefs.level) ? prefs.level : "TOTAL");
  const [selId, setSelId] = useState("");
  const [sensor, setSensor] = useState(["ALL", "DP", "RH", "T"].includes(prefs.sensor) ? prefs.sensor : "ALL");
  const [resOverride, setResOverride] = useState(["GIO"].includes(prefs.res) ? prefs.res : null); // độ phân giải khung dưới-ngày (chỉ còn GIO sau khi bỏ 30 phút)
  const [optArea, setOptArea] = useState("ALL");
  const [optAhu, setOptAhu] = useState("ALL");
  const [dtFrom, setDtFrom] = useState("");
  const [dtTo, setDtTo] = useState("");
  const [dtFromDraft, setDtFromDraft] = useState("");
  const [dtToDraft, setDtToDraft] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [diemChon, setDiemChon] = useState(null);   // G3: điểm được click trên biểu đồ chính → inspector
  const [aiBusy, setAiBusy] = useState(false);        // đang gọi AI qua workflow
  const [dangInBaoCao, setDangInBaoCao] = useState(false); // đang chuẩn bị in (chờ AI xong)
  const [aiNote, setAiNote] = useState(null);         // ghi chú trạng thái (vd: lỗi → dùng bản cục bộ)
  const [aiWebhook, setAiWebhook] = useState("");     // URL WF7 (nếu cấu hình)
  const [aiWebhookSau, setAiWebhookSau] = useState(""); // URL WF7-sâu (phân tích chuyên sâu)
  const [wf7bUrl, setWf7bUrl] = useState("");         // URL WF7b — gửi email / lưu Drive nhận định
  const [emailTo, setEmailTo] = useState("");         // người nhận email (điền sẵn từ người nhận báo cáo)
  const [emailOpen, setEmailOpen] = useState(false);  // mở ô nhập email
  const [sendBusy, setSendBusy] = useState("");       // "" | "email" | "drive"
  const [sendMsg, setSendMsg] = useState(null);       // { ok, text }
  const [soKyTruoc, setSoKyTruoc] = useState(!!prefs.prevCmp); // A3: bật đường "kỳ trước" (chỉ khung NGÀY)
  const [prevSeries, setPrevSeries] = useState({});   // {trendKey: chuỗi kỳ TRƯỚC (cùng độ dài)}
  // Mảng 3: dự báo (RPC gate R²) + bản đồ nhiệt phòng×ngày. Cache theo khoá scope|sensor.
  const [duBao, setDuBao] = useState(null);           // {du_bao_dang_tin, huong, r2, ghi_chu, chuoi, du_bao[]}
  const [maTran, setMaTran] = useState(null);         // {rooms[], days[], values[][]}
  const [dbBusy, setDbBusy] = useState(false);
  useEffect(() => { if (!isLive) return; let huy = false; (async () => { const [u, us] = await Promise.all([layWebhookAi(), layWebhookAiSau().catch(() => "")]); if (huy) return; setAiWebhook(u || ""); setAiWebhookSau(us || ""); })(); return () => { huy = true; }; }, [isLive]);
  // WF7b: URL gửi email/lưu Drive + điền sẵn người nhận email từ danh sách người nhận báo cáo.
  useEffect(() => { if (!isLive) return; let huy = false; (async () => { const [u, ds] = await Promise.all([layWebhookWf7b(), layNguoiNhanBaoCao().catch(() => ({ rows: [] }))]); if (huy) return; setWf7bUrl(u || ""); const emails = ((ds && ds.rows) || []).map((r) => r.email).filter(Boolean); setEmailTo(emails.join(", ")); })(); return () => { huy = true; }; }, [isLive]);
  const RANGE_DAYS = { "1n": 1, "7n": 7, "30n": 30, "90n": 90, "180n": 180 };
  // Độ phân giải: 30n/90n/Từ-đầu → NGÀY; 1n/7n → THEO GIỜ (dữ liệu thu thập 1 giờ/lần, bỏ mốc 30 phút cũ).
  const donVi = (range === "30n" || range === "90n" || range === "180n") ? "NGAY" : "GIO";
  const soDiem = range === "1n" ? 24 : range === "7n" ? 168 : (RANGE_DAYS[range] || 30);  // GIO: số GIỜ; NGAY: số ngày
  const resLbl = donVi === "GIO" ? "theo giờ" : "theo ngày";
  const isSubDay = donVi === "GIO";
  // Lưu lựa chọn nhẹ
  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify({ range, level, sensor, res: resOverride, prevCmp: soKyTruoc })); } catch { /* bỏ qua */ } }, [range, level, sensor, resOverride, soKyTruoc]);
  const [liveSeries, setLiveSeries] = useState({});   // {scopeId: chuỗi 90 ngày ALL} — cho mini-scope & thẻ kỳ
  const [mainSeries, setMainSeries] = useState({});   // {`id|sensor|range`: chuỗi chính (giờ/ngày + đúng cảm biến)}
  const [roomBand, setRoomBand] = useState({});       // {`room|sensor|range`: chuỗi giá trị TB + giới hạn (phòng)}
  const [roomBandsMulti, setRoomBandsMulti] = useState({}); // {`room|range`: { DP:series, RH:series, T:series }} — hiện CẢ 3 chỉ tiêu
  const [multiSensor, setMultiSensor] = useState({}); // {`room|range`: [{k, series}]} — vẽ ĐỦ DP/RH/T của 1 phòng

  // Vũ trụ scope ở chế độ LIVE — DỰNG TỪ DANH SÁCH PHÒNG (luôn có dữ liệu nhờ WF1)
  //   rồi LÀM GIÀU bằng bảng xếp hạng rủi ro v2 (tỉ lệ đạt 1/3/7 ngày + chuỗi 14 ngày).
  //   → KHẮC PHỤC lỗi "chưa xem được cấp phòng": phòng/AHU/khu LUÔN xuất hiện,
  //     không còn phụ thuộc rollup KPI ngày.
  const liveScopes = useMemo(() => {
    if (!isLive) return [];
    const rs = liveRooms || [];
    // Bản đồ làm giàu theo "type:id" từ RPC rủi ro v2 (nếu đã nạp file 19)
    const riskById = {};
    (liveRisk || []).forEach((r) => { if (r && r.type && r.id != null) riskById[`${r.type}:${r.id}`] = r; });
    const enrich = (sc) => {
      const e = riskById[`${sc.type}:${sc.id}`];
      if (!e) return sc;
      return {
        ...sc,
        risk: e.risk != null ? e.risk : sc.risk,
        delta7: e.delta7 != null ? e.delta7 : sc.delta7,
        dat1n: e.dat1n != null ? e.dat1n : sc.dat1n,
        dat3n: e.dat3n != null ? e.dat3n : sc.dat3n,
        dat7n: e.dat7n != null ? e.dat7n : sc.dat7n,
        chuoi: (e.chuoi && e.chuoi.length) ? e.chuoi : sc.chuoi,
        latest: { compliance: e.compliance != null ? e.compliance : sc.latest.compliance },
      };
    };
    const mkRoom = (r) => {
      const comp = r._compliance != null ? r._compliance : null;
      return { type: "ROOM", id: r.id, name: r.name || r.id, area: r.area || undefined, ahu: r.ahu || undefined,
        risk: comp != null ? Math.max(0, Math.round(100 - comp)) : 999, delta7: null,
        dat1n: comp, dat3n: null, dat7n: null, chuoi: [], latest: { compliance: comp }, daily: [{ compliance: comp }] };
    };
    const roomScopes = rs.filter((r) => !r.noData).map(mkRoom);
    const aggBy = (keyOf, type, nameOf) => {
      const g = {};
      roomScopes.forEach((s) => { const k = keyOf(s); if (!k) return; (g[k] = g[k] || []).push(s); });
      return Object.entries(g).map(([k, arr]) => {
        const vals = arr.map((s) => s.latest.compliance).filter((v) => v != null);
        const comp = vals.length ? +(vals.reduce((a, v) => a + v, 0) / vals.length).toFixed(1) : null;
        return { type, id: k, name: nameOf ? nameOf(k) : k, area: type === "AREA" ? k : undefined, ahu: type === "AHU" ? k : undefined,
          risk: comp != null ? Math.max(0, Math.round(100 - comp)) : 999, delta7: null,
          dat1n: comp, dat3n: null, dat7n: null, chuoi: [], latest: { compliance: comp }, daily: [{ compliance: comp }] };
      });
    };
    const areaScopes = aggBy((s) => s.area, "AREA");
    const ahuScopes = aggBy((s) => s.ahu, "AHU");
    const allVals = roomScopes.map((s) => s.latest.compliance).filter((v) => v != null);
    const totalComp = allVals.length ? +(allVals.reduce((a, v) => a + v, 0) / allVals.length).toFixed(1) : null;
    // Tài khoản giới hạn khu: server đã tự lọc mọi chuỗi/scope → "TOTAL" thực chất
    // là gộp các khu được xem; đặt tên đúng bản chất để không gây hiểu nhầm.
    const totalScope = { type: "TOTAL", id: "ALL", name: khuChoPhep ? `Phạm vi được xem (khu ${khuChoPhep.join(" · ")})` : "Toàn hệ thống", risk: 0, delta7: null,
      dat1n: totalComp, dat3n: null, dat7n: null, chuoi: [], latest: { compliance: totalComp }, daily: [{ compliance: totalComp }] };
    return [totalScope, ...areaScopes, ...ahuScopes, ...roomScopes].map(enrich);
  }, [isLive, liveRooms, liveRisk, khuChoPhep]);
  const lByType = (t) => liveScopes.filter((s) => s.type === t).sort((a, b) => b.risk - a.risk);
  const lFind = (id) => liveScopes.find((s) => s.id === id);

  // Danh sách Khu / AHU lấy TỪ DỮ LIỆU thật (không hardcode) — #2
  const areaList = useMemo(() => {
    const src = isLive ? (liveRooms || []) : MASTER.filter((m) => m.type === "ROOM");
    return [...new Set(src.map((r) => r.area).filter(Boolean))].sort();
  }, [isLive, liveRooms]);
  const ahuList = useMemo(() => {
    let src = isLive ? (liveRooms || []) : MASTER.filter((m) => m.type === "ROOM");
    if (optArea !== "ALL") src = src.filter((r) => r.area === optArea);
    return [...new Set(src.map((r) => r.ahu).filter(Boolean))].sort();
  }, [isLive, liveRooms, optArea]);

  const allOptions = useMemo(() => isLive ? (level === "TOTAL" ? lByType("TOTAL") : lByType(level)) : (level === "TOTAL" ? [findScope("ALL")] : byType(level)), [isLive, level, liveScopes]); // eslint-disable-line
  const options = useMemo(() => allOptions.filter((o) => o
    && (optArea === "ALL" || o.area === optArea)
    && (optAhu === "ALL" || o.ahu === optAhu)
  ), [allOptions, optArea, optAhu]);
  const activeId = selId && options.some((o) => o.id === selId) ? selId : (options[0] ? options[0].id : "ALL");
  const activeScope = (isLive ? lFind(activeId) : findScope(activeId)) || (isLive ? (liveScopes[0] || { id: "ALL", name: "—", daily: [{}], latest: {} }) : findScope("ALL"));
  const trendKey = `${activeId}|${sensor}|${range}|${donVi}`;   // khóa cache chuỗi chính (kèm độ phân giải)

  // Mảng 3 — LIVE: dự báo (gate R²) + ma trận phòng×ngày cho scope/cảm biến đang chọn.
  // Heatmap chỉ có nghĩa ở cấp Tổng/Khu (nhiều phòng); Tổng/AHU/Phòng đều dự báo được.
  useEffect(() => {
    if (!isLive || !activeId) { setDuBao(null); setMaTran(null); return; }
    let huy = false;
    const st = activeScope.type || "TOTAL";
    // Heatmap phòng×ngày chỉ có nghĩa ở cấp có NHIỀU phòng (Tổng/Khu); AHU/Phòng → bỏ.
    const capHeatmap = st === "TOTAL" || st === "AREA";
    const hmType = st === "AREA" ? "AREA" : "TOTAL";
    const hmId = st === "AREA" ? activeId : "ALL";
    const soNgayHm = Math.min(14, RANGE_DAYS[range] || 30);
    (async () => {
      setDbBusy(true);
      try {
        const [fc, mt] = await Promise.all([
          layDuBaoXuHuong(st, activeId, sensor, 30, 7),
          capHeatmap ? layMaTranPhongNgay(hmType, hmId, sensor, soNgayHm, 20) : Promise.resolve({ rooms: [] }),
        ]);
        if (huy) return;
        setDuBao(fc && fc.du_bao ? fc.du_bao : null);
        setMaTran(mt && mt.rooms && mt.rooms.length ? mt : null);
      } catch { if (!huy) { setDuBao(null); setMaTran(null); } }
      finally { if (!huy) setDbBusy(false); }
    })();
    return () => { huy = true; };
  }, [isLive, activeScope.type, activeId, sensor, range]); // eslint-disable-line

  // LIVE: tải chuỗi 90 ngày cho scope đang chọn + 4 scope mini (cache theo id)
  const miniIds = useMemo(() => isLive ? [lByType("TOTAL")[0], lByType("AREA")[0], lByType("AHU")[0], lByType("ROOM")[0]].map((s) => s && s.id).filter(Boolean) : [], [isLive, liveScopes]); // eslint-disable-line
  useEffect(() => {
    if (!isLive) return;
    const need = [activeId, ...miniIds].filter((id, i, a) => id && a.indexOf(id) === i && !liveSeries[id]);
    if (!need.length) return;
    let huy = false;
    (async () => {
      const got = await Promise.all(need.map((id) => { const sc = lFind(id); return layChuoiXuHuong(sc ? sc.type : "TOTAL", id, "ALL", 90); }));
      if (huy) return;
      setLiveSeries((m) => { const n = { ...m }; need.forEach((id, i) => { n[id] = (got[i] && got[i].series) || []; }); return n; });
    })();
    return () => { huy = true; };
  }, [isLive, activeId, miniIds]); // eslint-disable-line

  // LIVE: chuỗi CHÍNH cho biểu đồ — phụ thuộc scope · cảm biến · khoảng.
  // #3: 24 giờ & 7 ngày → THEO GIỜ; chỉ 30 ngày & 90 ngày → theo NGÀY.
  useEffect(() => {
    if (!isLive || !activeId) return;
    if (mainSeries[trendKey]) return;                 // đã có cache
    const sc = lFind(activeId);
    let huy = false;
    (async () => {
      const r = await layChuoiXuHuongChiTiet(sc ? sc.type : "TOTAL", activeId, sensor, donVi, soDiem);
      if (huy) return;
      setMainSeries((m) => ({ ...m, [trendKey]: (r && r.series) || [] }));
    })();
    return () => { huy = true; };
  }, [isLive, activeId, sensor, range, donVi]); // eslint-disable-line

  // A3 — SO KỲ TRƯỚC: chỉ khung NGÀY (30n/90n). Lấy 2× số ngày từ CÙNG RPC rồi
  //   cắt NỬA ĐẦU làm "kỳ trước" — không cần sửa backend, canh theo index.
  useEffect(() => {
    if (!isLive || !activeId || !soKyTruoc || donVi !== "NGAY") return;
    if (prevSeries[trendKey]) return;
    const sc = lFind(activeId);
    let huy = false;
    (async () => {
      const r = await layChuoiXuHuongChiTiet(sc ? sc.type : "TOTAL", activeId, sensor, "NGAY", soDiem * 2);
      if (huy) return;
      const s = (r && r.series) || [];
      setPrevSeries((m) => ({ ...m, [trendKey]: s.slice(0, Math.max(0, s.length - soDiem)) }));
    })();
    return () => { huy = true; };
  }, [isLive, activeId, sensor, range, donVi, soKyTruoc]); // eslint-disable-line

  // LIVE: chuỗi GIÁ TRỊ TRUNG BÌNH + giới hạn cho 1 PHÒNG · 1 CẢM BIẾN (#4)
  //   chỉ tải khi đang xem cấp PHÒNG và đã chọn 1 chỉ tiêu cụ thể (DP/RH/T).
  const roomBandKey = `${activeId}|${sensor}|${range}|${donVi}`;
  const wantRoomBand = isLive && activeScope && activeScope.type === "ROOM" && ["DP", "RH", "T"].includes(sensor);
  useEffect(() => {
    if (!wantRoomBand) return;
    if (roomBand[roomBandKey]) return;
    let huy = false;
    (async () => {
      const r = await layChuoiGiaTriPhong(activeId, sensor, donVi, soDiem);
      if (huy) return;
      setRoomBand((m) => ({ ...m, [roomBandKey]: (r && r.series) || [] }));
    })();
    return () => { huy = true; };
  }, [wantRoomBand, activeId, sensor, range, donVi]); // eslint-disable-line

  // LIVE: nạp band TB + giới hạn cho CẢ 3 chỉ tiêu (DP/RH/T) của phòng — để hiện đồng thời.
  const roomBandsKey = `${activeId}|${range}|${donVi}`;
  const wantRoomBands = isLive && activeScope && activeScope.type === "ROOM";
  useEffect(() => {
    if (!wantRoomBands) return;
    if (roomBandsMulti[roomBandsKey]) return;
    let huy = false;
    (async () => {
      // Mảng 4 (tốc độ): 3 RPC DP/RH/T ĐỘC LẬP → chạy SONG SONG (Promise.all)
      // thay vì tuần tự for…await (nhanh ~3× khi mở chi tiết phòng).
      const ks = ["DP", "RH", "T"];
      const rs = await Promise.all(ks.map((k) => layChuoiGiaTriPhong(activeId, k, donVi, soDiem)));
      if (huy) return;
      const out = {};
      ks.forEach((k, i) => {
        const r = rs[i];
        const s = (r && r.series) || [];
        if (s.length) out[k] = { series: s, baseline: r.baseline || null };   // kèm baseline 30 ngày
      });
      if (!huy) setRoomBandsMulti((m) => ({ ...m, [roomBandsKey]: out }));
    })();
    return () => { huy = true; };
  }, [wantRoomBands, activeId, range, donVi]); // eslint-disable-line

  // chuỗi ĐA CẢM BIẾN (vẽ đủ DP/RH/T) — tải cho MỌI cấp: phòng/khu/AHU/tổng.
  const multiKey = `${activeScope?.type || "TOTAL"}|${activeId}|${range}|${donVi}`;
  const wantMulti = isLive && !!activeScope;
  useEffect(() => {
    if (!wantMulti) return;
    if (multiSensor[multiKey]) return;
    const scType = activeScope.type || "TOTAL";
    let huy = false;
    (async () => {
      const r = await layChuoiXuHuongDaSensor(scType, activeId, donVi, soDiem);
      if (huy) return;
      setMultiSensor((m) => ({ ...m, [multiKey]: (r && r.perSensor) || [] }));
    })();
    return () => { huy = true; };
  }, [wantMulti, activeId, range, donVi, activeScope]); // eslint-disable-line

  // Gộp chuỗi đa cảm biến theo mốc thời gian → {ts,label,comp_DP,oos_DP,comp_RH,...}
  const multiMerged = useMemo(() => {
    if (!wantMulti) return [];
    const ps = multiSensor[multiKey] || [];
    const byTs = new Map();
    ps.forEach((g) => (g.series || []).forEach((p) => {
      const cur = byTs.get(p.ts) || { ts: p.ts, label: p.label };
      cur[`comp_${g.k}`] = p.comp; cur[`oos_${g.k}`] = p.oos;
      byTs.set(p.ts, cur);
    }));
    return [...byTs.values()].sort((a, b) => a.ts - b.ts);
  }, [wantMulti, multiSensor, multiKey]);
  const sensorsPresent = useMemo(() => (wantMulti ? (multiSensor[multiKey] || []).map((g) => g.k) : []), [wantMulti, multiSensor, multiKey]);
  const full = isLive ? (mainSeries[trendKey] || []) : getSeries(activeScope, sensor, range);
  const minTs = full[0]?.ts, maxTs = full[full.length - 1]?.ts;
  // Ô "Từ → đến" TỰ hiển thị mốc dữ liệu thật (điểm đầu có dữ liệu → điểm cuối) khi chưa có
  // bộ lọc/nháp nào — chạy khi dữ liệu nạp xong lần đầu, đổi Khoảng/cấp xem, hoặc bấm Đặt lại/Toàn khoảng.
  useEffect(() => {
    if (!minTs || !maxTs) return;
    if (dtFrom || dtTo || dtFromDraft || dtToDraft) return;   // user đang lọc/soạn → không đè
    setDtFromDraft(toLocalInput(minTs));
    setDtToDraft(toLocalInput(maxTs));
  }, [minTs, maxTs, dtFrom, dtTo, dtFromDraft, dtToDraft]);
  const fromMs = dtFrom ? new Date(dtFrom).getTime() : minTs;
  const toMs = dtTo ? new Date(dtTo).getTime() : maxTs;
  const series = full.filter((r) => r.ts >= Math.min(fromMs, toMs) && r.ts <= Math.max(fromMs, toMs));
  const view = series.length ? series : full;
  const isHourly = range === "1n" || range === "7n";   // #3: 24 giờ & 7 ngày theo GIỜ
  // #3 — chuỗi đa cảm biến đã lọc theo cùng cửa sổ thời gian
  const viewMulti = useMemo(() => {
    if (!wantMulti || !multiMerged.length) return [];
    const f = multiMerged.filter((r) => r.ts >= Math.min(fromMs, toMs) && r.ts <= Math.max(fromMs, toMs));
    return f.length ? f : multiMerged;
  }, [wantMulti, multiMerged, fromMs, toMs]);
  const showMulti = wantMulti && sensor === "ALL" && viewMulti.length > 0 && sensorsPresent.length > 0;
  const isRoom = !!activeScope && activeScope.type === "ROOM";
  const isLargeScope = !!activeScope && !isRoom;  // TOTAL / AREA / AHU

  // A3 — đường "kỳ trước" (mờ, đứt): chỉ khi khung NGÀY + không lọc thời gian con.
  const prevData = (soKyTruoc && donVi === "NGAY" && !dtFrom && !dtTo && (prevSeries[trendKey] || []).length)
    ? (prevSeries[trendKey] || []).map((p) => p.comp) : null;
  // A3 — overlay SỰ CỐ (⚑) lên đường xu hướng: lọc theo phạm vi đang xem, tìm điểm gần nhất.
  const chonDiem = (prm) => { if (prm && prm.dataIndex != null) setDiemChon(prm.dataIndex); };
  const incidentMarks = useMemo(() => {
    if (!isLive || !liveIncidents || !liveIncidents.length || !view.length) return null;
    const roomsById = {}; (liveRooms || []).forEach((r) => { roomsById[r.id] = r; });
    const step = view.length > 1 ? Math.abs((view[view.length - 1].ts - view[0].ts) / (view.length - 1)) : 86400000;
    const marks = [];
    liveIncidents.forEach((s) => {
      if (s.startTs == null) return;
      const r = roomsById[s.room];
      const ok = activeScope.type === "TOTAL" ? true
        : activeScope.type === "ROOM" ? s.room === activeId
        : activeScope.type === "AREA" ? (r && r.area === activeId)
        : (r && r.ahu === activeId);
      if (!ok) return;
      if (s.startTs < view[0].ts - step / 2 || s.startTs > view[view.length - 1].ts + step / 2) return;
      let best = 0, bd = Infinity;
      view.forEach((p, i) => { const d = Math.abs(p.ts - s.startTs); if (d < bd) { bd = d; best = i; } });
      marks.push({ idx: best, name: `${s.id} · ${s.room} ${s.sensor}` });
    });
    return marks.length ? marks : null;
  }, [isLive, liveIncidents, liveRooms, view, activeScope, activeId]);
  // A2 — lịch tuân thủ 90 ngày (ô ngày, giờ LOCAL để không lệch múi giờ VN)
  const calDays = useMemo(() => {
    if (!isLive) return [];
    return (liveSeries[activeId] || []).map((p) => {
      const d = new Date(p.ts);
      return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, value: p.comp };
    });
  }, [isLive, liveSeries, activeId]);

  const latest = view[view.length - 1] || {};
  const prev = view[view.length - 2] || {};
  const deltaDay = latest.comp != null && prev.comp != null ? +(latest.comp - prev.comp).toFixed(1) : null;
  const wk = view.length > 7 ? view[view.length - 8] : view[0];
  const delta7 = latest.comp != null && wk?.comp != null ? +(latest.comp - wk.comp).toFixed(1) : null;
  const totalAlert = view.reduce((a, r) => a + r.alert, 0);

  const periodCards = useMemo(() => [1, 7, 30, 90].map((d) => {
    let sl;
    if (isLive) { const all = liveSeries[activeId] || []; sl = all.slice(-d).map((r) => ({ compliance: r.comp, warnH: r.warnH, critH: r.critH })); }
    else { sl = activeScope.daily.slice(-d).map((r) => applySensor(r, sensor)); }
    const warn = sl.reduce((a, r) => a + (r.warnH || 0), 0), crit = sl.reduce((a, r) => a + (r.critH || 0), 0);
    const avg = sl.length ? sl.reduce((a, r) => a + (r.compliance || 0), 0) / sl.length : null;
    return { d, avail: sl.length, warn, crit, alert: warn + crit, avg, status: sl.length < d ? "PARTIAL" : "FULL" };
  }), [isLive, activeScope, sensor, liveSeries, activeId]);
  const miniScopes = isLive
    ? [["TOTAL", lByType("TOTAL")[0]], ["AREA", lByType("AREA")[0]], ["AHU", lByType("AHU")[0]], ["ROOM", lByType("ROOM")[0]]].map(([lvl, sc]) => [lvl, sc ? { ...sc, _series: liveSeries[sc.id] || [] } : { id: "—", name: "—", _series: [] }])
    : [["TOTAL", findScope("ALL")], ["AREA", byType("AREA")[0]], ["AHU", byType("AHU")[0]], ["ROOM", byType("ROOM")[0]]];
  // #4 — Xếp hạng rủi ro: SẮP theo CẤP (Tổng→Khu→AHU→Phòng), trong cấp theo rủi ro giảm dần.
  const LEVEL_RANK = { TOTAL: 0, AREA: 1, AHU: 2, ROOM: 3 };
  const riskRows = (isLive
    ? liveScopes.slice()
    : [findScope("ALL"), ...byType("AREA"), ...byType("AHU"), ...byType("ROOM")].map((s) => ({ ...s, latest: s.latest || {} })))
    .filter(Boolean)
    .sort((a, b) => (LEVEL_RANK[a.type] - LEVEL_RANK[b.type]) || (b.risk - a.risk) || String(a.id).localeCompare(String(b.id)));

  // #4 — Phân tích kỹ thuật của chuỗi đang xem (cho AI + bảng cạnh biểu đồ)
  const tech = useMemo(() => {
    const ys = view.map((r) => r.comp).filter((v) => v != null);
    const s = regStat(ys);
    if (!s.n) return { n: 0 };
    const totOos = view.reduce((a, r) => a + (r.oos || 0), 0);
    const dqAvg = (() => { const d = view.map((r) => r.dq).filter((v) => v != null); return d.length ? d.reduce((a, v) => a + v, 0) / d.length : null; })();
    return { ...s, totOos, dqAvg };
  }, [view]);

  // Bản phân tích CỤC BỘ (dự phòng khi chưa cấu hình WF7 hoặc gọi lỗi) — như trước.
  const buildLocalAnalysis = () => {
    const donViLbl = isHourly ? "giờ" : "ngày";
    const perTxt2 = isHourly ? "%/giờ" : "%/ngày";
    if (!tech.n) return { text: "Chưa có đủ dữ liệu trong khoảng đã chọn để phân tích. Hãy mở rộng khoảng thời gian hoặc kiểm tra kết nối FMS/WF1.", level: 0 };
    const avg = tech.mean;
    const level = avg < 70 ? 3 : avg < 80 ? 2 : avg < 88 ? 1 : 0;
    const win = (dtFrom || dtTo) ? ` (lọc ${view[0]?.label}→${view[view.length - 1]?.label})` : "";
    const worst = [...view].sort((a, b) => (b.oos || 0) - (a.oos || 0) || (a.comp ?? 999) - (b.comp ?? 999))[0];
    const slopeTxt = tech.n >= 2 ? `${tech.slope > 0 ? "tăng" : tech.slope < 0 ? "giảm" : "đi ngang"} ${Math.abs(tech.slope).toFixed(2)} ${perTxt2} (R²=${tech.r2.toFixed(2)}, ${tech.r2 >= 0.5 ? "xu hướng rõ" : "biến động ngẫu nhiên"})` : "chưa đủ điểm để ước lượng";
    const dqTxt = tech.dqAvg != null ? `${tech.dqAvg.toFixed(0)}%` : "—";
    const dqWarn = tech.dqAvg != null && tech.dqAvg < 80 ? ` — ⚠ độ đầy đủ dữ liệu thấp làm giảm độ tin cậy kết luận` : "";
    const rateTxt = `đạt 1 ngày ${fmtPct(activeScope.dat1n)} · 3 ngày ${fmtPct(activeScope.dat3n)} · 7 ngày ${fmtPct(activeScope.dat7n)}`;
    const perSensorLines = [];
    if (showMulti) {
      sensorsPresent.forEach((k) => {
        const ys = viewMulti.map((r) => r[`comp_${k}`]).filter((v) => v != null);
        const st = regStat(ys);
        if (!st.n) return;
        const oosTot = viewMulti.reduce((a, r) => a + (r[`oos_${k}`] || 0), 0);
        const dir = st.slope > 0.05 ? "đang cải thiện" : st.slope < -0.05 ? "đang xấu đi" : "đi ngang";
        const tin = st.r2 >= 0.5 ? "rõ" : "chưa rõ";
        perSensorLines.push(`• ${SENSOR_META[k]?.label || k}: đạt TB ${st.mean.toFixed(1)}% (${st.vmin.toFixed(0)}–${st.vmax.toFixed(0)}%), dốc ${st.slope > 0 ? "+" : ""}${st.slope.toFixed(2)} ${perTxt2} [R²=${st.r2.toFixed(2)}, ${tin}] → ${dir}; ${oosTot} điểm OOS.`);
      });
    }
    const khuyenNghi = (avg < 80 || tech.slope < -0.5)
      ? `IPC: kiểm tra hiện trường ${activeScope.name} (cửa/chốt liên động, chênh áp thực, chế độ phòng). Cơ điện: soát AHU${activeScope.ahu ? " " + activeScope.ahu : ""} — lưu lượng, cấp lọc, van/biến tần, rò khí. QA: xem xét mở/đánh giá CAPA nếu tái diễn, rà soát rủi ro liên đới.`
      : `Duy trì giám sát thường quy; chưa cần can thiệp khẩn. QA tiếp tục theo dõi các ${donViLbl} tới.`;
    const i = (a, b) => (showMulti ? a : b);
    const levelLbl = ["Kiểm soát tốt", "Cần chú ý", "Cảnh báo", "Hành động khắc phục"][level];
    const xuHuongDien = tech.n >= 2
      ? (tech.slope > 0.05 ? "đang cải thiện dần" : tech.slope < -0.05 ? "đang xấu đi — cần lưu ý" : "đi ngang, ổn định")
      : "chưa đủ dữ liệu để kết luận xu hướng";
    const dgPhanTich = avg >= 88
      ? `Tỉ lệ đạt TB ${avg.toFixed(1)}% ở mức tốt, trên ngưỡng GMP 80%; ${xuHuongDien}.`
      : avg >= 80
        ? `Tỉ lệ đạt TB ${avg.toFixed(1)}% còn mỏng so với ngưỡng 80% — biên an toàn hẹp; ${xuHuongDien}.`
        : `Tỉ lệ đạt TB ${avg.toFixed(1)}% DƯỚI ngưỡng GMP 80% — chưa đạt kiểm soát; ${xuHuongDien}.`;
    const worstTxt = worst ? `Cao điểm mất kiểm soát tại ${worst.label}: đạt ${fmtPct(worst.comp)}, ${worst.oos || 0} điểm OOS.` : "Không có mốc nổi bật về OOS.";
    const capaLines = (avg < 80 || tech.slope < -0.5)
      ? [
          `IPC: kiểm tra hiện trường ${activeScope.name} — cửa/chốt liên động, chênh áp thực tế, chế độ vận hành phòng.`,
          `Cơ điện: soát AHU${activeScope.ahu ? " " + activeScope.ahu : ""} — lưu lượng cấp/hồi, cấp lọc (chênh áp phin lọc), van/biến tần, rò khí.`,
          `QA: xem xét mở/đánh giá CAPA nếu lặp lại; rà soát rủi ro liên đới và hồ sơ lô bị ảnh hưởng.`,
        ]
      : [
          `Duy trì giám sát thường quy; chưa cần can thiệp khẩn.`,
          `QA tiếp tục theo dõi ${donViLbl} tới; ghi nhận nếu xu hướng đảo chiều.`,
        ];
    const secTho = [
      `• Đối tượng: ${activeScope.name} · ${showMulti ? `đủ cảm biến (${sensorsPresent.join("/")})` : SENSORS.find((s) => s.k === sensor).label} · khoảng ${RANGES.find((r) => r.k === range).label}${win} · ${tech.n} điểm theo ${donViLbl}.`,
      `• Tỉ lệ đạt: TB ${avg.toFixed(1)}% (min–max ${tech.vmin.toFixed(0)}–${tech.vmax.toFixed(0)}%, SD ${tech.std.toFixed(1)}%). ${rateTxt}.`,
      `• OOS & dữ liệu: tổng ${tech.totOos} điểm OOS; độ đầy đủ dữ liệu ${dqTxt}.`,
      `• Xu hướng: ${slopeTxt}; Δ7 ${donViLbl} ${fmtDelta(delta7)}.`,
      showMulti && perSensorLines.length ? `• Theo từng chỉ tiêu:\n${perSensorLines.join("\n")}` : "",
    ].filter(Boolean).join("\n");
    const secPhanTich = [
      `• ${dgPhanTich}`,
      `• ${worstTxt}`,
      dqWarn ? `• ⚠ Độ đầy đủ dữ liệu thấp (${dqTxt}) làm giảm độ tin cậy kết luận.` : `• Độ đầy đủ dữ liệu ${dqTxt} — đủ tin cậy để kết luận.`,
    ].join("\n");
    const secBaoCao = [
      `• Mức kết luận: ${levelLbl}.`,
      `• ${activeScope.name} ${avg >= 80 ? "đang trong tầm kiểm soát" : "chưa đạt kiểm soát"} ở khoảng ${RANGES.find((r) => r.k === range).label}; ${tech.slope < -0.5 ? "xu hướng suy giảm cần theo dõi sát." : "xu hướng ổn định/cải thiện."}`,
    ].join("\n");
    const secCapa = capaLines.map((x) => `• ${x}`).concat("• AI chỉ hỗ trợ phân tích xu hướng; quyết định GMP do IPC/QA phê duyệt.").join("\n");
    const text = [
      `## DỮ LIỆU THÔ\n${secTho}`,
      `## PHÂN TÍCH\n${secPhanTich}`,
      `## BÁO CÁO\n${secBaoCao}`,
      `## CAPA & KHUYẾN NGHỊ\n${secCapa}`,
    ].join("\n\n");
    return { text, level };
  };

  const finishAI = (text, level, nguon) => {
    const payload = { scope: activeScope.name, sensor: SENSORS.find((s) => s.k === sensor).label, range: RANGES.find((r) => r.k === range).label, text, time: new Date().toLocaleString("vi-VN"), level, nguon };
    onAI(payload); setAiResult(payload);
    if (isLive && onSaveAI) onSaveAI({ scopeType: activeScope.type, scopeId: activeScope.id, scopeName: activeScope.name, sensor, days: RANGE_DAYS[range] || 30, text, level });
  };

  const runAI = async (sau = false) => {
    if (aiBusy) return;
    setAiNote(null);
    if (!tech.n) { finishAI("Chưa có đủ dữ liệu trong khoảng đã chọn để phân tích. Hãy mở rộng khoảng thời gian hoặc kiểm tra kết nối FMS/WF1.", 0, "cuc_bo"); return; }
    const aiUrl = sau ? aiWebhookSau : aiWebhook;   // chọn workflow: chuyên sâu hay thường

    // Nếu đã cấu hình workflow AI → gửi DỮ LIỆU BIỂU ĐỒ THẬT cho AI phân tích.
    if (isLive && aiUrl) {
      setAiBusy(true);
      // dữ liệu bổ sung cho phân tích chuyên sâu (đều từ dữ liệu web đã có)
      const slimAI = (arr, keep = 60) => { if (!Array.isArray(arr) || arr.length <= keep) return arr || []; const st = Math.ceil(arr.length / keep); return arr.filter((_, i) => i % st === 0); };
      const bandsAll = (activeScope.type === "ROOM" && roomBandsMulti[roomBandsKey]) || {};
      const giaTriThuc3 = ["DP", "RH", "T"].filter((k) => bandsAll[k] && bandsAll[k].series && bandsAll[k].series.length).map((k) => {
        const s = bandsAll[k].series;
        const lo = [...s].reverse().find((p) => p.lo != null)?.lo ?? null;
        const hi = [...s].reverse().find((p) => p.hi != null)?.hi ?? null;
        const v = s.filter((p) => p.avg != null);
        const tb = v.length ? +(v.reduce((a, p) => a + p.avg, 0) / v.length).toFixed(2) : null;
        return { chi_tieu: SENSOR_META[k]?.label || k, don_vi: SENSOR_META[k]?.unit || "", GHD: lo, GHT: hi, TB_ky: tb, chuoi: slimAI(s).map((p) => ({ t: p.label, tb: p.avg, min: p.vmin, max: p.vmax })) };
      });
      const ahuId = activeScope.ahu;
      const phongCungAhu = ahuId ? (liveRooms || []).filter((r) => r.ahu === ahuId).map((r) => ({ ma: r.id, ten: r.name || r.id, dat_pct: r._compliance != null ? +(+r._compliance).toFixed(1) : null, thieu_dl: !!r.noData })) : [];
      const scId = activeScope.id;
      const suCoLienQuan = (liveIncidents || []).filter((i) => {
        if (activeScope.type === "TOTAL") return true;
        if (activeScope.type === "ROOM") return i.room === scId;
        if (activeScope.type === "AHU") return (liveRooms || []).some((r) => r.ahu === scId && r.id === i.room);
        if (activeScope.type === "AREA") return (liveRooms || []).some((r) => r.area === scId && r.id === i.room);
        return false;
      }).slice(0, 12).map((i) => ({ ma: i.id, phong: i.room, chi_tieu: i.sensor || null, muc: i.priority, trang_thai: i.status }));
      const roomRec = (liveRooms || []).find((r) => r.id === activeScope.id) || {};
      // ===== Dữ liệu PHÂN TÍCH SÂU (Supabase tính) =====
      const _donVi = donVi === "NGAY" ? "NGAY" : "GIO";   // phân tích sâu chỉ có GIO/NGAY (PHUT→GIO)
      const _soDiem = range === "1n" ? 24 : range === "7n" ? 168 : (RANGE_DAYS[range] || 30);
      const _soGio = range === "1n" ? 24 : range === "7n" ? 168 : ((RANGE_DAYS[range] || 30) * 24);
      const _canDrill = activeScope.type === "TOTAL" || activeScope.type === "AREA" || activeScope.type === "AHU";
      let phanTichSau = null, quetBatThuong = null;
      try {
        const can = [layPhanTichSau(activeScope.type, activeScope.id, sensor, _donVi, _soDiem)];
        if (_canDrill) can.push(layQuetBatThuong(_soGio, activeScope.type, activeScope.id));
        const kq = await Promise.all(can);
        phanTichSau = kq[0] && kq[0].sau ? kq[0].sau : null;
        quetBatThuong = _canDrill && kq[1] && kq[1].quet ? kq[1].quet : null;
      } catch { /* bỏ qua — payload vẫn gửi phần còn lại */ }
      const payload = {
        scope: { name: activeScope.name, type: activeScope.type, id: activeScope.id, area: activeScope.area, ahu: activeScope.ahu, dat1n: activeScope.dat1n, dat3n: activeScope.dat3n, dat7n: activeScope.dat7n,
          cap_sach: roomRec.cap_phong_sach || roomRec.capPhong || null, uu_tien: roomRec.priority || roomRec.muc_uu_tien || null },
        rangeLabel: RANGES.find((r) => r.k === range).label, isHourly,
        metrics: { mean: tech.mean, std: tech.std, slope: tech.slope, r2: tech.r2, totOos: tech.totOos, dq: tech.dqAvg, vmin: tech.vmin, vmax: tech.vmax, n: tech.n },
        series: view.map((r) => ({ label: r.label, ts: r.ts, comp: r.comp, oos: r.oos, dq: r.dq })),
        perSensor: showMulti ? sensorsPresent.map((k) => ({ k, label: SENSOR_META[k]?.label, series: viewMulti.map((r) => ({ label: r.label, comp: r[`comp_${k}`], oos: r[`oos_${k}`] })) })) : [],
        gia_tri_thuc_3: giaTriThuc3,      // giá trị đo thực + GHD/GHT cho cả 3 chỉ tiêu
        phong_cung_ahu: phongCungAhu,     // tình trạng các phòng cùng AHU (suy luận hệ thống)
        su_co_lien_quan: suCoLienQuan,    // sự cố mở/gần đây trong phạm vi (bối cảnh)
        phan_tich_sau: phanTichSau,       // độ phủ DL + OOS tách trên/dưới + lịch sử (kỳ trước, TB 7/30 ngày)
        quet_bat_thuong: quetBatThuong,   // (Tổng quan/Khu vực) xếp hạng khu vực + phòng tốt/xấu + đợt bất thường có mốc thời gian
      };
      const r = await phanTichAiQuaWorkflow(aiUrl, payload, undefined, (m) => setAiNote(m), sau ? "WF7_SAU" : "WF7");
      setAiBusy(false);
      if (r.ok) { setAiNote(null); const loc = buildLocalAnalysis(); finishAI(r.text, r.level != null ? r.level : loc.level, sau ? "openai_sau" : "openai"); return; }
      // lỗi → rơi về bản cục bộ + ghi chú trạng thái (KHÔNG nối vào nội dung để giữ 4 mục sạch)
      const loc = buildLocalAnalysis();
      setAiNote(`Chưa gọi được AI qua workflow (${r.error}). Đang hiển thị phân tích cục bộ — kiểm tra WF7 / khóa OpenAI nếu cần.`);
      finishAI(loc.text, loc.level, "cuc_bo");
      return;
    }
    // Chưa cấu hình webhook → bản cục bộ
    const loc = buildLocalAnalysis();
    finishAI(loc.text, loc.level, "cuc_bo");
  };

  // Chụp TẤT CẢ biểu đồ đang hiển thị ở tab Xu hướng (#trendPrintArea) → mảng { src, title }
  // (src = PNG data URI; title = tiêu đề thẻ chứa biểu đồ, để WF7b chú thích như báo cáo WF5).
  // Dùng registry window.__bmsEcharts (map DOM→instance) như hàm in A4; fallback canvas.toDataURL.
  const capTrendCharts = () => {
    try {
      const node = document.getElementById("trendPrintArea");
      if (!node) return [];
      const reg = window.__bmsEcharts;
      const instFor = (canvas) => { let el = canvas.parentElement; while (el) { if (reg && reg.has(el)) return reg.get(el); el = el.parentElement; } return null; };
      const titleFor = (canvas) => {
        let el = canvas.parentElement;
        while (el && el !== node) { const h = el.querySelector && el.querySelector("h3"); if (h && h.textContent) return h.textContent.replace(/\s+/g, " ").trim(); el = el.parentElement; }
        return "";
      };
      return Array.from(node.querySelectorAll("canvas")).map((c) => {
        let src = null;
        try { const inst = instFor(c); src = inst ? inst.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fff", excludeComponents: ["toolbox", "dataZoom"] }) : c.toDataURL("image/png"); }
        catch { try { src = c.toDataURL("image/png"); } catch { src = null; } }
        return src ? { src, title: titleFor(c) } : null;
      }).filter(Boolean);
    } catch { return []; }
  };
  // Lưu bản nhận định AI hiện tại (.html, kèm biểu đồ) vào Google Drive (folder con "Nhan-dinh-xu-huong") qua WF7b.
  const luuDriveNhanDinh = async () => {
    if (!aiResult || sendBusy) return;
    setSendBusy("drive"); setSendMsg(null);
    const r = await guiNhanDinhXuHuong(wf7bUrl, "drive", aiResult, "", capTrendCharts());
    setSendBusy("");
    setSendMsg(r.ok ? { ok: true, text: "Đã lưu nhận định (kèm biểu đồ) vào Google Drive." } : { ok: false, text: `Không lưu được (${r.error}).` });
  };
  // Gửi bản nhận định AI (kèm biểu đồ) qua email (tuỳ chọn) tới người nhập.
  const guiEmailNhanDinh = async () => {
    if (!aiResult || sendBusy) return;
    const to = emailTo.trim();
    if (!to) { setSendMsg({ ok: false, text: "Nhập ít nhất 1 email người nhận." }); return; }
    setSendBusy("email"); setSendMsg(null);
    const r = await guiNhanDinhXuHuong(wf7bUrl, "email", aiResult, to, capTrendCharts());
    setSendBusy("");
    if (r.ok) { setSendMsg({ ok: true, text: `Đã gửi email (kèm biểu đồ) tới: ${to}` }); setEmailOpen(false); }
    else setSendMsg({ ok: false, text: `Không gửi được (${r.error}).` });
  };

  // In báo cáo A4 — LUÔN kèm phân tích AI: nếu chưa có nhận định thì chạy AI trước rồi mới in.
  const inBaoCaoA4 = async () => {
    const LVL = { TOTAL: "Toàn hệ thống", AREA: "Khu vực", AHU: "AHU", ROOM: "Phòng" };
    const phamVi = activeScope.type === "TOTAL" ? "Toàn hệ thống" : `${LVL[activeScope.type] || ""}: ${activeScope.name}`;
    const meta = { phamVi, scope: activeScope.name, sensor: SENSORS.find((s) => s.k === sensor)?.label, range: RANGES.find((r) => r.k === range)?.label, res: resLbl, window: (dtFrom || dtTo) ? `${view[0]?.label}→${view[view.length - 1]?.label}` : `${RANGES.find((r) => r.k === range)?.label} gần nhất` };
    if (!aiResult) {
      setDangInBaoCao(true);
      try { await runAI(); await new Promise((r) => setTimeout(r, 650)); } catch { /* vẫn in phần còn lại */ }
      setDangInBaoCao(false);
    }
    printTrend(meta);
  };

  const Chip = ({ active, onClick, children, disabled, title }) => <button onClick={onClick} disabled={disabled} title={title} className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition ring-1 ${disabled ? "text-muted bg-subtle ring-line cursor-not-allowed" : active ? "text-white ring-transparent" : "text-body bg-surface ring-line hover:ring-success-line"}`} style={active && !disabled ? { backgroundColor: "var(--primary-solid)" } : {}}>{children}</button>;
  const sel = "rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-[12px] text-body outline-none";

  // #4 — chuỗi giá trị TB + dải giới hạn của phòng (chỉ khi đang chọn 1 phòng + 1 chỉ tiêu DP/RH/T trong LIVE)
  const bandSeries = (wantRoomBand && roomBand[roomBandKey]) || [];
  const bandLo = [...bandSeries].reverse().find((p) => p.lo != null)?.lo ?? null;
  const bandHi = [...bandSeries].reverse().find((p) => p.hi != null)?.hi ?? null;
  const bandMean = bandSeries.length ? +(bandSeries.reduce((a, p) => a + (p.avg ?? 0), 0) / bandSeries.filter((p) => p.avg != null).length).toFixed(2) : null;
  const sUnit = SENSOR_META[sensor]?.unit || "";
  const perTxt = (range === "1n" || range === "7n") ? "%/giờ" : "%/ngày"; // đơn vị độ dốc theo khoảng xem

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--text-strong)" }}><LineIcon className="w-5 h-5" style={{ color: "var(--primary)" }} strokeWidth={1.8} /> Xu hướng & tuân thủ — biểu đồ theo thời gian</h2>
      </div>

      <Card className="relative z-30 p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[12px] uppercase tracking-wider text-muted font-semibold">Khoảng</span>{RANGES.map((r) => <Chip key={r.k} active={range === r.k} onClick={() => { setRange(r.k); setResOverride(null); setDtFrom(""); setDtTo(""); setDtFromDraft(""); setDtToDraft(""); }}>{r.label}</Chip>)}</div>
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[12px] uppercase tracking-wider text-muted font-semibold">Cấp xem</span>{SCOPE_LEVELS.map((s) => <Chip key={s.k} active={level === s.k} onClick={() => { setLevel(s.k); setSelId(""); setOptArea("ALL"); setOptAhu("ALL"); }}>{s.label}</Chip>)}</div>
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[12px] uppercase tracking-wider text-muted font-semibold">Chỉ tiêu</span>{SENSORS.map((s) => <Chip key={s.k} active={sensor === s.k} onClick={() => setSensor(s.k)}>{s.label}</Chip>)}</div>
          {!isSubDay && (
            <div className="flex items-center gap-2 flex-wrap"><span className="text-[12px] uppercase tracking-wider text-muted font-semibold">So sánh</span>
              <Chip active={soKyTruoc} onClick={() => setSoKyTruoc((v) => !v)}>Kỳ trước</Chip>
            </div>
          )}
          {isSubDay && (
            <div className="flex items-center gap-2 flex-wrap"><span className="text-[12px] uppercase tracking-wider text-muted font-semibold">Độ phân giải</span>
              <span className="text-[12px] text-muted">Theo giờ (dữ liệu thu thập 1 giờ/lần)</span>
            </div>
          )}
        </div>
        {/* Chọn khoảng thời gian thủ công (Từ → đến, có nút Áp dụng) — ô tự điền mốc dữ liệu thật */}
        <div className="mt-3 rounded-2xl bg-info-soft/50 ring-1 ring-info-line px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] uppercase tracking-wider text-muted font-semibold">Từ → đến</span>
            <input type="datetime-local" value={dtFromDraft} min={minTs ? toLocalInput(minTs) : undefined} max={maxTs ? toLocalInput(maxTs) : undefined} onChange={(e) => setDtFromDraft(e.target.value)} className={sel} />
            <span className="text-[12px] text-muted">đến</span>
            <input type="datetime-local" value={dtToDraft} min={minTs ? toLocalInput(minTs) : undefined} max={maxTs ? toLocalInput(maxTs) : undefined} onChange={(e) => setDtToDraft(e.target.value)} className={sel} />
            <button onClick={() => { setDtFrom(dtFromDraft); setDtTo(dtToDraft); }} className="text-[12px] font-medium text-white rounded-xl px-3.5 py-2 flex items-center gap-1.5" style={{ backgroundColor: "var(--primary-solid)" }}><Search className="w-3.5 h-3.5" strokeWidth={1.8} /> Áp dụng</button>
            {(dtFrom || dtTo || dtFromDraft || dtToDraft) && <button onClick={() => { setDtFrom(""); setDtTo(""); setDtFromDraft(""); setDtToDraft(""); }} className="text-[12px] text-muted underline">Đặt lại</button>}
            <span className="text-[12px] text-muted ml-1">Đang xem {view.length}/{full.length} điểm ({resLbl})</span>
          </div>
          {/* Khoảng đã chọn THIẾU dữ liệu → nói rõ (thay vì biểu đồ ngắn khó hiểu) */}
          {(() => {
            const days = RANGE_DAYS[range] || 30;
            if (isLive && Array.isArray(mainSeries[trendKey]) && mainSeries[trendKey].length === 0) return <p className="mt-2 text-[12px] text-warning bg-warning-soft ring-1 ring-warning-line rounded-lg px-2.5 py-1.5">⚠ Chưa có dữ liệu trong khoảng đã chọn cho phạm vi này.</p>;
            if (!minTs) return null;
            const thieuNgay = Math.floor((minTs - (Date.now() - days * 86400000)) / 86400000);
            if (thieuNgay < 2) return null;   // đủ (chênh ≤1 ngày là biên bình thường)
            return <p className="mt-2 text-[12px] text-info bg-info-soft ring-1 ring-info-line rounded-lg px-2.5 py-1.5">ℹ️ Khoảng {RANGES.find((r) => r.k === range)?.label} nhưng dữ liệu hệ thống mới có từ <b>{new Date(minTs).toLocaleDateString("vi-VN")}</b> — biểu đồ hiển thị {full.length} điểm hiện có (thiếu ~{thieuNgay} ngày đầu khoảng).</p>;
          })()}
        </div>
        {level !== "TOTAL" && (
          <div className="mt-3 rounded-2xl bg-info-soft/60 ring-1 ring-info-line p-3.5 space-y-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-2 flex-wrap"><span className="text-[12px] uppercase tracking-wider text-muted font-semibold">Lọc khu</span>{["ALL", ...areaList].map((a) => <Chip key={a} active={optArea === a} onClick={() => { setOptArea(a); setOptAhu("ALL"); setSelId(""); }}>{a === "ALL" ? "Tất cả" : a}</Chip>)}</div>
              {(level === "ROOM" || level === "AHU") && ahuList.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap"><span className="text-[12px] uppercase tracking-wider text-muted font-semibold">Lọc AHU</span>{["ALL", ...ahuList].map((a) => <Chip key={a} active={optAhu === a} onClick={() => { setOptAhu(a); setSelId(""); }}>{a === "ALL" ? "Tất cả" : a}</Chip>)}</div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-[12px] uppercase tracking-wider text-muted font-semibold">Chọn {level === "ROOM" ? "phòng" : level === "AHU" ? "AHU" : "khu"}</span>
              <ScopeCombobox items={options} value={activeId} onPick={(id) => setSelId(id)}
                placeholder={`Gõ mã hoặc tên ${level === "ROOM" ? "phòng" : level === "AHU" ? "AHU" : "khu"} để tìm…`}
                levelLabel={`${SCOPE_LEVELS.find((x) => x.k === level)?.label || ""} (${options.length})`} />
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4 flex items-center justify-between flex-wrap gap-3">
        <span className="text-[12px] text-body">Đang chọn: <b style={{ color: "var(--text-strong)" }}>{activeScope.name}</b> · {SENSORS.find((s) => s.k === sensor).label} · {RANGES.find((r) => r.k === range).label}{(dtFrom || dtTo) ? ` · ${view[0]?.label}→${view[view.length - 1]?.label}` : ""}</span>
        <div className="flex gap-2">
          <button onClick={inBaoCaoA4} disabled={dangInBaoCao || aiBusy} className={`text-xs font-medium rounded-xl px-4 py-2 text-body ring-1 ring-line bg-surface hover:bg-subtle flex items-center gap-1.5 ${dangInBaoCao ? "opacity-60 cursor-wait" : ""}`}><Printer className="w-3.5 h-3.5" strokeWidth={1.8} /> {dangInBaoCao ? "Đang soạn báo cáo (chờ AI)…" : "In báo cáo A4 (kèm nhận định hỗ trợ)"}</button>
          <button onClick={() => runAI(false)} disabled={aiBusy} className={`text-xs font-medium rounded-xl px-4 py-2 text-white flex items-center gap-1.5 ${aiBusy ? "opacity-60 cursor-wait" : ""}`} style={{ backgroundColor: "var(--primary-solid)" }}><Sparkles className={`w-3.5 h-3.5 ${aiBusy ? "animate-pulse" : ""}`} strokeWidth={1.8} /> {aiBusy ? "AI đang đọc…" : "Tạo nhận định hỗ trợ"}</button>
          {isLive && aiWebhookSau && <button onClick={() => runAI(true)} disabled={aiBusy} title="Phân tích sâu hơn: nguyên nhân gốc + CAPA đa tầng (IPC/Cơ điện/BMS) + đề xuất phòng ngừa — dùng model mạnh, chạy ~1–3 phút" className={`text-xs font-semibold rounded-xl px-4 py-2 text-white flex items-center gap-1.5 ${aiBusy ? "opacity-60 cursor-wait" : ""}`} style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}><Sparkles className={`w-3.5 h-3.5 ${aiBusy ? "animate-pulse" : ""}`} strokeWidth={2} /> {aiBusy ? "Đang phân tích chi tiết…" : "Phân tích chi tiết (CAPA)"}</button>}
        </div>
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 12/08: KHÔNG gọi là "hiện tại". Đây là điểm CUỐI CÙNG CÓ DỮ LIỆU của chuỗi —
            nguồn chết thì nó đứng yên ở mốc cũ mà chữ "hiện tại" vẫn khẳng định như thật.
            Nêu thẳng mốc thời gian để người đọc tự thấy số này già bao nhiêu. */}
        <KpiCard icon={CheckCircle2} label="Tỉ lệ đạt — mốc mới nhất" value={fmtPct(latest.comp)} sub={`${latest.label ? latest.label + " · " : ""}${activeScope.name} · ${SENSORS.find((s) => s.k === sensor).label}`} accent={{ txt: "text-success", bg: "bg-success-soft", glow: "bg-success-soft" }} />
        <KpiCard icon={Wifi} label="Độ đầy đủ dữ liệu" value={`${latest.dq || "—"}%`} sub="dùng để kết luận" accent={{ txt: "text-info", bg: "bg-info-soft", glow: "bg-info-soft" }} />
        <KpiCard icon={delta7 != null && delta7 < 0 ? TrendingDown : TrendingUp} label="Delta ngày / 7 ngày" value={fmtDelta(deltaDay)} sub={`7 ngày: ${fmtDelta(delta7)}`} accent={{ txt: deltaTone(delta7), bg: "bg-warning-soft", glow: "bg-warning-soft" }} />
        <KpiCard icon={AlertTriangle} label="Giờ cảnh báo (kỳ)" value={fmtH(totalAlert)} sub="Warning + Critical" accent={{ txt: "text-danger", bg: "bg-danger-soft", glow: "bg-danger-soft" }} />
      </div>

      <Card className="p-6"><SectionTitle icon={FileBarChart} hint="1 / 7 / 30 / 90 ngày">Báo cáo xu hướng nhanh</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">{periodCards.map((p) => <div key={p.d} className={`rounded-2xl p-4 ring-1 ${p.status === "FULL" ? "ring-success-line bg-success-soft/50" : "ring-warning-line bg-warning-soft/50"}`}><div className="flex items-center justify-between"><h4 className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{p.d} ngày</h4><span className={`text-[12px] px-2 py-0.5 rounded-full font-medium ${p.status === "FULL" ? "text-success bg-success-soft" : "text-warning bg-warning-soft"}`}>{p.status === "FULL" ? "ĐỦ" : "THIẾU"}</span></div><p className="text-2xl font-light mt-1.5 tabular-nums" style={{ color: "var(--text-strong)" }}>{fmtH(p.alert)}</p><p className="text-[12px] text-muted mt-1">W {fmtH(p.warn)} · C {fmtH(p.crit)}</p><p className="text-[12px] text-muted">Đạt TB {fmtPct(p.avg)} · {p.avail}/{p.d} ngày</p></div>)}</div>
      </Card>

      <div id="trendPrintArea" className="space-y-5">
        {aiBusy && (
          <Card className="p-5 ring-1 ring-success-line">
            <div className="flex items-center gap-3"><Sparkles className="w-5 h-5 animate-pulse" style={{ color: "var(--primary)" }} strokeWidth={1.9} /><div><p className="text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>Đang phân tích qua AI…</p><p className="text-[12px] text-muted">Đang gửi dữ liệu biểu đồ cho AI (OpenAI). Thường mất 10–30 giây — vui lòng đợi.</p></div></div>
          </Card>
        )}
        {/* ============ PHÒNG: phân tích chi tiết khi có lỗi ============ */}
        {isRoom && (<>
          {/* (1) Giá trị trung bình mỗi giờ + dải giới hạn — hiện CẢ 3 chỉ tiêu của phòng */}
          {(() => {
            const bands = (wantRoomBands && roomBandsMulti[roomBandsKey]) || null;
            const ks = bands ? ["DP", "RH", "T"].filter((k) => bands[k] && bands[k].series && bands[k].series.length) : [];
            return (
              <Card className="p-6"><SectionTitle icon={Minus} hint={`${activeScope.name} · trung bình mỗi ${isHourly ? "giờ" : "ngày"} · tất cả chỉ tiêu`}>① Giá trị trung bình &amp; dải giới hạn</SectionTitle>
                {!isLive ? (
                  <p className="mt-4 text-[13px] text-muted">Biểu đồ giá trị trung bình theo phòng hiển thị ở chế độ <b>LIVE</b> (đọc dữ liệu thật từ Supabase).</p>
                ) : !bands ? (
                  <p className="mt-4 text-[13px] text-warning">Đang tải dữ liệu giá trị phòng cho cả 3 chỉ tiêu…</p>
                ) : ks.length === 0 ? (
                  <p className="mt-4 text-[13px] text-muted">Phòng này chưa ghi nhận giá trị (Chênh áp / Độ ẩm / Nhiệt độ) trong khoảng đã chọn.</p>
                ) : (
                  <div className="mt-4 divide-y divide-line">{ks.map((k, idx) => <div key={k} className={idx > 0 ? "pt-6" : ""}><Chart type="roomBand" sensorKey={k} series={bands[k].series} baseline={bands[k].baseline} isHourly={isHourly} group={`bands-${activeId}`} h={296} /></div>)}</div>
                )}
              </Card>
            );
          })()}
          {/* (2) % đạt / OOS theo thời gian — vẽ đủ cảm biến phòng có */}
          <Card className="p-6"><SectionTitle icon={LineIcon} hint={showMulti ? `${activeScope.name} · ${sensorsPresent.map((k) => SENSOR_META[k]?.label).join(" · ")} · theo ${isHourly ? "giờ" : "ngày"}` : `${activeScope.name} · ${SENSORS.find((s) => s.k === sensor).label} · theo ${isHourly ? "giờ" : "ngày"}`}>② % đạt / OOS theo thời gian{showMulti ? " — theo từng cảm biến" : ""}</SectionTitle>
            <p className="text-[12px] text-muted mt-1">% đạt = 100% − % ngoài giới hạn (OOS). Đường dưới mốc 80% là kỳ cần chú ý.</p>
            <div className="mt-3">{showMulti
              ? <Chart type="complyPerMetric" data={viewMulti} present={sensorsPresent} h={296} />
              : <Chart type="complyTotal" data={view} idSuffix="RoomOne" incidents={incidentMarks} prevData={prevData} h={296} onPointClick={chonDiem} />}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-muted">{showMulti ? sensorsPresent.map((k) => <span key={k} className="flex items-center gap-1"><span className="w-4 inline-block border-t-2" style={{ borderColor: SENSOR_COLOR[k] }} /> {SENSOR_META[k]?.label || k}</span>) : (<><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COMPLY_OK }} /> ≥ 80% đạt</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COMPLY_BAD }} /> &lt; 80% (điểm đỏ)</span></>)}<span className="flex items-center gap-1"><span className="w-4 inline-block border-t-2 border-dashed" style={{ borderColor: "var(--warning-line)" }} /> Ngưỡng 80%</span></div>
          </Card>
          {/* (3) SPC — Levey-Jennings quanh nền 30 ngày (A2) */}
          <details className="rounded-2xl ring-1 ring-line px-1 py-1"><summary className="cursor-pointer px-4 py-2.5 text-[13px] font-medium text-muted select-none">Phân tích nâng cao — kiểm soát thống kê (SPC) ▾</summary>
          <Card className="p-6"><SectionTitle icon={Activity} hint={`${activeScope.name} · vùng ±1/2/3σ quanh nền 30 ngày · tín hiệu Nelson`}>③ Kiểm soát thống kê (SPC — Levey-Jennings)</SectionTitle>
            <p className="text-[12px] text-muted mt-1">Phát hiện <b>dịch chuyển/xu hướng trước khi vượt ngưỡng OOS</b>: điểm cam = tín hiệu Nelson R2 (9 điểm cùng phía) / R3 (6 điểm đơn điệu), điểm đỏ = vượt 3σ (R1). Nền TB±σ do job đêm tính (tất định) — kết luận chính thức theo bảng SPC bên dưới trang.</p>
            {(() => {
              const bands = (wantRoomBands && roomBandsMulti[roomBandsKey]) || null;
              const ks = bands ? ["DP", "RH", "T"].filter((k) => bands[k] && bands[k].series && bands[k].series.length) : [];
              if (!isLive) return <p className="mt-4 text-[13px] text-muted">Biểu đồ SPC hiển thị ở chế độ <b>LIVE</b>.</p>;
              if (!bands) return <p className="mt-4 text-[13px] text-warning">Đang tải dữ liệu…</p>;
              if (!ks.length) return <p className="mt-4 text-[13px] text-muted">Chưa có chuỗi giá trị để dựng biểu đồ kiểm soát trong khoảng đã chọn.</p>;
              return <div className="mt-4 divide-y divide-line">{ks.map((k, idx) => (
                <div key={k} className={idx > 0 ? "pt-6" : ""}>
                  <div className="flex items-center gap-2 mb-2"><span className="w-3 h-3 rounded-full shrink-0" style={{ background: SENSOR_COLOR[k] }} /><h4 className="text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>{SENSOR_META[k]?.label} ({k})</h4></div>
                  <Chart type="spc" sensorKey={k} series={bands[k].series} baseline={bands[k].baseline} group={`bands-${activeId}`} h={230} />
                </div>
              ))}</div>;
            })()}
          </Card>
          </details>
        </>)}

        {/* ============ KHU / AHU / TỔNG: tổng quát + theo chỉ tiêu ============ */}
        {isLargeScope && (<>
          {/* (1) % đạt / OOS TOÀN PHẦN (hoặc theo chỉ tiêu đang chọn) */}
          <Card className="p-6"><SectionTitle icon={LineIcon} hint={`${activeScope.name} · ${sensor === "ALL" ? "toàn phần" : SENSOR_META[sensor]?.label} · theo ${isHourly ? "giờ" : "ngày"}`}>① % đạt / OOS {sensor === "ALL" ? "toàn phần" : `— ${SENSOR_META[sensor]?.label}`} theo thời gian</SectionTitle>
            <p className="text-[12px] text-muted mt-1">{sensor === "ALL" ? "Tổng hợp mọi cảm biến trong phạm vi" : `Chỉ riêng ${SENSOR_META[sensor]?.label}`}. % đạt = 100% − % ngoài giới hạn (OOS). Vùng xanh nhạt minh hoạ mức đạt.</p>
            <div className="mt-3"><Chart type="complyTotal" data={view} idSuffix="Large" incidents={incidentMarks} prevData={prevData} h={296} onPointClick={chonDiem} /></div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-muted"><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COMPLY_OK }} /> ≥ 80% đạt</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COMPLY_BAD }} /> &lt; 80% (điểm đỏ)</span><span className="flex items-center gap-1"><span className="w-4 inline-block border-t-2 border-dashed" style={{ borderColor: "var(--warning-line)" }} /> Ngưỡng 80%</span></div>
          </Card>
          {/* (2) % đạt / OOS THEO TỪNG CHỈ TIÊU */}
          <Card className="p-6"><SectionTitle icon={CircleDot} hint={`${activeScope.name} · theo từng chỉ tiêu · theo ${isHourly ? "giờ" : "ngày"}`}>② % đạt / OOS theo từng chỉ tiêu</SectionTitle>
            <p className="text-[12px] text-muted mt-1">Tách riêng <span style={{ color: SENSOR_COLOR.DP }}>Chênh áp</span>, <span style={{ color: SENSOR_COLOR.RH }}>Độ ẩm</span>, <span style={{ color: SENSOR_COLOR.T }}>Nhiệt độ</span> để thấy chỉ tiêu nào kéo tỉ lệ đạt xuống.</p>
            {sensorsPresent.length > 0 && viewMulti.length > 0 ? (<>
              <div className="mt-3"><Chart type="complyPerMetric" data={viewMulti} present={sensorsPresent} h={296} /></div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-muted">{sensorsPresent.map((k) => <span key={k} className="flex items-center gap-1"><span className="w-4 inline-block border-t-2" style={{ borderColor: SENSOR_COLOR[k] }} /> {SENSOR_META[k]?.label || k}</span>)}<span className="flex items-center gap-1"><span className="w-4 inline-block border-t-2 border-dashed" style={{ borderColor: "var(--warning-line)" }} /> Ngưỡng 80%</span></div>
            </>) : (
              <p className="mt-4 text-[13px] text-warning">Đang tải dữ liệu theo chỉ tiêu… (nếu trống, phạm vi này chưa có đủ dữ liệu cảm biến trong khoảng đã chọn)</p>
            )}
          </Card>
        </>)}

        {/* ============ CHUNG: lịch tuân thủ 90 ngày (A2 — heatmap) ============ */}
        {isLive && (
          {/* Phase E (báo cáo 9): bỏ Lịch tuân thủ 90 ngày — trùng vai với Bản đồ phòng × ngày */}
        )}

        {/* ============ CHUNG: phân tích kỹ thuật phục vụ AI ============ */}
        <details className="rounded-2xl ring-1 ring-line px-1 py-1"><summary className="cursor-pointer px-4 py-2.5 text-[13px] font-medium text-muted select-none">Phân tích nâng cao — phân tích kỹ thuật &amp; dữ liệu thô ▾</summary>
        <Card className="p-6"><SectionTitle icon={CircleDot} hint="dữ liệu phân tích kỹ thuật phục vụ AI đánh giá xu hướng">Phân tích kỹ thuật xu hướng</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">{[
            ["Số điểm", tech.n ? `${tech.n}` : "—", "text-body"],
            ["Tỉ lệ đạt TB", tech.n ? `${tech.mean.toFixed(1)}%` : "—", "text-success"],
            ["Độ lệch chuẩn", tech.std != null ? `${tech.std.toFixed(1)}%` : "—", "text-info"],
            ["Độ dốc xu hướng", tech.n >= 2 ? `${tech.slope > 0 ? "+" : ""}${tech.slope.toFixed(2)} ${perTxt}` : "—", deltaTone(tech.slope * 10)],
            ["R² (độ tin cậy)", tech.n >= 2 ? tech.r2.toFixed(2) : "—", "text-body"],
            ["Tổng điểm OOS", `${tech.totOos ?? 0}`, "text-danger"],
          ].map(([k, v, c]) => <div key={k} className="rounded-2xl bg-subtle ring-1 ring-line/70 p-3"><p className="text-[12px] uppercase tracking-wider text-muted font-semibold leading-tight">{k}</p><p className={`text-lg font-light mt-1 tabular-nums ${c}`}>{v}</p></div>)}</div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">{[["Đạt 1 ngày", fmtPct(activeScope.dat1n)], ["Đạt 3 ngày", fmtPct(activeScope.dat3n)], ["Đạt 7 ngày", fmtPct(activeScope.dat7n)], ["Min–Max kỳ", tech.n ? `${tech.vmin.toFixed(0)}–${tech.vmax.toFixed(0)}%` : "—"]].map(([k, v]) => <div key={k} className="rounded-xl bg-surface ring-1 ring-line py-2"><p className="text-[12px] uppercase text-muted font-semibold">{k}</p><p className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--text-strong)" }}>{v}</p></div>)}</div>
          <p className="text-[12px] text-muted mt-3">Độ dốc &gt; 0 là xu hướng cải thiện; R² càng gần 1 thì xu hướng càng rõ. Đây là <b>số liệu tất định</b> (hệ thống tính). Bấm <b>“Tạo nhận định hỗ trợ”</b> để AI diễn giải &amp; gợi ý (không thay thế kết luận GMP).</p>
        </Card>

        {/* ====== BẢNG DỮ LIỆU THÔ + ĐÁNH GIÁ CƠ BẢN (tất định, TRƯỚC khi AI gợi ý / QA kết luận) ====== */}
        <Card className="p-6"><SectionTitle icon={FileBarChart} hint={`${activeScope.name} · ${resLbl} · số liệu nền để tự đánh giá xu hướng — trước khi AI gợi ý / QA kết luận`}>Bảng dữ liệu thô &amp; đánh giá cơ bản</SectionTitle>
          {(() => {
            const fv = (x, d = 2) => (x == null || isNaN(x) ? "—" : (+x).toFixed(d));
            const bands = (isRoom && wantRoomBands && roomBandsMulti[roomBandsKey]) || null;
            const ksB = bands ? ["DP", "RH", "T"].filter((k) => bands[k] && bands[k].series && bands[k].series.length) : [];
            if (isRoom && ksB.length) {
              return <div className="mt-4 space-y-6">{ksB.map((k) => {
                const s = bands[k].series; const unit = SENSOR_META[k]?.unit || "";
                const lo = [...s].reverse().find((p) => p.lo != null)?.lo ?? null;
                const hi = [...s].reverse().find((p) => p.hi != null)?.hi ?? null;
                const vals = s.filter((p) => p.avg != null).map((p) => p.avg);
                const st = regStat(vals);
                const within = vals.filter((v) => (lo == null || v >= lo) && (hi == null || v <= hi)).length;
                const pctIn = vals.length ? (within / vals.length * 100) : null;
                const perUnit = donVi === "NGAY" ? `${unit}/ngày` : `${unit}/giờ`;
                const b = bands[k].baseline;
                const evalCards = [
                  ["TB kỳ", `${fv(st.mean)} ${unit}`], ["Min–Max", `${fv(st.vmin)}–${fv(st.vmax)} ${unit}`],
                  ["Độ lệch chuẩn σ", `${fv(st.std)} ${unit}`], ["Giới hạn GHD–GHT", `${lo == null ? "—" : lo}–${hi == null ? "—" : hi} ${unit}`],
                  ["% trong giới hạn", pctIn == null ? "—" : `${pctIn.toFixed(1)}%`], ["Điểm ngoài GH", `${vals.length - within}/${vals.length}`],
                  ["Xu hướng", st.n >= 2 ? `${st.slope > 0 ? "+" : ""}${st.slope.toFixed(3)} ${perUnit} · R²=${st.r2.toFixed(2)}` : "—"],
                  ["Nền 30 ngày", b && b.tb != null ? `${b.tb}${b.sigma != null ? `±${b.sigma}` : ""} ${unit}` : "—"],
                ];
                return (
                  <div key={k}>
                    <div className="flex items-center gap-2 mb-2"><span className="w-3 h-3 rounded-full" style={{ background: SENSOR_COLOR[k] }} /><h4 className="text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>{SENSOR_META[k]?.label} ({k})</h4><span className="text-[12px] text-muted">— đánh giá cơ bản (hệ thống tính)</span></div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">{evalCards.map(([kk, vv]) => <div key={kk} className="rounded-xl bg-subtle ring-1 ring-line/70 py-1.5 px-2 text-center"><p className="text-[12px] uppercase text-muted font-semibold leading-tight">{kk}</p><p className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--text-strong)" }}>{vv}</p></div>)}</div>
                    <div className="overflow-auto max-h-72 rounded-xl ring-1 ring-line"><table className="w-full text-[12px]"><thead className="sticky top-0 bg-subtle"><tr className="text-muted text-left text-[12px] uppercase tracking-wider">{["Thời điểm", "TB", "Min", "Max", "P5", "P50", "P95", "GHD", "GHT", "TT"].map((h) => <th key={h} className="py-2 px-2 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{[...s].reverse().map((p, i) => { const oob = (lo != null && p.avg < lo) || (hi != null && p.avg > hi); return <tr key={i} className={`border-t border-line ${oob ? "bg-danger-soft/50" : ""}`}><td className="py-1.5 px-2 text-muted whitespace-nowrap">{p.label}</td><td className={`py-1.5 px-2 tabular-nums font-medium ${oob ? "text-danger" : ""}`}>{fv(p.avg)}</td><td className="py-1.5 px-2 tabular-nums text-muted">{fv(p.vmin)}</td><td className="py-1.5 px-2 tabular-nums text-muted">{fv(p.vmax)}</td><td className="py-1.5 px-2 tabular-nums text-muted">{fv(p.p5)}</td><td className="py-1.5 px-2 tabular-nums text-muted">{fv(p.p50)}</td><td className="py-1.5 px-2 tabular-nums text-muted">{fv(p.p95)}</td><td className="py-1.5 px-2 tabular-nums text-muted">{lo == null ? "—" : lo}</td><td className="py-1.5 px-2 tabular-nums text-muted">{hi == null ? "—" : hi}</td><td className="py-1.5 px-2">{oob ? <span className="text-danger font-semibold">OOS</span> : <span className="text-success">Đạt</span>}</td></tr>; })}</tbody></table></div>
                  </div>
                );
              })}</div>;
            }
            if (view.length) {
              const vm = {}; viewMulti.forEach((r) => { vm[r.ts] = r; });
              return (
                <div className="mt-4">
                  <p className="text-[12px] text-muted mb-2">% đạt = 100 − % ngoài giới hạn (OOS) · tổng hợp cảm biến trong phạm vi <b>{activeScope.name}</b>.</p>
                  <div className="overflow-auto max-h-72 rounded-xl ring-1 ring-line"><table className="w-full text-[12px]"><thead className="sticky top-0 bg-subtle"><tr className="text-muted text-left text-[12px] uppercase tracking-wider">{["Thời điểm", "% đạt", "OOS", "DQ", ...sensorsPresent.map((k) => SENSOR_META[k]?.label || k)].map((h) => <th key={h} className="py-2 px-2 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{[...view].reverse().map((r, i) => { const low = r.comp != null && r.comp < 80; const m = vm[r.ts] || {}; return <tr key={i} className={`border-t border-line ${low ? "bg-warning-soft/40" : ""}`}><td className="py-1.5 px-2 text-muted whitespace-nowrap">{r.label}</td><td className={`py-1.5 px-2 tabular-nums font-medium ${low ? "text-warning" : ""}`}>{fmtPct(r.comp)}</td><td className="py-1.5 px-2 tabular-nums text-muted">{r.oos ?? "—"}</td><td className="py-1.5 px-2 tabular-nums text-muted">{r.dq == null ? "—" : `${r.dq}%`}</td>{sensorsPresent.map((k) => <td key={k} className="py-1.5 px-2 tabular-nums text-muted">{fmtPct(m[`comp_${k}`])}</td>)}</tr>; })}</tbody></table></div>
                </div>
              );
            }
            return <p className="mt-4 text-[13px] text-muted">Chưa có dữ liệu trong khoảng đã chọn để lập bảng.</p>;
          })()}
          <p className="text-[12px] text-muted mt-3">Bảng &amp; đánh giá này là <b>số liệu tất định</b> từ dữ liệu đo — <b>giới hạn GHD/GHT lấy theo từng phòng trong CSDL</b> (không phải AI đặt). Dùng để <b>tự đánh giá xu hướng trước khi</b> AI gợi ý và QA kết luận.</p>
        </Card>
        </details>
      </div>

      {isLive && maTran && (
      <Card className="p-6"><SectionTitle icon={CircleDot} hint="% đạt mỗi phòng theo ngày · phòng rủi ro nhất xếp trên">Phòng cần chú ý — bản đồ phòng × ngày</SectionTitle>
        <div className="mt-3"><Chart type="roomDayHeat" rooms={maTran.rooms} days={maTran.days} values={maTran.values} height={Math.max(180, maTran.rooms.length * 20 + 70)} h={Math.max(180, maTran.rooms.length * 20 + 70)} /></div>
      </Card>
      )}
      <Card className="p-6"><SectionTitle icon={CircleDot} hint="% điểm đạt mỗi cấp · theo dõi nhanh">Xu hướng theo cấp</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">{miniScopes.map(([lvl, sc]) => { const d = sc._series ? sc._series.slice(-(RANGE_DAYS[range] || 30)) : getSeries(sc, sensor, range); const lt = d[d.length - 1] || {}; const p = lt.comp; const pc = p == null ? "#94a3b8" : p < 70 ? COMPLY_BAD : p < 88 ? "#d99a2b" : COMPLY_OK; return <div key={lvl} className="rounded-2xl bg-subtle ring-1 ring-line/70 p-3"><div className="flex items-center justify-between mb-1"><p className="text-xs font-semibold" style={{ color: "var(--text-strong)" }}>{SCOPE_LEVELS.find((x) => x.k === lvl).label}</p><span className="text-[12px] px-2 py-0.5 rounded-full text-body bg-surface ring-1 ring-line">{sc.id}</span></div><div className="flex items-baseline gap-1.5 mb-1"><span className="text-2xl font-light tabular-nums leading-none" style={{ color: pc }}>{p == null ? "—" : fmtPct(p)}</span><span className="text-[12px] text-muted">% đạt mới nhất</span></div><p className="text-[12px] text-muted mb-1 truncate">{sc.name}</p><Chart type="miniArea" data={d} h={84} /></div>; })}</div>
      </Card>

      <Card className="p-6"><SectionTitle icon={AlertOctagon} hint="Tổng → Khu → AHU → Phòng · tỉ lệ đạt 1/3/7 ngày">Xếp hạng rủi ro</SectionTitle>
        <div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-muted text-left text-[12px] uppercase tracking-wider">{["Cấp", "Đối tượng", "Khu/AHU", "Đạt 1n", "Đạt 3n", "Đạt 7n", "Δ 7 ngày", "Xu hướng 14n", "Risk", "Đánh giá"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{riskRows.map((r) => { const comp = r.dat1n != null ? r.dat1n : r.latest.compliance; const a = comp == null ? ["Chờ dữ liệu", "text-muted"] : comp < 70 ? ["Cần điều tra ưu tiên", "text-danger"] : comp < 88 ? ["Cần chú ý", "text-warning"] : ["Tốt", "text-success"]; const canPick = isLive && (r.type === level || level === "TOTAL"); return <tr key={`${r.type}:${r.id}`} className={`border-t border-line hover:bg-info-soft/40 ${r.type === "TOTAL" ? "bg-success-soft/30" : ""}`}><td className="py-2.5 pr-4 text-muted whitespace-nowrap">{SCOPE_LEVELS.find((x) => x.k === r.type)?.label}</td><td className="py-2.5 pr-4"><button disabled={!canPick} onClick={() => { if (r.type !== "TOTAL") { setLevel(r.type); setSelId(r.id); } else { setLevel("TOTAL"); } }} className={`text-left ${canPick ? "hover:underline" : ""}`}><span className="font-semibold" style={{ color: "var(--text-strong)" }}>{r.id}</span> <span className="text-muted">{r.name}</span></button></td><td className="py-2.5 pr-4 text-muted whitespace-nowrap">{[r.area, r.ahu].filter(Boolean).join(" / ") || "—"}</td><td className="py-2.5 pr-4 tabular-nums font-medium">{fmtPct(r.dat1n)}</td><td className="py-2.5 pr-4 tabular-nums text-body">{fmtPct(r.dat3n)}</td><td className="py-2.5 pr-4 tabular-nums text-body">{fmtPct(r.dat7n)}</td><td className={`py-2.5 pr-4 tabular-nums font-medium ${deltaTone(r.delta7)}`}>{fmtDelta(r.delta7)}</td><td className="py-2.5 pr-4"><Chart type="sparkline" chuoi={r.chuoi} h={30} /></td><td className="py-2.5 pr-4"><span className="inline-block px-2 py-0.5 rounded-full text-[12px] font-medium" style={{ backgroundColor: "rgba(226,103,79,0.14)", color: "var(--danger)" }}>{r.risk >= 999 ? "—" : r.risk}</span></td><td className={`py-2.5 pr-4 font-semibold whitespace-nowrap ${a[1]}`}>{a[0]}</td></tr>; })}</tbody></table></div>
        <p className="text-[12px] text-muted mt-2">Bấm vào tên đối tượng để xem nhanh xu hướng của cấp đó. Tỉ lệ đạt = trung bình tuân thủ trong 1 / 3 / 7 ngày gần nhất.</p>
      </Card>

      {/* Mảng 3 — Dự báo xu hướng (RPC gate R²) */}
      {isLive && (
      <Card className="p-6"><SectionTitle icon={LineIcon} hint="hồi quy OLS + cổng R²≥0.5 · dải tin cậy robust (MAD) · dữ liệu thật">Ước tính xu hướng 7 ngày</SectionTitle>
        {dbBusy && !duBao ? <div className="mt-3 h-16 rounded-2xl bg-subtle animate-pulse" /> :
         !duBao ? <p className="mt-3 text-[13px] text-muted italic">Chưa đủ dữ liệu để dự báo cho phạm vi đang chọn.</p> :
         (duBao.du_bao_dang_tin && (duBao.du_bao || []).length) ? (() => {
           const last = duBao.du_bao[duBao.du_bao.length - 1];
           const hv = { cai_thien: ["Cải thiện", COMPLY_OK], xau_di: ["Xấu đi", COMPLY_BAD], on_dinh: ["Ổn định", "#5f7a90"] }[duBao.huong] || ["—", "#5f7a90"];
           return (
             <div className="mt-3">
               <div className="flex items-baseline gap-3 flex-wrap">
                 <span className="text-3xl font-light tabular-nums" style={{ color: COMPLY_OK }}>{fmtPct(last.gia_tri)}</span>
                 <span className="text-[12px] text-muted">dự kiến sau 7 ngày · dải {fmtPct(last.canh_duoi)}–{fmtPct(last.canh_tren)}</span>
                 <span className="text-[12px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: hv[1] + "22", color: hv[1] }}>{hv[0]}</span>
                 <span className="text-[12px] text-muted">R²={(+duBao.r2).toFixed(2)}</span>
               </div>
               <p className="mt-2 text-[12px] leading-relaxed text-body">{duBao.ghi_chu}</p>
               {(duBao.chuoi || []).length >= 2 && <div className="mt-3"><Chart type="forecast" chuoi={duBao.chuoi} duBao={duBao.du_bao} h={180} /></div>}
             </div>
           );
         })() : (
           <div className="mt-3 rounded-2xl bg-subtle ring-1 ring-line/70 p-4">
             <p className="text-[13px] font-semibold text-body">Không chiếu dự báo</p>
             <p className="text-[12px] text-muted mt-1">{duBao.ghi_chu}</p>
           </div>
         )}
      </Card>
      )}

      {/* Mảng 3 — Bản đồ tuân thủ phòng × ngày (chỉ cấp Tổng/Khu) */}

        {diemChon != null && view[diemChon] && (() => { const d = view[diemChon]; const sc = (incidentMarks || []).filter((m) => m.idx === diemChon); return (
          <InspectorDrawer onClose={() => setDiemChon(null)} eyebrow={`${activeScope.name} · ${SENSORS.find((x) => x.k === sensor).label}`} title={`Chi tiết ${d.label}`}>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <div className="rounded-xl bg-subtle px-3 py-2"><span className="text-muted block text-[12px] uppercase tracking-wider">Tỉ lệ đạt</span><span className="font-semibold text-body tabular-nums text-[18px]">{d.comp != null ? `${d.comp}%` : "—"}</span></div>
              <div className="rounded-xl bg-subtle px-3 py-2"><span className="text-muted block text-[12px] uppercase tracking-wider">Độ đầy dữ liệu</span><span className="font-semibold text-body tabular-nums text-[18px]">{d.dq != null ? `${d.dq}%` : "—"}</span></div>
              <div className="rounded-xl bg-subtle px-3 py-2"><span className="text-muted block text-[12px] uppercase tracking-wider">Giờ cảnh báo</span><span className="font-semibold text-warning tabular-nums">{d.warnH}</span></div>
              <div className="rounded-xl bg-subtle px-3 py-2"><span className="text-muted block text-[12px] uppercase tracking-wider">Giờ nghiêm trọng</span><span className="font-semibold text-danger tabular-nums">{d.critH}</span></div>
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">Phiếu sự cố mở trong kỳ này</p>
              {sc.length === 0 ? <p className="mt-1.5 text-[12px] text-muted italic">Không có phiếu sự cố gắn với mốc này.</p>
                : <ul className="mt-1.5 space-y-1">{sc.map((m, i) => <li key={i} className="text-[13px] text-body">⚑ {m.name}</li>)}</ul>}
              <p className="mt-2 text-[12px] text-muted">Xem đầy đủ ở tab <b>Sự cố</b>.</p>
            </div>
            <p className="text-[12px] meta">Số liệu tất định do hệ thống tính — bấm điểm khác trên biểu đồ để so sánh.</p>
          </InspectorDrawer>
        ); })()}
        {/* G3: Nhận định hỗ trợ đặt SAU toàn bộ dữ liệu tất định (thứ tự theo báo cáo nâng cấp) */}
        {!aiBusy && aiResult && (() => { const al = [{ l: "Kiểm soát tốt", c: "text-success", bg: "bg-success-soft", ring: "ring-success-line" }, { l: "Cần chú ý", c: "text-info", bg: "bg-info-soft", ring: "ring-info-line" }, { l: "Cảnh báo", c: "text-warning", bg: "bg-warning-soft", ring: "ring-warning-line" }, { l: "Hành động", c: "text-danger", bg: "bg-danger-soft", ring: "ring-danger-line" }][aiResult.level]; return (
          <Card className={`p-5 ring-1 ${al.ring}`}>
            <div className="flex items-center justify-between flex-wrap gap-2"><SectionTitle icon={Sparkles}>Gợi ý đọc biểu đồ (AI hỗ trợ)</SectionTitle><div className="flex items-center gap-2">{aiResult.nguon === "openai" && <span className="text-[12px] font-semibold px-2 py-1 rounded-full bg-success-soft text-success ring-1 ring-success-line">OpenAI</span>}{aiResult.nguon === "cuc_bo" && <span className="text-[12px] font-semibold px-2 py-1 rounded-full bg-subtle text-muted">Tự luận cục bộ</span>}<span className={`text-[12px] font-semibold px-2.5 py-1 rounded-full ${al.bg} ${al.c}`}>Gợi ý mức: {al.l}</span></div></div>
            <p className="mt-1 mb-2 text-[12px] text-muted bg-subtle ring-1 ring-line/70 rounded-lg px-3 py-1.5">ℹ️ AI chỉ <b>đọc số liệu và gợi ý</b> — mọi con số do hệ thống tính (SQL/thống kê), <b>không phải AI</b>. Kết luận &amp; quyết định GMP do IPC/QA phê duyệt.</p>
            <AiSections text={aiResult.text} />
            {aiNote && <p className="mt-3 text-[12px] text-warning bg-warning-soft ring-1 ring-warning-line rounded-xl px-3 py-2">⚠ {aiNote}</p>}
            {wf7bUrl && (
              <div className="mt-4 border-t border-line pt-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => { setEmailOpen((v) => !v); setSendMsg(null); }} disabled={!!sendBusy} className="text-xs font-medium rounded-xl px-3.5 py-2 text-body ring-1 ring-line bg-surface hover:bg-subtle flex items-center gap-1.5 disabled:opacity-60"><Mail className="w-3.5 h-3.5" strokeWidth={1.8} /> Gửi email (tuỳ chọn)</button>
                  <button onClick={luuDriveNhanDinh} disabled={!!sendBusy} className="text-xs font-medium rounded-xl px-3.5 py-2 text-white flex items-center gap-1.5 disabled:opacity-60" style={{ backgroundColor: "var(--primary-solid)" }}><Save className={`w-3.5 h-3.5 ${sendBusy === "drive" ? "animate-pulse" : ""}`} strokeWidth={1.8} /> {sendBusy === "drive" ? "Đang lưu…" : "Lưu vào Drive"}</button>
                  <span className="text-[12px] text-muted">Lưu bản nhận định này (.html) vào Google Drive; email là tuỳ chọn.</span>
                </div>
                {emailOpen && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && guiEmailNhanDinh()} placeholder="email1@…, email2@… (phân tách bằng dấu phẩy)" className="flex-1 min-w-[240px] rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-[12px] text-body outline-none focus:ring-2 focus:ring-success-line" />
                    <button onClick={guiEmailNhanDinh} disabled={sendBusy === "email"} className="text-xs font-semibold rounded-xl px-4 py-2 text-white flex items-center gap-1.5 disabled:opacity-60" style={{ backgroundColor: "var(--primary-solid)" }}>{sendBusy === "email" ? "Đang gửi…" : "Gửi email"}</button>
                  </div>
                )}
                {sendMsg && <p className={`mt-2 text-[12px] rounded-xl px-3 py-2 ring-1 ${sendMsg.ok ? "text-success bg-success-soft ring-success-line" : "text-danger bg-danger-soft ring-danger-line"}`}>{sendMsg.ok ? "✓ " : "✗ "}{sendMsg.text}</p>}
              </div>
            )}
            <p className="mt-3 text-[12px] text-muted">Nhận định lúc {aiResult.time} · đã lưu vào hệ thống (tab Báo cáo).</p>
          </Card>
        ); })()}
    </div>
  );
}

export default TrendPage;
