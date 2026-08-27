// ChenhApTheoAhu.jsx — tab Chênh áp theo AHU (tách move-only từ App.jsx 17/08/2026).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Gauge } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import InspectorDrawer from "../../components/layout/InspectorDrawer";
import PressureRange from "../../components/pressure/PressureRange";
import { COLOR } from "../../lib/designTokens";
import { DS_KHU } from "../../lib/phanQuyen";
import {
  capNhatPhut8h,
  chamNguoiXemChenhAp,
  dangKyRealtimeChenhAp,
  dungXemChenhAp,
  layCamBienDungHinh,
  layChenhApTheoAhu,
} from "../../lib/supabaseData";
import {
  createPressureViewerId,
  createPressureViewerSession,
  isPressureViewerActive,
} from "./pressureViewerSession";
// Bảng CHÊNH ÁP THEO AHU (tab Sự cố gần đây) — yêu cầu (dải giới hạn) + kết quả (TB
// 5′ cuối của bucket giờ mới nhất), gom theo AHU. Không đạt: Mức 1/2 (P1/P2) = ĐỎ ·
// Mức 3 (P3) = VÀNG. Đạt = xanh. Thiếu dữ liệu = xám. Có bộ lọc khu/AHU riêng.
function ChenhApTheoAhu({ isLive, khuChoPhep = null, active = true, suCoMo = [], suCoDong = [], onMoTabSuCo = null }) {
  const [rows, setRows] = React.useState(null);   // null = đang tải
  const [khu, setKhu] = React.useState("ALL");
  const [ahuLoc, setAhuLoc] = React.useState("ALL");
  const [dangTai10Phut, setDangTai10Phut] = React.useState(false);
  const [chiTiet, setChiTiet] = React.useState(null);      // phòng đang mở drawer chi tiết (Phase C)
  const [dhMap, setDhMap] = React.useState({});            // ma_phong → số giờ đứng tín hiệu (cảm biến DP)
  const [napLuc, setNapLuc] = React.useState(Date.now());  // mốc client nhận lô số hiện hành
  const [dongHo, setDongHo] = React.useState(Date.now());  // nhịp 10s để nhãn tuổi TỰ ĐẾM LÊN
  const [visibilityState, setVisibilityState] = React.useState(() => (
    typeof document === "undefined" ? "hidden" : document.visibilityState
  ));
  const viewerIdRef = React.useRef(null);
  const sessionRef = React.useRef(null);
  const viewerActiveRef = React.useRef(false);
  const mountedRef = React.useRef(false);
  if (!viewerIdRef.current && typeof globalThis.crypto?.randomUUID === "function") {
    viewerIdRef.current = createPressureViewerId();
  }
  const viewerActive = isPressureViewerActive({ isLive, active, visibilityState });
  viewerActiveRef.current = viewerActive;

  const docSo = React.useCallback(async () => {
    if (!viewerActiveRef.current) return;
    const [kq, dh] = await Promise.all([layChenhApTheoAhu(), layCamBienDungHinh()]);
    if (!mountedRef.current || !viewerActiveRef.current) return;
    if (!kq.error) { setRows(kq.rows); setNapLuc(Date.now()); }
    if (dh && !dh.error && dh.rows) setDhMap(Object.fromEntries(dh.rows.filter((x) => x.loai_cam_bien === "DP").map((x) => [x.ma_phong, x.so_gio_dung])));
  }, []);
  const capNhatNgay = React.useCallback(async () => {
    if (mountedRef.current) setDangTai10Phut(true);
    try {
      const up = await capNhatPhut8h();
      if (up?.ok && viewerActiveRef.current) await docSo();
      return up;
    } finally {
      if (mountedRef.current) setDangTai10Phut(false);
    }
  }, [docSo]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  React.useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const doiVisibility = () => {
      const nextVisibility = document.visibilityState;
      viewerActiveRef.current = isPressureViewerActive({ isLive, active, visibilityState: nextVisibility });
      setVisibilityState(nextVisibility);
    };
    document.addEventListener("visibilitychange", doiVisibility);
    return () => document.removeEventListener("visibilitychange", doiVisibility);
  }, [isLive, active]);

  React.useEffect(() => {
    const viewerId = viewerIdRef.current;
    if (!viewerId) return undefined;
    const session = createPressureViewerSession({
      viewerId,
      touch: chamNguoiXemChenhAp,
      release: dungXemChenhAp,
      requestUpdate: capNhatNgay,
    });
    sessionRef.current = session;
    return () => {
      sessionRef.current = null;
      void session.dispose();
    };
  }, [capNhatNgay]);

  React.useEffect(() => {
    void sessionRef.current?.setActive(viewerActive);
    if (!viewerActive) setDangTai10Phut(false);
  }, [viewerActive]);

  React.useEffect(() => {
    if (!viewerActive) return undefined;
    void docSo();
    // Lưới đỡ Supabase: Realtime là đường ưu tiên, poll chỉ đọc lại DB mỗi phút.
    const tDoc = setInterval(docSo, 60000);
    // Realtime: bảng du_lieu_phut_8h đổi → đọc lại sau 1.2s (gom burst: đo lượt cron
    // thật ngày 03/08 = 112 điểm / 56 phòng; không gom thì nạp lại hơn trăm lần).
    let hen = null;
    const huyRt = dangKyRealtimeChenhAp(() => {
      if (hen) clearTimeout(hen);
      hen = setTimeout(() => { hen = null; docSo(); }, 1200);
    });
    return () => { clearInterval(tDoc); if (hen) clearTimeout(hen); huyRt(); };
  }, [viewerActive, docSo]);
  // Nhịp riêng 10s: KHÔNG gọi mạng, chỉ để nhãn tuổi dữ liệu đếm lên giữa 2 lần nạp.
  React.useEffect(() => {
    if (!viewerActive) return undefined;
    const t = setInterval(() => setDongHo(Date.now()), 10000);
    return () => clearInterval(t);
  }, [viewerActive]);
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
  // 17/08 (chủ hệ thống): dữ liệu 5′ phải là HIỆN SỐ (bảng 2 hàng giờ/giá trị) ngay
  // trên hàng — đây là tab CHỈNH chính của Cơ điện, không dùng biểu đồ thu nhỏ.
  const HangPhong = ({ r }) => (
    <div key={r.maPhong} onClick={() => setChiTiet(r)} title="Bấm để xem chi tiết"
      className={`rounded-xl px-3.5 py-2.5 flex items-center gap-x-5 gap-y-2 flex-wrap cursor-pointer ${oCls(r)}`}>
      <div className="w-[168px] shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13.5px] font-semibold text-strong">{r.maPhong}</span>
          <span className="text-[12px] font-bold px-1.5 py-0.5 rounded-full bg-surface/80 text-muted">{r.uuTien}</span>
        </div>
        <div className="text-[12px] text-muted truncate" title={r.tenPhong}>{r.tenPhong}</div>
        {laDungHinh(r) && (
          <div className="mt-1 inline-block rounded-md bg-warning-soft px-1.5 py-0.5 text-[12px] font-semibold leading-tight text-warning ring-1 ring-warning-line">
            ⚠ Cảm biến đứng tín hiệu {dhMap[r.maPhong]} giờ — kiểm tra lại trước khi chỉnh
          </div>
        )}
      </div>
      <div className="w-[96px] shrink-0 rounded-lg bg-surface/80 px-2 py-1 text-center ring-1 ring-line/60">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">Yêu cầu ({r.donVi})</div>
        <div className="text-[15px] font-bold text-strong tabular-nums leading-tight">{r.ghDuoi}–{r.ghTren}</div>
      </div>
      {/* 16/07 (user): chuỗi 5′ kẻ BẢNG 2 hàng — giờ trên, chênh áp dưới — dễ dò cột hơn dãy chữ liền */}
      {r.chuoi && r.chuoi.length > 0 && (
        <div className="grow flex justify-center"><div className="rounded-lg overflow-hidden ring-1 ring-line bg-surface shrink-0">
        <table className="border-collapse shrink-0">
          <tbody>
            <tr>
              {r.chuoi.map((p) => (
                <td key={`t${p.t}`} className="border border-line bg-subtle px-2 py-0.5 text-center text-[12px] text-body tabular-nums">{p.t}</td>
              ))}
            </tr>
            <tr>
              {r.chuoi.map((p, i) => {
                const cuoi = i === r.chuoi.length - 1;
                const duoiSan = Number(p.v) < r.ghDuoi; const trenTran = Number(p.v) > r.ghTren;
                return (
                  <td key={`v${p.t}`} className={`border border-line px-2 py-0.5 text-center text-[12.5px] tabular-nums ${cuoi ? `font-bold ${vCls(r)} bg-surface` : duoiSan ? "text-danger font-semibold bg-danger-soft/50" : trenTran ? "text-warning font-semibold bg-warning-soft/50" : "text-body bg-surface"}`}>{p.v}</td>
                );
              })}
            </tr>
          </tbody>
        </table>
        </div></div>
      )}
      <div className="ml-auto w-[132px] text-right shrink-0">
        <div className={`text-[17px] font-bold tabular-nums leading-none ${vCls(r)}`}>{r.coDuLieu === false ? "—" : <>{r.giaTri}<span className="text-[12px] font-medium"> {r.donVi}</span></>}</div>
        <div className="text-[12px] text-muted mt-0.5">{r.coDuLieu === false ? "thiếu dữ liệu" : <>{r.realtime ? <span className="text-success font-semibold">● trực tiếp</span> : <span className="text-warning">giờ gần nhất</span>} {r.thoiDiem}{nhanTuoi(r)}{r.dat === false && (r.uuTien === "P3"
          ? <span className="font-medium text-muted"> · P3 — theo dõi</span>
          : <span className={`font-semibold ${vCls(r)}`}> · không đạt</span>)}</>}</div>
      </div>
    </div>
  );
  const chipDem = (nhan, so, cls) => <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 ${cls}`}><b className="tabular-nums">{so}</b> {nhan}</span>;
  return (
    <Card className="p-5">
      <SectionTitle icon={Gauge} hint="Số liệu 5 phút gần nhất">
        <span title="Nguồn: FMS">Chênh áp</span>
        {dangTai10Phut && <span className="text-[12px] font-normal text-success"> · Đang tải 10 phút gần nhất…</span>}
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
      {/* 17/08 (chủ hệ thống): mở tab là biết ngay hệ đang thế nào + có lỗi gì gần đây không. */}
      {rows !== null && filt.length > 0 && (() => {
        const coChuoi = filt.filter((r) => r.coDuLieu !== false && !laDungHinh(r) && Array.isArray(r.chuoi) && r.chuoi.length > 0);
        const duoiGH = coChuoi.filter((r) => r.ghDuoi != null && r.chuoi.some((p2) => Number(p2.v) < r.ghDuoi));
        const trenGH = coChuoi.filter((r) => !duoiGH.includes(r) && r.ghTren != null && r.chuoi.some((p2) => Number(p2.v) > r.ghTren));
        const soPhut = coChuoi[0] ? coChuoi[0].chuoi.length * 5 : 40;
        return (
          <div className="mt-3 rounded-2xl ring-1 ring-line px-4 py-3">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">Diễn biến {soPhut} phút gần nhất</p>
            <p className={`mt-1 text-[13px] ${duoiGH.length ? "text-danger font-medium" : "text-body"}`}>
              {duoiGH.length
                ? <><b>{duoiGH.length}</b> phòng có điểm DƯỚI giới hạn: {duoiGH.slice(0, 6).map((r) => r.maPhong).join(", ")}{duoiGH.length > 6 ? "…" : ""}</>
                : "Không phòng nào tụt dưới giới hạn"}
              {trenGH.length > 0 && <span className="text-warning font-medium"> · {trenGH.length} phòng có điểm trên giới hạn</span>}
              <span className="text-muted font-normal"> — xem chấm đỏ/vàng trên dòng diễn biến của từng phòng.</span>
            </p>
            {(suCoMo.length > 0 || suCoDong.length > 0) ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                {suCoMo.length > 0 && (
                  <span className="text-danger font-medium">
                    ● {suCoMo.length} phiếu chênh áp đang mở: {suCoMo.slice(0, 4).map((i) => `${i.id} (${i.room} · ${i.duration}h)`).join(" · ")}{suCoMo.length > 4 ? "…" : ""}
                  </span>
                )}
                {suCoDong.length > 0 && (
                  <span className="text-muted">
                    ✓ {suCoDong.length} phiếu đóng gần đây{suCoDong[0]?.dong_luc ? `, mới nhất ${new Date(suCoDong[0].dong_luc).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
                  </span>
                )}
                {onMoTabSuCo && <button onClick={onMoTabSuCo} className="text-info font-medium hover:underline">Mở tab Sự cố →</button>}
              </div>
            ) : (
              <p className="mt-1 text-[13px] text-success font-medium">Không có phiếu chênh áp đang mở hoặc mới đóng.</p>
            )}
          </div>
        );
      })()}
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
          // 17/08 (chủ hệ thống): tab chỉnh chính — mọi phòng cùng AHU hiện ĐỦ, không thu gọn
          // (chỉnh một phòng ảnh hưởng cả nhánh, phải nhìn được toàn AHU).
          const nhom = (ds) => {
            const g = {};
            ds.forEach((r) => { const k = `${r.khuVuc} / ${r.ahu}`; (g[k] ??= []).push(r); });
            return Object.keys(g).sort((a, b) => Math.min(...g[a].map(rank)) - Math.min(...g[b].map(rank)) || a.localeCompare(b))
              .map((k) => [k, g[k].slice().sort((x, y) => rank(x) - rank(y) || ordUu(x.uuTien) - ordUu(y.uuTien) || String(x.maPhong).localeCompare(String(y.maPhong)))]);
          };
          return (
            <div className="mt-3 space-y-4">
              {nhom(filt).map(([k, ds]) => {
                const dsCo = ds.filter((r) => r.coDuLieu !== false);
                const soDatNhom = dsCo.filter((r) => r.dat).length;
                const soMatDl = ds.length - dsCo.length;
                return (
                  <div key={k}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-bold uppercase tracking-wide text-muted">{k}</span>
                      <span className="text-[12px] tabular-nums">
                        {dsCo.length === 0
                          ? <span className="font-semibold text-muted">không có số đo — không kết luận</span>
                          : <><span className="text-muted">{soDatNhom}/{dsCo.length} đạt</span>
                              {soMatDl > 0 && <span className="ml-1.5 font-semibold text-muted">· {soMatDl} thiếu dữ liệu</span>}</>}
                      </span>
                    </div>
                    <div className="space-y-1.5">{ds.map((r) => <HangPhong key={r.maPhong} r={r} />)}</div>
                  </div>
                );
              })}
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
