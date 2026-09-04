// HopThoai.jsx — hộp thoại dùng chung đạt WCAG 2.2 (đợt A 04/09/2026).
// Vì sao cần: các modal cũ thiếu role="dialog", không đóng bằng Esc, không giữ focus
// bên trong; riêng "Tạm hoãn cảnh báo" còn dùng 2 hộp window.prompt nối đuôi rồi ghi
// thẳng vào audit trail — iOS chế độ riêng tư chặn prompt nên thao tác thất bại im lặng.
// Mọi hộp thoại mới dùng <HopThoai>; hộp cũ chuyển dần sang đây (đợt B).
//
// Hành vi bắt buộc của một dialog đạt chuẩn:
//   • role="dialog" + aria-modal + aria-labelledby (screen reader đọc đúng tiêu đề).
//   • Mở: focus vào phần tử đầu tiên bấm được. Đóng: trả focus về nút đã mở.
//   • Esc đóng. Tab/Shift+Tab quay vòng bên trong (focus-trap), không lọt ra trang sau.
//   • Bấm nền mờ đóng (trừ khi đang chạy — tránh mất dữ liệu đang ghi).
//   • Khoá cuộn trang nền khi mở.
import React, { useEffect, useRef, useId, useState } from "react";
import { X, BellOff, Check } from "lucide-react";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Hook dùng chung cho MỌI hộp thoại/ngăn kéo (kể cả modal cũ chưa đổi sang <HopThoai>):
//   const hopRef = useRef(null); useHopThoai(hopRef, onDong, dangChay);
//   <div ref={hopRef} role="dialog" aria-modal="true" aria-labelledby=… tabIndex={-1}>…</div>
// Làm 4 việc: focus vào trong khi mở · Esc đóng · Tab quay vòng bên trong · trả focus + mở lại cuộn khi đóng.
export function useHopThoai(hopRef, onDong, dangChay = false) {
  // Giữ callback/cờ trong ref: nơi gọi thường truyền arrow function mới mỗi lần render
  // (AppShell render lại mỗi nhịp poll 60 s) — nếu effect phụ thuộc onDong thì sẽ chạy lại,
  // trả focus rồi focus lại ô đầu tiên ⇒ người dùng đang gõ bị giật con trỏ.
  const onDongRef = useRef(onDong); onDongRef.current = onDong;
  const dangChayRef = useRef(dangChay); dangChayRef.current = dangChay;
  useEffect(() => {
    const onDong = () => onDongRef.current();
    const truoc = document.activeElement;
    const hop = hopRef.current;
    // Focus phần tử đầu tiên bấm được (ưu tiên ô nhập), không thì chính hộp thoại.
    const dau = hop?.querySelector("textarea, input, select") || hop?.querySelector(FOCUSABLE) || hop;
    dau?.focus?.();
    const cuonCu = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") { if (!dangChayRef.current) { e.stopPropagation(); onDong(); } return; }
      if (e.key !== "Tab" || !hop) return;
      const ds = Array.from(hop.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (ds.length === 0) { e.preventDefault(); return; }
      const dauTien = ds[0], cuoi = ds[ds.length - 1];
      if (e.shiftKey && document.activeElement === dauTien) { e.preventDefault(); cuoi.focus(); }
      else if (!e.shiftKey && document.activeElement === cuoi) { e.preventDefault(); dauTien.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = cuonCu;
      if (truoc && typeof truoc.focus === "function") truoc.focus();
    };
  }, [hopRef]);   // chạy đúng 1 lần khi hộp thoại mount
}

export function HopThoai({ tieuDe, moTa, icon: Icon, onDong, dangChay = false, rong = "max-w-lg", chanTrang, children }) {
  const hopRef = useRef(null);
  const tieuDeId = useId();
  const moTaId = useId();
  useHopThoai(hopRef, onDong, dangChay);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12,41,59,0.38)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !dangChay) onDong(); }}>
      <div ref={hopRef} role="dialog" aria-modal="true" aria-labelledby={tieuDeId} aria-describedby={moTa ? moTaId : undefined} tabIndex={-1}
        className={`w-full ${rong} rounded-3xl bg-surface ring-1 ring-line overflow-hidden outline-none`} style={{ boxShadow: "0 30px 80px -20px rgba(12,41,59,0.5)" }}>
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-3 bg-subtle">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && <div className="rounded-2xl bg-surface p-2.5 ring-1 ring-line shrink-0"><Icon className="w-5 h-5" style={{ color: "var(--primary)" }} strokeWidth={1.8} /></div>}
            <div className="min-w-0">
              <h2 id={tieuDeId} className="text-base font-semibold" style={{ color: "var(--text-strong)" }}>{tieuDe}</h2>
              {moTa && <p id={moTaId} className="text-[12px] text-muted">{moTa}</p>}
            </div>
          </div>
          <button type="button" onClick={onDong} disabled={dangChay} aria-label="Đóng hộp thoại"
            className="rounded-full p-2 hover:bg-surface text-muted disabled:opacity-50 min-w-[36px] min-h-[36px] flex items-center justify-center">
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {chanTrang && <div className="px-6 py-4 bg-subtle flex items-center justify-end gap-2 flex-wrap">{chanTrang}</div>}
      </div>
    </div>
  );
}

