// baoCaoPhongHtml.js — Tạo tài liệu HTML "Báo cáo điều kiện phòng" (09/11/2026).
// MỘT hàm dùng chung cho cả hiển thị trong trang (iframe srcDoc) và file tải về → màn hình = file gửi đi.
// Không có <script> (web chạy CSP chặn script inline); tooltip dùng <title> của SVG.
import { DON_VI, TEN_CHI_TIEU, THU_TU, so } from "./phanTichDieuKienPhong.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nguyen = (x) => (+x).toLocaleString("vi-VN");
const ngayVN = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");
const nhanKhoang = (tu, den) => (tu === den ? ngayVN(den) : `${ngayVN(tu)} – ${ngayVN(den)}`);
const MUC_HE_THONG = { NORMAL: "Bình thường", NOTICE: "Lưu ý", WARNING: "Cảnh báo", CRITICAL: "Nghiêm trọng", SUPPRESSED: "Tạm hoãn" };

const KET_LUAN = {
  DAT: { cls: "good", icon: "✔", text: "Đạt" },
  KHONG_DAT: { cls: "bad", icon: "✖", text: "Không đạt" },
  KHONG_CO_DL: { cls: "warn", icon: "!", text: "Không có dữ liệu" },
  CHUA_DU_DL: { cls: "warn", icon: "!", text: "Chưa đủ dữ liệu" },
};
const badge = (kq) => `<span class="badge ${KET_LUAN[kq].cls}">${KET_LUAN[kq].icon} ${KET_LUAN[kq].text}</span>`;

