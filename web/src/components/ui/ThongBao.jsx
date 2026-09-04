// ThongBao.jsx — thanh thông báo thay window.alert (đợt A 04/09/2026).
// Vì sao: alert() chặn cả trang, không đọc được bằng screen reader theo chuẩn,
// không theo theme, và trên màn hình treo tường sẽ treo dashboard tới khi ai đó bấm OK.
// Quy ước GMP: LỖI giữ nguyên tới khi người dùng đóng (không tự biến mất, tránh bỏ sót);
// THÀNH CÔNG / THÔNG TIN tự ẩn sau 6 giây.
//
// Cách dùng trong AppShell:
//   const [dsThongBao, setDsThongBao] = useState([]);
//   const bao = taoBao(setDsThongBao);      // bao("loi", "…") · bao("ok", "…") · bao("info", "…")
//   <ThongBaoStack items={dsThongBao} onDong={(id) => setDsThongBao((ds) => ds.filter((x) => x.id !== id))} />
import React from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

let dem = 0;
const TU_AN_MS = 6000;

export function taoBao(setDs) {
  return (loai, text) => {
    const id = ++dem;
    setDs((ds) => [...ds, { id, loai, text: String(text || "") }]);
    if (loai !== "loi") setTimeout(() => setDs((ds) => ds.filter((x) => x.id !== id)), TU_AN_MS);
    return id;
  };
}

const KIEU = {
  loi: { Icon: AlertTriangle, lop: "bg-danger-soft text-danger ring-danger-line", nhan: "Lỗi" },
  ok: { Icon: CheckCircle2, lop: "bg-success-soft text-success ring-success-line", nhan: "Đã xong" },
  info: { Icon: Info, lop: "bg-info-soft text-info ring-info-line", nhan: "Thông tin" },
};

export function ThongBaoStack({ items, onDong }) {
  const loi = items.filter((x) => x.loai === "loi");
  const khac = items.filter((x) => x.loai !== "loi");
  // Hai vùng live riêng: lỗi đọc ngay (assertive), còn lại đọc khi rảnh (polite).
  return (
    <div className="fixed inset-x-0 bottom-20 lg:bottom-6 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
      <div role="alert" aria-live="assertive" className="contents">{loi.map((x) => <MotThongBao key={x.id} {...x} onDong={onDong} />)}</div>
      <div role="status" aria-live="polite" className="contents">{khac.map((x) => <MotThongBao key={x.id} {...x} onDong={onDong} />)}</div>
    </div>
  );
}

function MotThongBao({ id, loai, text, onDong }) {
  const k = KIEU[loai] || KIEU.info;
  return (
    <div className={`pointer-events-auto w-full max-w-md rounded-2xl ring-1 px-4 py-3 flex items-start gap-3 text-[13px] leading-snug ${k.lop}`} style={{ boxShadow: "0 12px 32px -12px rgba(12,41,59,0.45)", background: "var(--bg-surface)" }}>
      <k.Icon className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
      <p className="flex-1 whitespace-pre-line text-body"><span className="sr-only">{k.nhan}: </span>{text}</p>
      <button type="button" onClick={() => onDong(id)} aria-label="Đóng thông báo" className="shrink-0 rounded-full p-1.5 -m-1 hover:bg-subtle text-muted min-w-[32px] min-h-[32px] flex items-center justify-center">
        <X className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