// Hộp thoại TẠM HOÃN CẢNH BÁO — thay 2 window.prompt nối đuôi.
// Luật giữ nguyên như RPC rpc_tam_dung_canh_bao: lý do ≥ 10 ký tự, 15–240 phút.
export const PHUT_TAM_HOAN = [15, 30, 60, 120, 240];
export const LY_DO_TOI_THIEU = 10;

export function HopThoaiTamHoan({ suCo, dangChay = false, onDong, onXacNhan }) {
  const [lyDo, setLyDo] = useState("");
  const [phut, setPhut] = useState(60);
  const [daBam, setDaBam] = useState(false);
  const lyDoSach = lyDo.trim();
  const thieu = lyDoSach.length < LY_DO_TOI_THIEU;
  const loiId = useId();
  const gui = () => { setDaBam(true); if (thieu || dangChay) return; onXacNhan({ lyDo: lyDoSach, phut }); };
  return (
    <HopThoai tieuDe="Tạm hoãn cảnh báo" moTa="Ghi vào hồ sơ audit · tự cảnh báo lại khi hết hạn" icon={BellOff} onDong={onDong} dangChay={dangChay}
      chanTrang={<>
        <button type="button" onClick={onDong} disabled={dangChay} className="px-4 py-2 rounded-xl text-sm text-body hover:bg-surface min-h-[40px]">Huỷ</button>
        <button type="button" onClick={gui} disabled={dangChay || thieu} aria-describedby={thieu && daBam ? loiId : undefined}
          className="px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 text-white disabled:bg-subtle disabled:text-muted min-h-[40px]"
          style={!thieu && !dangChay ? { backgroundColor: "var(--danger-solid)" } : {}}>
          <Check className="w-4 h-4" strokeWidth={2} /> {dangChay ? "Đang ghi…" : `Tạm hoãn ${phut} phút`}
        </button>
      </>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); gui(); }}>
        {suCo && (
          <div className="grid grid-cols-3 gap-3 text-xs">
            {[["Mã sự cố", suCo.id], ["Phòng", suCo.room], ["Chỉ tiêu", suCo.sensor]].map(([k, v]) => (
              <div key={k}><p className="text-muted text-[12px] uppercase tracking-wider font-semibold">{k}</p><p className="mt-1 font-semibold" style={{ color: "var(--text-strong)" }}>{v || "—"}</p></div>
            ))}
          </div>
        )}
        <div>
          <label htmlFor="tam-hoan-ly-do" className="text-[12px] font-semibold text-body mb-2 block">Lý do tạm hoãn <span className="text-danger" aria-hidden="true">*</span></label>
          <textarea id="tam-hoan-ly-do" rows={3} value={lyDo} onChange={(e) => setLyDo(e.target.value)} required minLength={LY_DO_TOI_THIEU}
            aria-invalid={thieu && daBam ? true : undefined} aria-describedby={`tam-hoan-goi-y${thieu && daBam ? " " + loiId : ""}`}
            placeholder="Ví dụ: Cơ điện đang thay lọc HEPA AHU-K01, dự kiến xong 15:30"
            className="w-full rounded-2xl bg-subtle px-4 py-3 text-sm text-body outline-none ring-1 ring-line focus:ring-2 focus:ring-[var(--focus)] resize-none placeholder:text-muted" />
          <p id="tam-hoan-goi-y" className="mt-1.5 text-[12px] text-muted">Tối thiểu {LY_DO_TOI_THIEU} ký tự · còn {Math.max(0, LY_DO_TOI_THIEU - lyDoSach.length)} ký tự nữa. Lý do được ghi nguyên văn vào nhật ký.</p>
          {thieu && daBam && <p id={loiId} role="alert" className="mt-1.5 text-[12px] font-medium text-danger">Chưa đủ lý do — cần ít nhất {LY_DO_TOI_THIEU} ký tự để ghi hồ sơ.</p>}
        </div>
        <fieldset>
          <legend className="text-[12px] font-semibold text-body mb-2">Thời lượng</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Thời lượng tạm hoãn">
            {PHUT_TAM_HOAN.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={phut === p} onClick={() => setPhut(p)}
                className={`px-3.5 py-2 rounded-xl text-[13px] font-medium ring-1 min-h-[40px] ${phut === p ? "text-white ring-transparent" : "text-body bg-surface ring-line hover:ring-line-strong"}`}
                style={phut === p ? { backgroundColor: "var(--anchor)" } : {}}>
                {p < 60 ? `${p} phút` : `${p / 60} giờ`}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">Hết hạn hệ thống tự bật lại cảnh báo. Sự cố mức nghiêm trọng hoặc phòng P1 chỉ QA / Quản trị được hoãn — máy chủ tự kiểm.</p>
        </fieldset>
      </form>
    </HopThoai>
  );
}
