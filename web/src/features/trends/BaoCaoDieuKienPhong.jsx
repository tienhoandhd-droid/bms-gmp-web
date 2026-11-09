// BaoCaoDieuKienPhong.jsx — Báo cáo điều kiện phòng trong trang Xu hướng (09/11/2026).
// Nội dung = đúng tài liệu HTML tải về (taoHtmlBaoCaoPhong) hiển thị qua iframe srcDoc → màn hình và file gửi đi giống hệt.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileBarChart, Printer } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import { KhungLoi } from "../../components/ui/KhungLoi";
import { layBaoCaoDieuKienPhong } from "../../lib/supabaseData";
import { phanTichPhong } from "../../lib/phanTichDieuKienPhong";
import { taoHtmlBaoCaoPhong, tenFileBaoCaoPhong } from "../../lib/baoCaoPhongHtml";
import { nhanKhoang, soNgay } from "../../lib/khoangThoiGian";

const SO_NGAY_TOI_DA = 31;

export default function BaoCaoDieuKienPhong({ maPhong, khoang, homNay }) {
  const [trangThai, setTrangThai] = useState({ dangTai: false, loi: null, duLieu: null });
  const [lanThu, setLanThu] = useState(0);
  const [cao, setCao] = useState(600);
  const khungRef = useRef(null);
  const n = soNgay(khoang);
  const quaDai = n > SO_NGAY_TOI_DA;

  useEffect(() => {
    if (!maPhong || quaDai) return;
    let huy = false;
    setTrangThai({ dangTai: true, loi: null, duLieu: null });
    (async () => {
      const { error, data } = await layBaoCaoDieuKienPhong(maPhong, khoang.tu, khoang.den);
      if (huy) return;
      if (error) { console.error("[BMS] Tải báo cáo điều kiện phòng lỗi:", error); setTrangThai({ dangTai: false, loi: error, duLieu: null }); return; }
      setTrangThai({ dangTai: false, loi: null, duLieu: data });
    })();
    return () => { huy = true; };
  }, [maPhong, khoang.tu, khoang.den, quaDai, lanThu]);

  const { duLieu } = trangThai;
  // Giờ mong đợi: cả các ngày đã qua; nếu khoảng kết thúc hôm nay thì chỉ tính tới giờ hiện tại
  const soGioMongDoi = useMemo(() => {
    if (khoang.den !== homNay) return n * 24;
    const gioVN = new Date(Date.now() + 7 * 3600000).getUTCHours();
    return (n - 1) * 24 + gioVN;
  }, [khoang.den, homNay, n]);
  const html = useMemo(() => {
    if (!duLieu || !(duLieu.gio || []).length) return "";
    return taoHtmlBaoCaoPhong(duLieu, phanTichPhong(duLieu, { soGioMongDoi }), { theme: document.documentElement.dataset.theme || "" });
  }, [duLieu, soGioMongDoi]);

  const taiFile = () => {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = tenFileBaoCaoPhong(duLieu);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const inBaoCao = () => khungRef.current?.contentWindow?.print();
  const doCao = () => {
    const h = khungRef.current?.contentDocument?.documentElement?.scrollHeight;
    if (h) setCao(h + 8);
  };

  let noiDung;
  if (quaDai) {
    noiDung = <p className="text-tk-xs text-info bg-info-soft ring-1 ring-info-line rounded-lg px-3 py-2">ℹ️ Báo cáo phòng lập cho tối đa {SO_NGAY_TOI_DA} ngày. Khoảng đang chọn có {n} ngày — hãy chọn khoảng ngắn hơn (vd nút "Tháng trước" hoặc chọn Từ ngày/Đến ngày).</p>;
  } else if (trangThai.dangTai) {
    noiDung = <div role="status" aria-live="polite" className="h-40 rounded-xl bg-subtle animate-pulse flex items-center justify-center text-tk-xs text-muted">Đang tải báo cáo {maPhong} · {nhanKhoang(khoang)}…</div>;
  } else if (trangThai.loi) {
    noiDung = <KhungLoi gon tieuDe="Chưa tải được báo cáo điều kiện phòng" loi={trangThai.loi} onThuLai={() => setLanThu((x) => x + 1)} />;
  } else if (!html) {
    noiDung = <p className="text-tk-xs text-warning bg-warning-soft ring-1 ring-warning-line rounded-lg px-3 py-2">⚠ Phòng {maPhong} không có số liệu trong {nhanKhoang(khoang)}.</p>;
  } else {
    noiDung = <iframe ref={khungRef} title={`Báo cáo điều kiện phòng ${maPhong} ${nhanKhoang(khoang)}`} srcDoc={html} sandbox="allow-same-origin allow-modals" onLoad={doCao} style={{ height: cao }} className="w-full rounded-xl ring-1 ring-line bg-surface" />;
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <SectionTitle icon={FileBarChart} hint={`${maPhong} · ${nhanKhoang(khoang)} · nhiệt độ, độ ẩm, chênh áp theo giờ · phân tích tự động theo số liệu`}>Báo cáo điều kiện phòng</SectionTitle>
        <div className="flex gap-2">
          <button type="button" onClick={taiFile} disabled={!html} className="min-h-[44px] text-xs font-medium rounded-xl px-4 py-2 text-body ring-1 ring-line bg-surface hover:bg-subtle flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"><Download className="w-3.5 h-3.5" strokeWidth={1.8} /> Tải file HTML</button>
          <button type="button" onClick={inBaoCao} disabled={!html} className="min-h-[44px] text-xs font-medium rounded-xl px-4 py-2 text-body ring-1 ring-line bg-surface hover:bg-subtle flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"><Printer className="w-3.5 h-3.5" strokeWidth={1.8} /> In / PDF</button>
        </div>
      </div>
      {noiDung}
    </Card>
  );
}