// ---------- Biểu đồ SVG: TB theo giờ + dải min–max + giới hạn ----------
function bieuDo(dong, tt, loai, nhieuNgay) {
  if (!dong.length) return `<figure class="chart"><figcaption>${esc(TEN_CHI_TIEU[loai])} (${DON_VI[loai]})</figcaption><p class="note">Không có dữ liệu.</p></figure>`;
  const W = 640, H = 240, L = 46, R = 14, T = 14, B = 28;
  const ds = dong.filter((r) => r.tb != null);
  const vals = ds.flatMap((r) => [+r.min, +r.max]).concat([tt.duoi, tt.tren].filter((v) => v != null));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const dem = (hi - lo) * 0.08 || 1; lo -= dem; hi += dem;
  const t0 = +dong[0].ts, t1 = +dong[dong.length - 1].ts;
  const sx = (ts) => L + (t1 === t0 ? 0.5 : (ts - t0) / (t1 - t0)) * (W - L - R);
  const sy = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  let buoc = (hi - lo) / 5;
  buoc = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50].find((m) => buoc <= m) || Math.ceil(buoc / 10) * 10;
  let luoi = "";
  for (let v = Math.floor(lo / buoc + 1) * buoc; v < hi; v += buoc) {
    luoi += `<line class="grid" x1="${L}" x2="${W - R}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}"/><text class="ax" x="${L - 6}" y="${(sy(v) + 4).toFixed(1)}" text-anchor="end">${so(v, buoc < 1 ? 1 : 0)}</text>`;
  }
  // nhãn trục x: theo giờ (1 ngày) hoặc theo ngày (nhiều ngày)
  let trucX = "";
  if (!nhieuNgay) dong.filter((r) => +r.gio.slice(0, 2) % 3 === 0).forEach((r) => { trucX += `<text class="ax" x="${sx(+r.ts).toFixed(1)}" y="${H - 8}" text-anchor="middle">${r.gio.slice(0, 2)}h</text>`; });
  else {
    const ngays = [...new Set(dong.map((r) => r.ngay))];
    const buocN = Math.max(1, Math.ceil(ngays.length / 8));
    ngays.forEach((n, i) => { if (i % buocN) return; const r = dong.find((x) => x.ngay === n); trucX += `<text class="ax" x="${sx(+r.ts).toFixed(1)}" y="${H - 8}" text-anchor="middle">${n.slice(8, 10)}/${n.slice(5, 7)}</text>`; });
  }
  // dải min–max và đường TB: cắt đoạn khi thiếu giờ (> 1 giờ cách nhau)
  const doan = [];
  ds.forEach((r, i) => { if (!i || +r.ts - +ds[i - 1].ts > 3600000) doan.push([]); doan[doan.length - 1].push(r); });
  const dai = doan.map((d) => `<polygon class="band" points="${d.map((r) => `${sx(+r.ts).toFixed(1)},${sy(+r.max).toFixed(1)}`).join(" ")} ${[...d].reverse().map((r) => `${sx(+r.ts).toFixed(1)},${sy(+r.min).toFixed(1)}`).join(" ")}"/>`).join("");
  const duong = doan.map((d) => `<polyline class="line" points="${d.map((r) => `${sx(+r.ts).toFixed(1)},${sy(+r.tb).toFixed(1)}`).join(" ")}"/>`).join("");
  const gioiHan = [["GH trên", tt.tren], ["GH dưới", tt.duoi]].filter(([, v]) => v != null).map(([ten, v]) =>
    `<line class="lim" x1="${L}" x2="${W - R}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}"/><text class="limt" x="${W - R - 4}" y="${(sy(v) - 4).toFixed(1)}" text-anchor="end">${ten} ${so(v, 1)}</text>`).join("");
  const rDiem = ds.length > 200 ? 1.6 : ds.length > 72 ? 2.5 : 4;
  const diem = ds.map((r) => {
    const tip = `${nhieuNgay ? `${r.ngay.slice(8, 10)}/${r.ngay.slice(5, 7)} ` : ""}${r.gio} · TB ${so(r.tb)} ${DON_VI[loai]} · min ${so(r.min)} · max ${so(r.max)} · ngoài GH ${r.oos}/${r.hop_le} điểm`;
    return `<circle cx="${sx(+r.ts).toFixed(1)}" cy="${sy(+r.tb).toFixed(1)}" r="${rDiem}" class="${+r.oos > 0 ? "oos" : "ok"}"><title>${esc(tip)}</title></circle>`;
  }).join("");
  return `<figure class="chart"><figcaption>${esc(TEN_CHI_TIEU[loai])} (${DON_VI[loai]})</figcaption>`
    + `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(TEN_CHI_TIEU[loai])} theo giờ">${luoi}${trucX}${dai}${gioiHan}${duong}${diem}</svg>`
    + `<p class="note">Đường: TB mỗi giờ · vùng nhạt: min–max trong giờ · chấm đỏ: giờ có điểm ngoài giới hạn · nét đứt: giới hạn. Rê chuột lên chấm để xem số liệu.</p></figure>`;
}

function bangTomTat(pt) {
  const dong = THU_TU.map((l) => {
    const t = pt.tomTat[l];
    const huong = [t.oosThap ? `thấp ${nguyen(t.oosThap)}` : "", t.oosCao ? `cao ${nguyen(t.oosCao)}` : ""].filter(Boolean).join(", ");
    return `<tr><td>${esc(TEN_CHI_TIEU[l])}</td><td class=n>${so(t.duoi, 1)} – ${so(t.tren, 1)} ${DON_VI[l]}</td><td class=n>${so(t.tb)}</td><td class=n>${so(t.min)}</td><td class=n>${so(t.max)}</td>`
      + `<td class=n>${nguyen(t.hopLe)}/${nguyen(t.tong)}</td><td class=n>${nguyen(t.oos)} (${so(t.oosPct, 1)} %)${huong ? `<br><small>${huong}</small>` : ""}</td>`
      + `<td class=n>${t.gioDat}/${t.soGio}</td><td>${badge(t.ketQua)}</td></tr>`;
  }).join("");
  return `<div class=scroll><table><thead><tr><th>Chỉ tiêu</th><th>Giới hạn</th><th>TB</th><th>Min</th><th>Max</th><th>Điểm hợp lệ</th><th>Điểm ngoài GH</th><th>Giờ đạt hoàn toàn</th><th>Kết quả</th></tr></thead><tbody>${dong}</tbody></table></div>`;
}

