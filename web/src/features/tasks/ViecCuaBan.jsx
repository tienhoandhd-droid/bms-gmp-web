// ViecCuaBan.jsx — khối "việc của bạn" (tách move-only từ App.jsx 17/08/2026).
import React, { useState } from "react";
import { COLOR } from "../../lib/designTokens";
import { cardShadow } from "../../lib/uiConst";
// ═══ VIỆC CỦA BẠN — banner nổi trên MỌI tab (QA/ADMIN thấy cụm chờ kết luận;
// IPC/MEP/LOT thấy sự cố mình phụ trách theo SLA server) ═══
// Tách khỏi App + React.memo với comparator bỏ-qua-prop-hàm (pattern KpiCard):
// trạng thái Thu gọn/Mở ra nằm TRONG banner nên bấm toggle chỉ render lại chính nó,
// không kéo cả cây App (bảng sự cố + biểu đồ) render theo — nguồn lag cũ.
const ViecCuaBan = React.memo(function ViecCuaBan({ viecCuaToi, cumChoToi, onXuLy, onGhiKetLuan }) {
  const [mo, setMo] = useState(true);
  const [tatCa, setTatCa] = useState(false);   // false = 5 việc + 3 cụm đầu · true = toàn bộ (khung cuộn)
  const [an, setAn] = useState(false);         // Ẩn cho gọn → còn viên nhỏ, bấm hiện lại (tự hiện lại khi F5)
  if (viecCuaToi.length === 0 && cumChoToi.length === 0) return null;
  const tong = viecCuaToi.length + cumChoToi.length;
  if (an) return (
    <button onClick={() => setAn(false)}
      className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface ring-1 ring-warning-line px-3.5 py-1.5 text-[12px] font-semibold hover:bg-warning-soft"
      style={{ color: "var(--text-strong)", ...cardShadow }} title="Hiện lại danh sách Việc của bạn">
      Việc của bạn · {tong}
      <span className="text-muted font-normal">Hiện ▾</span>
    </button>
  );
  const dsViec = tatCa ? viecCuaToi : viecCuaToi.slice(0, 5);
  const dsCum = tatCa ? cumChoToi : cumChoToi.slice(0, 3);
  const conAn = (viecCuaToi.length - dsViec.length) + (cumChoToi.length - dsCum.length);
  return (
    <div className="mb-4 rounded-2xl bg-surface ring-1 ring-warning-line px-4 py-3" style={cardShadow}>
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setMo(!mo)} className="min-w-0 flex-1 text-left">
          <span className="text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>
            Việc của bạn · {tong}
          </span>
        </button>
        <div className="shrink-0 flex items-center gap-1">
          <button onClick={() => setAn(true)} title="Ẩn cho gọn — còn viên nhỏ để hiện lại"
            className="rounded-lg px-2 py-1 text-[12px] text-muted hover:bg-subtle hover:text-body">Ẩn ✕</button>
          <button onClick={() => setMo(!mo)} className="rounded-lg px-2 py-1 text-[12px] text-muted hover:bg-subtle">{mo ? "Thu gọn ▲" : "Mở ra ▼"}</button>
        </div>
      </div>
      {mo && (
        <div className={`mt-2 space-y-1.5 ${tatCa ? "max-h-[46vh] overflow-y-auto overscroll-contain pr-1" : ""}`}>
          {dsViec.map(({ q, inc }) => (
            <div key={q.ma_su_co} className="flex items-center justify-between gap-3 rounded-xl bg-subtle px-3 py-2">
              <span className="min-w-0 text-[12px] text-body truncate">
                <b style={{ color: "var(--text-strong)" }}>{inc.id}</b> · {inc.room} · {inc.sensor}
                {q.gio_mo != null && <span className="ml-2 text-muted tabular-nums">mở {q.gio_mo}h</span>}
              </span>
              <button onClick={() => onXuLy(inc)} className="shrink-0 rounded-lg bg-surface px-2.5 py-1 text-[12px] font-semibold text-success ring-1 ring-success-line hover:bg-success-soft">Xử lý</button>
            </div>
          ))}
          {dsCum.map((c) => (
            <div key={c.ma_cum} className="flex items-center justify-between gap-3 rounded-xl bg-subtle px-3 py-2">
              <span className="min-w-0 text-[12px] text-body truncate">
                <b style={{ color: "var(--text-strong)" }}>{c.ma_hien_thi}</b> · {c.ahu || "?"} · {c.loai_cam_bien}
                <span className="ml-2 text-warning">chưa có kết luận điều tra</span>
              </span>
              <button onClick={() => onGhiKetLuan(c)} className="shrink-0 rounded-lg bg-surface px-2.5 py-1 text-[12px] font-semibold text-body ring-1 ring-line hover:bg-subtle">Ghi kết luận</button>
            </div>
          ))}
        </div>
      )}
      {mo && (conAn > 0 || tatCa) && (
        <button onClick={() => setTatCa(!tatCa)}
          className="mt-2 w-full rounded-xl bg-warning-soft/60 px-3 py-1.5 text-[12px] font-semibold text-warning ring-1 ring-warning-line hover:bg-warning-soft">
          {tatCa ? "Thu về danh sách ngắn ▴" : `Xem tất cả ${tong} việc ▾`}
        </button>
      )}
    </div>
  );
}, (a, b) => a.viecCuaToi === b.viecCuaToi && a.cumChoToi === b.cumChoToi);

export default ViecCuaBan;
