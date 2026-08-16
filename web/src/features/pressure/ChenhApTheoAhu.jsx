// ChenhApTheoAhu.jsx — tab Chênh áp theo AHU (tách move-only từ App.jsx 17/08/2026).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Gauge } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import InspectorDrawer from "../../components/layout/InspectorDrawer";
import PressureRange from "../../components/pressure/PressureRange";
import { COLOR } from "../../lib/designTokens";
import { DS_KHU } from "../../lib/phanQuyen";
import { capNhatPhut8h, dangKyRealtimeChenhAp, layCamBienDungHinh, layChenhApTheoAhu } from "../../lib/supabaseData";
// Bảng CHÊNH ÁP THEO AHU (tab Sự cố gần đây) — yêu cầu (dải giới hạn) + kết quả (TB
// 5′ cuối của bucket giờ mới nhất), gom theo AHU. Không đạt: Mức 1/2 (P1/P2) = ĐỎ ·
// Mức 3 (P3) = VÀNG. Đạt = xanh. Thiếu dữ liệu = xám. Có bộ lọc khu/AHU riêng.
function ChenhApTheoAhu({ isLive, khuChoPhep = null, active = true }) {
  const [rows, setRows] = React.useState(null);   // null = đang tải
  const [khu, setKhu] = React.useState("ALL");
  const [ahuLoc, setAhuLoc] = React.useState("ALL");
  const [dangTuoi, setDangTuoi] = React.useState(false);   // đang gọi FMS lấy realtime
  const [chiTiet, setChiTiet] = React.useState(null);      // phòng đang mở drawer chi tiết (Phase C)
  const [dhMap, setDhMap] = React.useState({});            // ma_phong → số giờ đứng tín hiệu (cảm biến DP)
  const [napLuc, setNapLuc] = React.useState(Date.now());  // mốc client nhận lô số hiện hành
  const [dongHo, setDongHo] = React.useState(Date.now());  // nhịp 10s để nhãn tuổi TỰ ĐẾM LÊN
  // 03/08: TÁCH ĐÔI NHỊP. Trước đây một hàm `nap()` vừa đọc số vừa gọi Edge (~6s)
  // rồi lặp mỗi 60s ⇒ màn hình chỉ đổi mỗi 60s dù số trong bảng đã mới. Nay:
  //   • docSo (RPC ~100ms) — nhịp nhanh + mỗi khi realtime gõ cửa
  //   • kichEdge (gọi FMS ~6s) — nhịp CHẬM, chỉ còn là lưới đỡ vì cron
  //     `bms-phut-8h` đã kéo FMS mỗi phút phía máy chủ (migration 20260803a).
  const docSo = React.useCallback(async () => {
    const [kq, dh] = await Promise.all([layChenhApTheoAhu(), layCamBienDungHinh()]);
    if (!kq.error) { setRows(kq.rows); setNapLuc(Date.now()); }
    if (dh && !dh.error && dh.rows) setDhMap(Object.fromEntries(dh.rows.filter((x) => x.loai_cam_bien === "DP").map((x) => [x.ma_phong, x.so_gio_dung])));
  }, []);
  const kichEdge = React.useCallback(async () => {
    setDangTuoi(true);
    const up = await capNhatPhut8h();
    setDangTuoi(false);
    if (up && up.ok) { const kq = await layChenhApTheoAhu(); if (!kq.error) { setRows(kq.rows); setNapLuc(Date.now()); } }
  }, []);
  const nap = React.useCallback(async () => { await docSo(); await kichEdge(); }, [docSo, kichEdge]);
  React.useEffect(() => {
    if (!isLive || !active) return;   // CHỈ gọi FMS/đọc khi tab Chênh áp đang mở — không tải nền làm chậm tab khác
    nap();
    // Đọc số: 20s/lần. Rẻ (RPC ~100ms), KHÔNG đụng FMS. Đây là lưới đỡ cho realtime.
    const tDoc = setInterval(docSo, 20000);
    // Gọi FMS: 180s/lần. Cron `bms-phut-8h` đã kéo mỗi phút; nhịp này chỉ để phòng
    // khi cron tắt / ngoài khung giờ (cau_hinh.edge_capnhat_phut_gio_dau|_cuoi).
    const tEdge = setInterval(kichEdge, 180000);
    // Realtime: bảng du_lieu_phut_8h đổi → đọc lại sau 1.2s (gom burst: đo lượt cron
    // thật ngày 03/08 = 112 điểm / 56 phòng; không gom thì nạp lại hơn trăm lần).
    let hen = null;
    const huyRt = dangKyRealtimeChenhAp(() => {
      if (hen) clearTimeout(hen);
      hen = setTimeout(() => { hen = null; docSo(); }, 1200);
    });
    return () => { clearInterval(tDoc); clearInterval(tEdge); if (hen) clearTimeout(hen); huyRt(); };
  }, [isLive, active, nap, docSo, kichEdge]);
  // Nhịp riêng 10s: KHÔNG gọi mạng, chỉ để nhãn tuổi dữ liệu đếm lên giữa 2 lần nạp.
  React.useEffect(() => {
    if (!isLive || !active) return;
    const t = setInterval(() => setDongHo(Date.now()), 10000);
    return () => clearInterval(t);
  }, [isLive, active]);
  if (!isLive) return <Card className="p-8 text-center text-[13px] text-muted">Cần kết nối dữ liệu thật (LIVE) để xem chênh áp theo AHU.</Card>;
  const dsKhu = khuChoPhep || DS_KHU;
  const ahuPairs = [...new Set((rows || []).filter((r) => (khu === "ALL" || r.khuVuc === khu)).map((r) => `${r.khuVuc}|${r.ahu}`))].sort();
  const chip = (v, label, on, click) => <button key={v} onClick={click} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition ring-1 ${on ? "text-white ring-transparent" : "text-body bg-surface ring-line hover:ring-success-line"}`} style={on ? { backgroundColor: "var(--primary-solid)" } : {}}>{label}</button>;
  const filt = (rows || []).filter((r) => (khu === "ALL" || r.khuVuc === khu) && (ahuLoc === "ALL" || r.ahu === ahuLoc));
  const groups = {};
  filt.forEach((r) => { const k = `${r.khuVuc} / ${r.ahu}`; (groups[k] ??= []).push(r); });
  // Màu theo NGUYÊN TẮC CẢNH BÁO (16/07): ĐỎ = vi phạm theo hướng (DP=DUOI → dưới sàn,
  // cần chỉnh) · VÀNG = ngoài khoảng nhưng KHÔNG thuộc hướng (vd vượt trần — chú ý,
  // không phải sự cố) · XANH = trong dải · XÁM = không dữ liệu. `dat` do server chấm
  // theo canh_bao_huong nên đổi hướng trong Cài đặt là màu tự đổi theo.
  const ngoaiKhoang = (r) => r.coDuLieu !== false && r.giaTri != null
    && ((r.ghDuoi != null && r.giaTri < r.ghDuoi) || (r.ghTren != null && r.giaTri > r.ghTren));
  // 16/07 (user): P3 không mở phiếu → P3 không đạt hiển thị DỊU (đỏ nhạt + nhãn
  // "theo dõi"), tách khỏi số "cần chỉnh" của P1/P2.
  // 16/07 (user): cảm biến ĐỨNG TÍN HIỆU → số đang xem là số CHẾT — nhãn cảnh báo riêng,
  // không tô đỏ/xanh (đỏ giả hoặc đạt giả), không tính vào "cần chỉnh".
  const laDungHinh = (r) => dhMap[r.maPhong] != null;
  const canGap = (r) => r.dat === false && r.uuTien !== "P3" && !laDungHinh(r);
  const p3KhongDat = (r) => r.dat === false && r.uuTien === "P3" && !laDungHinh(r);
  const soKhongDat = filt.filter(canGap).length;
  const soP3 = filt.filter(p3KhongDat).length;
  const soDh = filt.filter(laDungHinh).length;
  const soNgoaiKhoang = filt.filter((r) => r.dat !== false && ngoaiKhoang(r) && !laDungHinh(r)).length;
  // 11/08: phòng KHÔNG có số đo đủ mới phải hiện thành một con số riêng. Trước đây
  // chúng lặng lẽ nằm trong mẫu số "/57 phòng" như thể vẫn đang được theo dõi.
  const soMatDuLieu = filt.filter((r) => r.coDuLieu === false).length;
  // Nguồn đang dùng: rơi về rollup giờ nghĩa là mạch phút đã tắt.
  const soDungGio = filt.filter((r) => r.duLieuCu && r.coDuLieu !== false).length;
  const nguongTuoi = filt.find((r) => r.tuoiToiDaPhut != null)?.tuoiToiDaPhut ?? null;
  const oCls = (r) => r.coDuLieu === false ? "bg-subtle ring-line-strong"
    : laDungHinh(r) ? "bg-subtle ring-2 ring-warning"
    : canGap(r) ? "bg-danger-soft ring-2 ring-danger"
    : p3KhongDat(r) ? "bg-danger-soft/40 ring-1 ring-line"
    : ngoaiKhoang(r) ? "bg-warning-soft ring-2 ring-warning"
    : "bg-success-soft ring-1 ring-success-line";
  const vCls = (r) => r.coDuLieu === false ? "text-muted"
    : laDungHinh(r) ? "text-muted line-through"
    : canGap(r) ? "text-danger"
    : p3KhongDat(r) ? "text-muted"
    : ngoaiKhoang(r) ? "text-warning" : "text-success";
  // 03/08 (user: "cơ điện đọc trên app để sửa rất khó vì chậm vài phút"): hiện TUỔI
  // dữ liệu, không bắt người đứng máy tự nhẩm "10:32 là mấy phút trước". `tuoi_phut`
  // do server tính LÚC TRUY VẤN nên phải CỘNG thời gian trôi từ lúc nạp — nếu chỉ in
  // số của server thì nhãn đứng yên trong khi màn hình mỗi lúc một cũ (đúng loại lỗi
  // "hệ nói sai về chính nó" đã mắc với nhãn TB-5-phút).
  const nhanTuoi = (r) => {
    if (r.tuoiPhut == null) return null;
    const p = r.tuoiPhut + Math.floor(Math.max(0, dongHo - napLuc) / 60000);
    const mau = p >= 6 ? "text-danger" : p >= 3 ? "text-warning" : "text-muted";
    return <span className={`font-semibold ${mau}`}> · {p <= 0 ? "vừa xong" : `${p}′ trước`}</span>;
  };
  const ordUu = (p) => p === "P1" ? 1 : p === "P2" ? 2 : p === "P3" ? 3 : 4;
  // Phase C (báo cáo 9): phân loại một chỗ — hàng hiển thị + chip đếm + sort dùng chung.
  const phanLoai = (r) => r.coDuLieu === false ? "thieu"
    : laDungHinh(r) ? "dung"
    : canGap(r) ? "canXuLy"
    : (p3KhongDat(r) || ngoaiKhoang(r)) ? "theoDoi"
    : "dat";
  const rank = (r) => ({ canXuLy: 0, theoDoi: 1, dung: 2, thieu: 3, dat: 4 })[phanLoai(r)];
  const soDat = filt.filter((r) => phanLoai(r) === "dat").length;
  const trangThaiChu = (r) => {
    const pl = phanLoai(r);
    if (pl === "thieu") return <span className="text-muted">thiếu dữ liệu</span>;
    if (pl === "dung") return <span className="text-warning font-medium">đứng tín hiệu {dhMap[r.maPhong]} giờ</span>;
    if (pl === "canXuLy") return <span className="text-danger font-semibold">{r.giaTri != null && r.ghDuoi != null && Number(r.giaTri) < r.ghDuoi ? "dưới giới hạn" : "trên giới hạn"} · cần xử lý</span>;
    if (pl === "theoDoi") return <span className="text-warning font-medium">{r.uuTien === "P3" && r.dat === false ? "P3 · theo dõi" : "trên giới hạn · theo dõi"}</span>;
    return null;
  };
  const HangPhong = ({ r, gon = false }) => (
    <button onClick={() => setChiTiet(r)} className={`w-full text-left rounded-xl px-3.5 ${gon ? "py-1.5" : "py-2.5"} flex items-center gap-x-4 gap-y-1 flex-wrap ring-1 ${phanLoai(r) === "canXuLy" ? "bg-danger-soft/40 ring-danger-line" : phanLoai(r) === "theoDoi" ? "bg-warning-soft/30 ring-warning-line" : "bg-surface ring-line hover:bg-subtle"}`}>
      <span className="w-[150px] shrink-0 min-w-0">
        <span className="flex items-center gap-1.5"><span className="text-[13.5px] font-semibold text-strong">{r.maPhong}</span><span className="text-[12px] font-bold px-1.5 py-0.5 rounded-full bg-subtle text-muted">{r.uuTien}</span></span>
        {!gon && <span className="block text-[12px] text-muted truncate" title={r.tenPhong}>{r.tenPhong}</span>}
      </span>
      <span className="grow flex justify-center min-w-[140px]"><PressureRange value={r.coDuLieu === false ? null : r.giaTri} min={r.ghDuoi} max={r.ghTren} stale={!!r.duLieuCu || laDungHinh(r)} missing={r.coDuLieu === false} donVi={r.donVi} w={gon ? 160 : 220} /></span>
      <span className="ml-auto w-[150px] text-right shrink-0">
        <span className={`block text-[16px] font-bold tabular-nums leading-none ${vCls(r)}`}>{r.coDuLieu === false ? "—" : <>{r.giaTri}<span className="text-[12px] font-medium"> {r.donVi}</span></>}</span>
        <span className="block text-[12px] mt-0.5">{trangThaiChu(r) || (r.coDuLieu !== false && <span className="text-muted">{r.thoiDiem}{nhanTuoi(r)}</span>)}</span>
      </span>
    </button>
  );
  const chipDem = (nhan, so, cls) => <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 ${cls}`}><b className="tabular-nums">{so}</b> {nhan}</span>;
  return (
    <Card className="p-5">
      <SectionTitle icon={Gauge} hint="Số liệu 5 phút gần nhất">
        <span title="Nguồn: FMS">Chênh áp</span>
        {dangTuoi && <span className="text-[12px] font-normal text-success"> · đang cập nhật…</span>}
      </SectionTitle>
      {rows !== null && filt.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {chipDem("cần xử lý", soKhongDat, soKhongDat > 0 ? "bg-danger-soft text-danger ring-danger-line" : "bg-subtle text-muted ring-line")}
          {chipDem("theo dõi", soP3 + soNgoaiKhoang, (soP3 + soNgoaiKhoang) > 0 ? "bg-warning-soft text-warning ring-warning-line" : "bg-subtle text-muted ring-line")}
          {chipDem("đứng tín hiệu", soDh, soDh > 0 ? "bg-warning-soft text-warning ring-warning-line" : "bg-subtle text-muted ring-line")}
          {chipDem("thiếu dữ liệu", soMatDuLieu, soMatDuLieu > 0 ? "bg-missing-soft text-missing ring-line" : "bg-subtle text-muted ring-line")}
          {chipDem("đạt", soDat, "bg-subtle text-muted ring-line")}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-[12px] font-semibold text-muted uppercase tracking-wider mr-1">Khu vực</span>
        {chip("ALL", "Tất cả", khu === "ALL", () => { setKhu("ALL"); setAhuLoc("ALL"); })}
        {dsKhu.map((k) => chip(k, `Khu ${k}`, khu === k, () => { setKhu(k); setAhuLoc("ALL"); }))}
        {ahuPairs.length > 0 && (
          <select value={ahuLoc === "ALL" ? "ALL" : `${khu}|${ahuLoc}`} onChange={(e) => { const v = e.target.value; if (v === "ALL") setAhuLoc("ALL"); else { const [k, a] = v.split("|"); setKhu(k); setAhuLoc(a); } }} className="rounded-xl bg-surface ring-1 ring-line px-3 py-1.5 text-[12px] text-body outline-none ml-1">
            <option value="ALL">AHU: tất cả</option>
            {ahuPairs.map((p) => { const [k, a] = p.split("|"); return <option key={p} value={p}>{khu === "ALL" ? `Khu ${k} · ${a}` : a}</option>; })}
          </select>
        )}
      </div>
      {/* 11/08 — BĂNG BÁO MẤT NGUỒN (giữ nguyên logic; đây là banner DUY NHẤT được to). */}
      {rows !== null && soMatDuLieu > 0 && (
        <div className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 ring-1 ring-danger-line">
          <p className="text-[13px] font-bold text-danger">⚠ Mất kết nối dữ liệu — {soMatDuLieu}/{filt.length} phòng không có số đo đủ mới</p>
          <p className="mt-0.5 text-[12px] leading-snug text-danger">
            Số cuối cùng đo được vẫn hiện để tham khảo, nhưng hệ <b>không kết luận đạt/không đạt</b> trên số đã cũ
            {nguongTuoi != null && <> (quá {nguongTuoi} phút)</>} — các phòng này không tính vào số "đạt" lẫn "cần xử lý".
            Kiểm FMS ngay: nguồn treo thì phải có người khởi động lại, hệ không tự khỏi.
          </p>
        </div>
      )}
      {rows !== null && soMatDuLieu === 0 && soDungGio > 0 && (
        <div className="mt-3 rounded-xl bg-warning-soft px-3.5 py-2 ring-1 ring-warning-line">
          <p className="text-[12px] text-warning"><b>Đang dùng số liệu theo giờ</b> ({soDungGio}/{filt.length} phòng) — mạch phút không có điểm mới trong 6 phút. Số đang xem là trung bình 5 phút cuối của giờ đã xong, không phải hiện tại.</p>
        </div>
      )}
      {rows === null ? <div className="mt-3 h-24 rounded-2xl bg-subtle animate-pulse" />
        : filt.length === 0 ? <p className="mt-3 text-[13px] text-muted">Không có phòng chênh áp trong phạm vi lọc.</p>
        : (() => {
          const dsBat = filt.filter((r) => phanLoai(r) !== "dat");
          const dsDat = filt.filter((r) => phanLoai(r) === "dat");
          const nhom = (ds) => {
            const g = {};
            ds.forEach((r) => { const k = `${r.khuVuc} / ${r.ahu}`; (g[k] ??= []).push(r); });
            return Object.keys(g).sort((a, b) => Math.min(...g[a].map(rank)) - Math.min(...g[b].map(rank)) || a.localeCompare(b))
              .map((k) => [k, g[k].slice().sort((x, y) => rank(x) - rank(y) || ordUu(x.uuTien) - ordUu(y.uuTien) || String(x.maPhong).localeCompare(String(y.maPhong)))]);
          };
          return (
            <div className="mt-3 space-y-4">
              {dsBat.length === 0 && <p className="text-[13px] text-success font-medium py-2">Tất cả phòng trong phạm vi lọc đang đạt.</p>}
              {nhom(dsBat).map(([k, ds]) => (
                <div key={k}>
                  <p className="text-[12px] font-bold uppercase tracking-wide text-muted mb-1.5">{k}</p>
                  <div className="space-y-1.5">{ds.map((r) => <HangPhong key={r.maPhong} r={r} />)}</div>
                </div>
              ))}
              {dsDat.length > 0 && (
                <details className="rounded-2xl ring-1 ring-line px-4 py-3">
                  <summary className="cursor-pointer text-[13px] font-medium text-muted select-none">Đang đạt · {dsDat.length} phòng — mở xem</summary>
                  <div className="mt-3 space-y-3">
                    {nhom(dsDat).map(([k, ds]) => (
                      <div key={k}>
                        <p className="text-[12px] font-bold uppercase tracking-wide text-muted mb-1">{k}</p>
                        <div className="space-y-1">{ds.map((r) => <HangPhong key={r.maPhong} r={r} gon />)}</div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })()}
      {chiTiet && (() => { const r = chiTiet; return (
        <InspectorDrawer onClose={() => setChiTiet(null)} eyebrow={`${r.khuVuc} / ${r.ahu} · ${r.uuTien}`} title={`${r.maPhong} — ${r.tenPhong || "Chênh áp"}`}>
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-xl bg-subtle px-3 py-2"><span className="text-muted block text-[12px] uppercase tracking-wider">Hiện tại</span><span className={`font-bold tabular-nums text-[18px] ${vCls(r)}`}>{r.coDuLieu === false ? "—" : `${r.giaTri} ${r.donVi}`}</span></div>
            <div className="rounded-xl bg-subtle px-3 py-2"><span className="text-muted block text-[12px] uppercase tracking-wider">Giới hạn ({r.donVi})</span><span className="font-semibold text-strong tabular-nums text-[18px]">{r.ghDuoi}–{r.ghTren}</span></div>
          </div>
          <div className="py-1"><PressureRange value={r.coDuLieu === false ? null : r.giaTri} min={r.ghDuoi} max={r.ghTren} stale={!!r.duLieuCu || laDungHinh(r)} missing={r.coDuLieu === false} donVi={r.donVi} w={340} /></div>
          <p className="text-[13px] text-body">{trangThaiChu(r) || <span className="text-success font-medium">Trong giới hạn</span>}{r.coDuLieu !== false && <span className="text-muted"> · {r.realtime ? "số liệu trực tiếp" : "theo giờ gần nhất"} · {r.thoiDiem}{nhanTuoi(r)}</span>}</p>
          {laDungHinh(r) && <p className="text-[12px] text-warning bg-warning-soft ring-1 ring-warning-line rounded-xl px-3 py-2">⚠ Cảm biến đứng tín hiệu {dhMap[r.maPhong]} giờ — kiểm tra lại cảm biến trước khi chỉnh hệ thống.</p>}
          {r.chuoi && r.chuoi.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted mb-1.5">Chuỗi 5 phút gần nhất</p>
              <div className="rounded-lg overflow-x-auto ring-1 ring-line bg-surface"><table className="border-collapse w-full"><tbody>
                <tr>{r.chuoi.map((p2) => <td key={`t${p2.t}`} className="border border-line bg-subtle px-2 py-0.5 text-center text-[12px] text-body tabular-nums">{p2.t}</td>)}</tr>
                <tr>{r.chuoi.map((p2, i) => { const cuoi = i === r.chuoi.length - 1; const duoiSan = Number(p2.v) < r.ghDuoi; const trenTran = Number(p2.v) > r.ghTren; return <td key={`v${p2.t}`} className={`border border-line px-2 py-0.5 text-center text-[12.5px] tabular-nums ${cuoi ? `font-bold ${vCls(r)} bg-surface` : duoiSan ? "text-danger font-semibold bg-danger-soft/50" : trenTran ? "text-warning font-semibold bg-warning-soft/50" : "text-body bg-surface"}`}>{p2.v}</td>; })}</tr>
              </tbody></table></div>
            </div>
          )}
        </InspectorDrawer>
      ); })()}
    </Card>
  );
}


export default ChenhApTheoAhu;