function bangXuHuongNgay(gio) {
  const ngays = [...new Set(gio.map((r) => r.ngay))].sort();
  const o = (l, n) => {
    const d = gio.filter((r) => r.loai === l && r.ngay === n && r.tb != null && +r.hop_le > 0);
    if (!d.length) return "<td class=n>—</td>";
    const hl = d.reduce((a, r) => a + +r.hop_le, 0);
    const tb = d.reduce((a, r) => a + +r.tb * +r.hop_le, 0) / hl;
    const pct = (100 * d.reduce((a, r) => a + +r.oos, 0)) / hl;
    return `<td class="n${pct > 5 ? " bad" : ""}">${so(tb, 1)}<br><small>${so(pct, 0)} %</small></td>`;
  };
  return `<div class=scroll><table class="compact trend"><thead><tr><th>Chỉ tiêu</th>${ngays.map((n) => `<th>${n.slice(8, 10)}/${n.slice(5, 7)}</th>`).join("")}</tr></thead>`
    + `<tbody>${THU_TU.map((l) => `<tr><th>${esc(TEN_CHI_TIEU[l])}</th>${ngays.map((n) => o(l, n)).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function bangGio(dong, loai, tt, nhieuNgay) {
  const hang = dong.map((r) => `<tr class="${+r.oos > 0 ? "rowbad" : ""}"><td>${nhieuNgay ? `${r.ngay.slice(8, 10)}/${r.ngay.slice(5, 7)} ` : ""}${r.gio}</td><td class=n>${r.hop_le}/${r.tong}</td>`
    + `<td class=n>${so(r.tb)}</td><td class=n>${so(r.min)}</td><td class=n>${so(r.max)}</td><td class=n>${so(r.p5)}</td><td class=n>${so(r.p50)}</td><td class=n>${so(r.p95)}</td><td class=n>${so(r.sd)}</td>`
    + `<td class=n>${r.oos ?? "—"}</td><td class=n>${r.oos_thap ?? "—"}</td><td class=n>${r.oos_cao ?? "—"}</td><td class=n>${so(r.lien_tuc_phut || 0, 0)}</td><td>${esc(MUC_HE_THONG[r.muc] || r.muc || "")}</td></tr>`).join("");
  return `<details${nhieuNgay ? "" : " open"}><summary>${esc(TEN_CHI_TIEU[loai])} (${DON_VI[loai]}) · giới hạn ${so(tt.duoi, 1)} – ${so(tt.tren, 1)} · ${dong.length} giờ</summary>`
    + `<div class=scroll><table class=compact><thead><tr><th>Giờ</th><th>Điểm</th><th>TB</th><th>Min</th><th>Max</th><th>P5</th><th>P50</th><th>P95</th><th>ĐLC</th><th>Ngoài GH</th><th>Thấp</th><th>Cao</th><th>Liên tục dài nhất (phút)</th><th>Mức hệ thống</th></tr></thead><tbody>${hang || `<tr><td colspan=14>Không có dữ liệu.</td></tr>`}</tbody></table></div></details>`;
}

/* mau:off — CSS của tài liệu HTML độc lập (iframe/file tải về): không có tokens.css của app, bảng màu riêng có bản sáng/tối */
const CSS = `
:root{--bg:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--muted:#898781;--grid:#e1e0d9;--line:#2a78d6;--band:rgba(42,120,214,.16);--bad:#d03b3b;--badbg:#fbeaea;--good:#2f8a4c;--goodbg:#e9f5ec;--warn:#a86a00;--warnbg:#fdf3df;--hl:#eef4fc;--card:#fff;--bd:#e1e0d9}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--grid:#2c2c2a;--line:#3987e5;--band:rgba(57,135,229,.22);--bad:#e66767;--badbg:#3a2222;--good:#5cbf7a;--goodbg:#1f3326;--warn:#e0a23a;--warnbg:#3a2f1a;--hl:#23303f;--card:#222220;--bd:#3a3a37}}
:root[data-theme=dark]{--bg:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--grid:#2c2c2a;--line:#3987e5;--band:rgba(57,135,229,.22);--bad:#e66767;--badbg:#3a2222;--good:#5cbf7a;--goodbg:#1f3326;--warn:#e0a23a;--warnbg:#3a2f1a;--hl:#23303f;--card:#222220;--bd:#3a3a37}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:24px;margin:4px 0}h2{font-size:19px;margin:32px 0 10px;padding-top:8px;border-top:1px solid var(--bd)}
.eyebrow{color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-size:12px;margin:0}.meta{color:var(--ink2);margin:4px 0 0}
.verdict{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:18px 0}
.tile{display:flex;gap:10px;padding:12px 14px;border-radius:10px;border:1px solid var(--bd)}.tile>span{font-weight:700;font-size:20px;line-height:1}
.tile.bad{background:var(--badbg)}.tile.bad>span{color:var(--bad)}.tile.good{background:var(--goodbg)}.tile.good>span{color:var(--good)}.tile.warn{background:var(--warnbg)}.tile.warn>span{color:var(--warn)}
table{border-collapse:collapse;width:100%;font-size:14px;background:var(--card)}th,td{border:1px solid var(--bd);padding:6px 8px;text-align:left;vertical-align:top}
thead th{background:var(--hl);font-weight:600}td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
table.kv th{width:190px;background:var(--hl)}table.compact{font-size:12.5px}table.compact td,table.compact th{padding:4px 6px}
.scroll{overflow-x:auto}.trend th,.trend td{white-space:nowrap}.trend td.bad{box-shadow:inset 0 0 0 2px var(--bad)}
tr.rowbad td:first-child{border-left:4px solid var(--bad)}
.badge{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12.5px;font-weight:600;white-space:nowrap}.badge.good{background:var(--goodbg);color:var(--good)}.badge.bad{background:var(--badbg);color:var(--bad)}.badge.warn{background:var(--warnbg);color:var(--warn)}
.note{color:var(--ink2);font-size:13px}small{color:var(--ink2)}
.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:14px}
.chart{margin:0;padding:10px 12px;border:1px solid var(--bd);border-radius:10px;background:var(--card)}.chart figcaption{font-weight:600;font-size:14px}
.chart svg{width:100%;height:auto;display:block}.chart .note{margin:4px 0 0;font-size:12px}
.grid{stroke:var(--grid);stroke-width:1}.ax{fill:var(--muted);font-size:11px}.band{fill:var(--band)}.line{fill:none;stroke:var(--line);stroke-width:2;stroke-linejoin:round}
.lim{stroke:var(--ink2);stroke-width:1.2;stroke-dasharray:5 4}.limt{fill:var(--ink2);font-size:11px}
circle.ok{fill:var(--line);stroke:var(--card);stroke-width:1.5}circle.oos{fill:var(--bad);stroke:var(--card);stroke-width:1.5}
.ph li{margin:4px 0}.ph .cao{color:var(--bad);font-weight:600}.ph .vua{color:var(--warn);font-weight:600}
details{margin:10px 0}summary{cursor:pointer;font-weight:600;padding:6px 0}
@media print{body{font-size:12px}.chart,table{break-inside:avoid}details{display:block}main{max-width:none}}
`;
/* mau:on */

export function tenFileBaoCaoPhong(du) {
  return `Bao-cao-dieu-kien-phong-${String(du?.phong?.ma_phong || "phong").replace(/[^\w.-]/g, "_")}-${du.tu}_${du.den}.html`;
}

export function taoHtmlBaoCaoPhong(du, pt, { theme = "", lapLuc = new Date() } = {}) {
  const ph = du.phong || {};
  const gio = du.gio || [];
  const nhieuNgay = du.tu !== du.den;
  const khoang = nhanKhoang(du.tu, du.den);
  const kl = KET_LUAN[pt.ketLuan];
  const datL = THU_TU.filter((l) => pt.tomTat[l].ketQua === "DAT").map((l) => TEN_CHI_TIEU[l].toLowerCase());
  const khongL = THU_TU.filter((l) => pt.tomTat[l].ketQua === "KHONG_DAT").map((l) => TEN_CHI_TIEU[l].toLowerCase());
  const camBien = THU_TU.map((l) => {
    const c = (du.cam_bien || []).find((x) => x.loai === l);
    return c ? `${TEN_CHI_TIEU[l]} ${so(c.duoi, 1)}–${so(c.tren, 1)} ${DON_VI[l]} (hạn hiệu chuẩn: ${c.han_hieu_chuan ? ngayVN(String(c.han_hieu_chuan).slice(0, 10)) : "<b>chưa nhập</b>"})` : `${TEN_CHI_TIEU[l]}: không có cảm biến đang hoạt động`;
  }).join("<br>");
  const lap = lapLuc.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const phatHienHtml = THU_TU.map((l) => {
    const ds = pt.phatHien[l];
    return `<h3>${esc(TEN_CHI_TIEU[l])} — ${badge(pt.tomTat[l].ketQua)}</h3>`
      + (ds.length ? `<ul class="ph">${ds.map((x) => `<li><span class="${x.muc}">${x.muc === "cao" ? "●" : x.muc === "vua" ? "◐" : "○"}</span> ${esc(x.text)}</li>`).join("")}</ul>` : `<p class="note">Không có điểm bất thường trong khoảng này.</p>`);
  }).join("");
  const suCoHtml = pt.suCo.length
    ? `<div class=scroll><table class=compact><thead><tr><th>Mã</th><th>Chỉ tiêu</th><th>Mức</th><th>Trạng thái</th><th>Mở lúc</th><th>Đóng lúc</th></tr></thead><tbody>${pt.suCo.map((s) => `<tr><td>${esc(s.ma)}</td><td>${esc(s.loai)}</td><td>${esc(MUC_HE_THONG[s.muc] || s.muc)}</td><td>${esc(s.trang_thai)}</td><td>${s.mo ? new Date(s.mo).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—"}</td><td>${s.dong ? new Date(s.dong).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "đang mở"}</td></tr>`).join("")}</tbody></table></div>`
    : `<p>Không có sự cố nào của phòng trong khoảng này.</p>`;
  const ngoaiPV = pt.ngoaiPhamVi.length ? `<ul>${pt.ngoaiPhamVi.map((x) => `<li><b>${esc(TEN_CHI_TIEU[x.loai])}</b> ngoài giới hạn nhưng không có sự cố: ${x.lyDo.map(esc).join(" ")}</li>`).join("")}</ul>` : "";

  return `<!doctype html>
<html lang="vi"${theme ? ` data-theme="${esc(theme)}"` : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Điều kiện phòng ${esc(ph.ma_phong)} — ${esc(khoang)}</title><style>${CSS}</style></head>
<body><main>
<p class="eyebrow">BMS · Báo cáo điều kiện môi trường phòng sạch</p>
<h1>Điều kiện phòng ${esc(ph.ma_phong)} — ${esc(ph.ten_phong)} · ${esc(khoang)}</h1>
<p class="meta">Lập lúc ${esc(lap)} · Nguồn: hệ thống BMS (bảng <code>du_lieu_gio</code>) · Phân tích tự động theo số liệu, không đánh giá nguyên nhân — cần QA xem xét.</p>
<section class="verdict">
  <div class="tile ${kl.cls}"><span>${kl.icon}</span><div><b>${kl.text}</b><br>${khongL.length ? `Không đạt: ${esc(khongL.join(", "))}.` : "Mọi chỉ tiêu có dữ liệu đều trong giới hạn."}</div></div>
  ${datL.length ? `<div class="tile good"><span>✔</span><div><b>Đạt</b><br>${esc(datL.join(", "))}.</div></div>` : ""}
  <div class="tile ${pt.suCo.length ? "bad" : "warn"}"><span>${pt.suCo.length ? "⚑" : "!"}</span><div><b>${pt.suCo.length ? `${pt.suCo.length} sự cố` : "Không có sự cố"}</b><br>${pt.suCo.length ? "Xem mục Sự cố." : pt.ngoaiPhamVi.length ? "Có sai lệch nhưng hệ thống không mở sự cố — xem lý do ở mục Sự cố." : "Không có sai lệch cần mở sự cố."}</div></div>
</section>
<h2>1. Thông tin chung</h2>
<table class="kv">
<tr><th>Khoảng đánh giá</th><td>${esc(khoang)} (00:00–23:59 giờ Việt Nam${nhieuNgay ? ", mỗi ngày" : ""})</td></tr>
<tr><th>Phòng</th><td><b>${esc(ph.ma_phong)} — ${esc(ph.ten_phong)}</b> · khu ${esc(ph.khu_vuc)} · cấp sạch ${esc(ph.cap_phong_sach || "—")} · ${esc(ph.ahu || "—")} · mức ưu tiên ${esc(ph.muc_uu_tien || "—")}</td></tr>
<tr><th>Giới hạn chấp nhận</th><td>${camBien}</td></tr>
<tr><th>Tần suất ghi</th><td>1 điểm/phút; hệ thống tổng hợp mỗi giờ (TB, min, max, P5/P50/P95, độ lệch chuẩn, số điểm ngoài giới hạn).</td></tr>
</table>
<h2>2. Tóm tắt kết quả</h2>
${bangTomTat(pt)}
<p class="note">"Giờ đạt hoàn toàn" = giờ không có điểm nào ngoài giới hạn.</p>
<h2>3. Diễn biến theo giờ</h2>
<div class="grid3">${THU_TU.map((l) => bieuDo(gio.filter((r) => r.loai === l), pt.tomTat[l], l, nhieuNgay)).join("")}</div>
${nhieuNgay ? `<h2>4. Xu hướng theo ngày</h2><p class="note">Mỗi ô: trung bình ngày và <small>% điểm ngoài giới hạn</small>; viền đỏ = trên 5 %.</p>${bangXuHuongNgay(gio)}` : ""}
<h2>${nhieuNgay ? 5 : 4}. Phát hiện tự động</h2>
<p class="note">● cần xem xét ngay · ◐ cần lưu ý · ○ thông tin. Chỉ nêu sự thật từ số liệu; nguyên nhân và đánh giá ảnh hưởng do QA kết luận.</p>
${phatHienHtml}
<h2>${nhieuNgay ? 6 : 5}. Sự cố</h2>
${suCoHtml}${ngoaiPV}
<h2>Phụ lục — Số liệu chi tiết theo giờ</h2>
<p class="note">Mỗi dòng tổng hợp 60 điểm/phút. ĐLC = độ lệch chuẩn. "Mức hệ thống" = mức BMS tự tính (không đồng nghĩa có sự cố).</p>
${THU_TU.map((l) => bangGio(gio.filter((r) => r.loai === l), l, pt.tomTat[l], nhieuNgay)).join("")}
<p class="note">Truy xuất: RPC <code>rpc_bao_cao_dieu_kien_phong('${esc(ph.ma_phong)}', '${esc(du.tu)}', '${esc(du.den)}')</code>.</p>
</main></body></html>`;
}
