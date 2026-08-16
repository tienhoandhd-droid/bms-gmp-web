// ChenhApTheoAhu.jsx — tab Chênh áp theo AHU (tách move-only từ App.jsx 17/08/2026).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Gauge } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
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
  const [dhMap, setDhMap] = React.useState({});            // ma_phong → số giờ đứng hình (cảm biến DP)
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
  if (!isLive) return <Card className="p-8 text-center text-[13px] text-slate-500">Cần kết nối dữ liệu thật (LIVE) để xem chênh áp theo AHU.</Card>;
  const dsKhu = khuChoPhep || DS_KHU;
  const ahuPairs = [...new Set((rows || []).filter((r) => (khu === "ALL" || r.khuVuc === khu)).map((r) => `${r.khuVuc}|${r.ahu}`))].sort();
  const chip = (v, label, on, click) => <button key={v} onClick={click} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition ring-1 ${on ? "text-white ring-transparent" : "text-slate-600 bg-white ring-slate-200 hover:ring-teal-300"}`} style={on ? { backgroundColor: COLOR.teal } : {}}>{label}</button>;
  const filt = (rows || []).filter((r) => (khu === "ALL" || r.khuVuc === khu) && (ahuLoc === "ALL" || r.ahu === ahuLoc));
  const groups = {};
  filt.forEach((r) => { const k = `${r.khuVuc} / ${r.ahu}`; (groups[k] ??= []).push(r); });
  // Màu theo NGUYÊN TẮC CẢNH BÁO (16/07): ĐỎ = vi phạm theo hướng (DP=DUOI → dưới sàn,
  // cần chỉnh) · VÀNG = ngoài khoảng nhưng KHÔNG thuộc hướng (vd vượt trần — chú ý,
  // không phải sự cố) · XANH = trong dải · XÁM = không dữ liệu. `dat` do server chấm
  // theo canh_bao_huong nên đổi hướng trong Cài đặt là màu tự đổi theo.
  const ngoaiKhoang = (r) => r.coDuLieu !== false && r.giaTri != null
    && ((r.ghDuoi != null && r.giaTri < r.ghDuoi) || (r.ghTren != null && r.giaTri > r.ghTren));
  // 16/07 (user): P3 không mở vé → P3 không đạt hiển thị DỊU (đỏ nhạt + nhãn
  // "chưa cần xử lý ngay"), tách khỏi số "cần chỉnh" của P1/P2.
  // 16/07 (user): cảm biến ĐỨNG HÌNH → số đang xem là số CHẾT — nhãn cảnh báo riêng,
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
  const oCls = (r) => r.coDuLieu === false ? "bg-slate-100 ring-slate-300"
    : laDungHinh(r) ? "bg-slate-100 ring-2 ring-amber-400"
    : canGap(r) ? "bg-rose-100 ring-2 ring-rose-600"
    : p3KhongDat(r) ? "bg-rose-50/40 ring-1 ring-slate-200"
    : ngoaiKhoang(r) ? "bg-amber-100 ring-2 ring-amber-600"
    : "bg-emerald-50 ring-1 ring-emerald-500";
  const vCls = (r) => r.coDuLieu === false ? "text-slate-500"
    : laDungHinh(r) ? "text-slate-400 line-through"
    : canGap(r) ? "text-rose-900"
    : p3KhongDat(r) ? "text-slate-500"
    : ngoaiKhoang(r) ? "text-amber-800" : "text-emerald-800";
  // 03/08 (user: "cơ điện đọc trên app để sửa rất khó vì chậm vài phút"): hiện TUỔI
  // dữ liệu, không bắt người đứng máy tự nhẩm "10:32 là mấy phút trước". `tuoi_phut`
  // do server tính LÚC TRUY VẤN nên phải CỘNG thời gian trôi từ lúc nạp — nếu chỉ in
  // số của server thì nhãn đứng yên trong khi màn hình mỗi lúc một cũ (đúng loại lỗi
  // "hệ nói sai về chính nó" đã mắc với nhãn TB-5-phút).
  const nhanTuoi = (r) => {
    if (r.tuoiPhut == null) return null;
    const p = r.tuoiPhut + Math.floor(Math.max(0, dongHo - napLuc) / 60000);
    const mau = p >= 6 ? "text-rose-600" : p >= 3 ? "text-amber-600" : "text-slate-400";
    return <span className={`font-semibold ${mau}`}> · {p <= 0 ? "vừa xong" : `${p}′ trước`}</span>;
  };
  const ordUu = (p) => p === "P1" ? 1 : p === "P2" ? 2 : p === "P3" ? 3 : 4;
  return (
    <Card className="p-5">
      <SectionTitle icon={Gauge} hint="5 phút gần nhất từ FMS · ĐỎ = dưới sàn cần chỉnh (P1/P2) · VIỀN VÀNG XÁM = cảm biến đứng hình · XÁM PHỚT HỒNG = P3 chưa gấp · VÀNG = trên dải · XANH = đạt">Chênh áp theo AHU{filt.length > 0 && <> — <b className="text-rose-600">{soKhongDat}</b> cần chỉnh{soDh > 0 && <> · <b className="text-amber-600">{soDh}</b> đứng hình</>}{soP3 > 0 && <> · <b className="text-slate-400">{soP3}</b> P3 chưa gấp</>}{soNgoaiKhoang > 0 && <> · <b className="text-amber-600">{soNgoaiKhoang}</b> trên dải</>}{soMatDuLieu > 0 && <> · <b className="text-slate-500">{soMatDuLieu}</b> mất dữ liệu</>} /{filt.length} phòng</>}{dangTuoi && <span className="text-[10px] font-normal text-teal-600"> · đang lấy realtime…</span>}</SectionTitle>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Lọc khu</span>
        {chip("ALL", "Tất cả", khu === "ALL", () => { setKhu("ALL"); setAhuLoc("ALL"); })}
        {dsKhu.map((k) => chip(k, `Khu ${k}`, khu === k, () => { setKhu(k); setAhuLoc("ALL"); }))}
        {ahuPairs.length > 0 && (
          <select value={ahuLoc === "ALL" ? "ALL" : `${khu}|${ahuLoc}`} onChange={(e) => { const v = e.target.value; if (v === "ALL") setAhuLoc("ALL"); else { const [k, a] = v.split("|"); setKhu(k); setAhuLoc(a); } }} className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-1.5 text-[12px] text-slate-700 outline-none ml-1">
            <option value="ALL">AHU: tất cả</option>
            {ahuPairs.map((p) => { const [k, a] = p.split("|"); return <option key={p} value={p}>{khu === "ALL" ? `Khu ${k} · ${a}` : a}</option>; })}
          </select>
        )}
      </div>
      {/* 11/08 — BĂNG BÁO MẤT NGUỒN. Sự cố FMS treo 08:42–10:07 cho thấy bảng vẫn
          xanh mướt suốt 85 phút vì rơi âm thầm về rollup giờ. Nay trạng thái nguồn
          phải nằm ở chỗ dễ thấy nhất, không phải chữ nhỏ cạnh từng ô. */}
      {rows !== null && soMatDuLieu > 0 && (
        <div className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 ring-1 ring-rose-300">
          <p className="text-[12.5px] font-bold text-rose-800">
            ⚠ MẤT NGUỒN SỐ LIỆU — {soMatDuLieu}/{filt.length} phòng không có số đo đủ mới
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-rose-900">
            Số cuối cùng đo được vẫn hiện để tham khảo, nhưng hệ <b>KHÔNG kết luận đạt/không đạt</b> trên số đã cũ
            {nguongTuoi != null && <> (quá {nguongTuoi} phút)</>} — các phòng này không được tính vào số "đạt" lẫn số "cần chỉnh".
            Kiểm FMS ngay: nguồn treo thì phải có người khởi động lại, hệ không tự khỏi.
          </p>
        </div>
      )}
      {rows !== null && soMatDuLieu === 0 && soDungGio > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2 ring-1 ring-amber-300">
          <p className="text-[12px] text-amber-900">
            <b>Đang dùng số liệu theo GIỜ</b> ({soDungGio}/{filt.length} phòng) — mạch phút không có điểm mới trong 6 phút.
            Số đang xem là trung bình 5 phút cuối của giờ đã xong, không phải hiện tại.
          </p>
        </div>
      )}
      {rows === null ? <div className="mt-3 h-24 rounded-2xl bg-slate-50 animate-pulse" />
        : filt.length === 0 ? <p className="mt-3 text-[13px] text-slate-400">Không có phòng chênh áp trong phạm vi lọc.</p>
        : <div className="mt-3 space-y-4">
          {/* ĐỎ lên đầu (16/07): trong nhóm xếp đỏ → vàng → xanh → xám; nhóm AHU có
              phòng đỏ cũng nổi lên trước các nhóm toàn xanh. */}
          {Object.keys(groups).sort((a, b) => {
            const rank = (r) => r.coDuLieu === false ? 5 : canGap(r) ? 0 : laDungHinh(r) ? 1 : p3KhongDat(r) ? 2 : ngoaiKhoang(r) ? 3 : 4;
            const ma = Math.min(...groups[a].map(rank)), mb = Math.min(...groups[b].map(rank));
            return ma - mb || a.localeCompare(b);
          }).map((k) => {
            const rank = (r) => r.coDuLieu === false ? 5 : canGap(r) ? 0 : laDungHinh(r) ? 1 : p3KhongDat(r) ? 2 : ngoaiKhoang(r) ? 3 : 4;
            const ds = groups[k].slice().sort((a, b) => rank(a) - rank(b) || ordUu(a.uuTien) - ordUu(b.uuTien) || String(a.maPhong).localeCompare(String(b.maPhong)));
            // 11/08: mẫu số là phòng CÓ SỐ ĐO DÙNG ĐƯỢC, không phải mọi phòng.
            // Trước đây "{soDat}/{ds.length} đạt" đếm cả phòng đang mất nguồn mà
            // server vẫn trả dat=true từ bucket giờ cũ ⇒ số phòng đạt là đạt giả.
            const dsCo = ds.filter((r) => r.coDuLieu !== false);
            const soDat = dsCo.filter((r) => r.dat).length;
            const soMatDl = ds.length - dsCo.length;
            return (
              <div key={k}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">{k}</span>
                  <span className="text-[11px] tabular-nums">
                    {dsCo.length === 0
                      ? <span className="font-semibold text-slate-500">không có số đo — không kết luận</span>
                      : <><span className="text-slate-400">{soDat}/{dsCo.length} đạt</span>
                          {soMatDl > 0 && <span className="ml-1.5 font-semibold text-slate-500">· {soMatDl} mất dữ liệu</span>}</>}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {ds.map((r) => (
                    <div key={r.maPhong} className={`rounded-xl px-3.5 py-2.5 flex items-center gap-x-5 gap-y-2 flex-wrap ${oCls(r)}`}>
                      <div className="w-[168px] shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13.5px] font-semibold text-slate-800">{r.maPhong}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/80 text-slate-500">{r.uuTien}</span>
                        </div>
                        <div className="text-[10.5px] text-slate-400 truncate" title={r.tenPhong}>{r.tenPhong}</div>
                        {laDungHinh(r) && (
                          <div className="mt-1 inline-block rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-amber-800 ring-1 ring-amber-300">
                            ⚠ Cảm biến đứng hình {dhMap[r.maPhong]} giờ — vui lòng kiểm tra lại trước khi chỉnh
                          </div>
                        )}
                      </div>
                      <div className="w-[96px] shrink-0 rounded-lg bg-white/80 px-2 py-1 text-center ring-1 ring-slate-200/60">
                        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Yêu cầu ({r.donVi})</div>
                        <div className="text-[15px] font-bold text-slate-800 tabular-nums leading-tight">{r.ghDuoi}–{r.ghTren}</div>
                      </div>
                      {/* 16/07 (user): chuỗi 5′ kẻ BẢNG 2 hàng — giờ trên, chênh áp dưới — dễ dò cột hơn dãy chữ liền */}
                      {r.chuoi && r.chuoi.length > 0 && (
                        <div className="grow flex justify-center"><div className="rounded-lg overflow-hidden ring-1 ring-slate-200 bg-white shrink-0">
                        <table className="border-collapse shrink-0">
                          <tbody>
                            <tr>
                              {r.chuoi.map((p) => (
                                <td key={`t${p.t}`} className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-center text-[10.5px] text-slate-600 tabular-nums">{p.t}</td>
                              ))}
                            </tr>
                            <tr>
                              {r.chuoi.map((p, i) => {
                                const cuoi = i === r.chuoi.length - 1;
                                const duoiSan = Number(p.v) < r.ghDuoi; const trenTran = Number(p.v) > r.ghTren;
                                return (
                                  <td key={`v${p.t}`} className={`border border-slate-200 px-2 py-0.5 text-center text-[12.5px] tabular-nums ${cuoi ? `font-bold ${vCls(r)} bg-white` : duoiSan ? "text-rose-600 font-semibold bg-rose-50/50" : trenTran ? "text-amber-600 font-semibold bg-amber-50/50" : "text-slate-700 bg-white"}`}>{p.v}</td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                        </div></div>
                      )}
                      <div className="ml-auto w-[132px] text-right shrink-0">
                        <div className={`text-[17px] font-bold tabular-nums leading-none ${vCls(r)}`}>{r.coDuLieu === false ? "—" : <>{r.giaTri}<span className="text-[10px] font-medium"> {r.donVi}</span></>}</div>
                        <div className="text-[9.5px] text-slate-400 mt-0.5">{r.coDuLieu === false ? "thiếu dữ liệu" : <>{r.realtime ? <span className="text-teal-600 font-semibold">● realtime</span> : <span className="text-amber-600">giờ gần nhất</span>} {r.thoiDiem}{nhanTuoi(r)}{r.dat === false && (r.uuTien === "P3"
                          ? <span className="font-medium text-slate-400"> · P3 — chưa cần xử lý ngay</span>
                          : <span className={`font-semibold ${vCls(r)}`}> · KHÔNG ĐẠT</span>)}</>}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>}
    </Card>
  );
}


export default ChenhApTheoAhu;
