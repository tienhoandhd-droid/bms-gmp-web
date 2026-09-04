// InspectorDrawer.jsx — primitive "bảng chi tiết" DÙNG CHUNG (G3 17/08/2026).
// Desktop: panel trượt phải, full-height. Mobile (<md): bottom-sheet 85vh.
// Mọi màn cần chi tiết (cụm cảm biến, điểm xu hướng, sự cố…) dùng chung vỏ này
// thay vì mỗi nơi tự dựng modal — cùng phím Esc, cùng backdrop, cùng nút đóng.
// A11y (WCAG 2.2): dùng useHopThoai (focus vào trong, Esc, Tab quay vòng, trả focus khi đóng)
// thay cho listener Esc tự viết — tránh đóng 2 lần.
import React, { useCallback, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useHopThoai } from "../../components/ui/HopThoai";

// Tách phần thân để hook chỉ chạy khi drawer thật sự mở (open=false thì không khoá cuộn, không giật focus).
function ThanDrawer({ onClose, eyebrow, title, actions, children }) {
  const hopRef = useRef(null);
  const idTieuDe = useId();
  // Giữ onClose ổn định: cha thường truyền arrow mới mỗi lần render; đưa thẳng vào hook thì hook chạy lại và giật focus.
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  const dong = useCallback(() => { if (onCloseRef.current) onCloseRef.current(); }, []);
  useHopThoai(hopRef, dong);
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={hopRef} role="dialog" aria-modal="true" aria-labelledby={idTieuDe} tabIndex={-1}
        className="absolute inset-x-0 bottom-0 h-[85vh] rounded-t-3xl md:inset-x-auto md:right-0 md:top-0 md:h-full md:w-full md:max-w-md md:rounded-none overflow-y-auto bg-surface shadow-2xl outline-none">
        <div className="sticky top-0 bg-surface/95 backdrop-blur px-5 py-4 border-b border-line flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className="text-[12px] uppercase tracking-[0.16em] text-muted font-semibold">{eyebrow}</p>}
            <h3 id={idTieuDe} className="mt-0.5 text-[17px] font-semibold" style={{ color: "var(--text-strong)" }}>{title}</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {actions}
            <button type="button" aria-label="Đóng hộp thoại" onClick={onClose} className="rounded-xl px-2.5 py-1 text-[13px] text-muted ring-1 ring-line hover:bg-subtle">Đóng</button>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export default function InspectorDrawer({ open = true, onClose, eyebrow, title, actions = null, children }) {
  if (!open) return null;
  return createPortal(<ThanDrawer onClose={onClose} eyebrow={eyebrow} title={title} actions={actions}>{children}</ThanDrawer>, document.body);
}
