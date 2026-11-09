// TimKiemChung.jsx — Ô tìm chung ở đầu trang (09/11/2026).
// Gõ mã phòng / mã phiếu sự cố / tên trang → Enter để mở. Phím tắt Ctrl+K (⌘K) hoặc "/".
// Mobile: chỉ hiện nút kính lúp; bấm vào thì ô tìm mở rộng thành một hàng riêng trong header.
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { timKiemChung } from "../../lib/timKiemChung";

const TEN_NHOM = { phong: "Phòng", suCo: "Sự cố", trang: "Trang" };

export default function TimKiemChung({ trang, phong, suCo, onChon }) {
  const [q, setQ] = useState("");
  const [mo, setMo] = useState(false);          // danh sách kết quả đang mở
  const [moMobile, setMoMobile] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const listId = `tim-chung-${useId()}`;

  const ketQua = useMemo(() => timKiemChung(q, { trang, phong, suCo }), [q, trang, phong, suCo]);

  // Ctrl+K / ⌘K ở bất cứ đâu; "/" khi không đang gõ trong ô nhập khác
  useEffect(() => {
    const onKey = (e) => {
      const dangGo = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !dangGo)) {
        e.preventDefault();
        setMoMobile(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // bấm ra ngoài → đóng danh sách
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) { setMo(false); setMoMobile(false); } };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const chon = (x) => {
    if (!x) return;
    setQ(""); setMo(false); setMoMobile(false); setHi(0);
    inputRef.current?.blur();
    onChon(x);
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setMo(true); setHi((h) => Math.min(h + 1, ketQua.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); chon(ketQua[hi]); }
    else if (e.key === "Escape") { setMo(false); setMoMobile(false); inputRef.current?.blur(); }
  };

  const hienDs = mo && q.trim() !== "";
  const idDong = (i) => `${listId}-${i}`;

  return (
    <div ref={boxRef} className={`bms-khong-in relative ${moMobile ? "order-last w-full md:order-none md:w-72" : "md:w-72"}`}>
      {!moMobile && (
        <button type="button" onClick={() => { setMoMobile(true); requestAnimationFrame(() => inputRef.current?.focus()); }} className="bms-icon-button md:hidden" aria-label="Tìm phòng, sự cố, trang" title="Tìm (Ctrl+K)">
          <Search className="h-4 w-4" strokeWidth={1.9} />
        </button>
      )}
      {/* .bms-search-input tự đặt display:flex → ẩn/hiện bằng lớp bọc ngoài, không đặt "hidden" lên chính nó */}
      <div className={moMobile ? "" : "hidden md:block"}><label className="bms-search-input h-11">
        <Search className="h-4 w-4 text-muted shrink-0" aria-hidden="true" strokeWidth={1.8} />
        <span className="sr-only">Tìm phòng, sự cố hoặc trang</span>
        <input
          ref={inputRef}
          type="text"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={hienDs}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={hienDs && ketQua[hi] ? idDong(hi) : undefined}
          value={q}
          onChange={(e) => { setQ(e.target.value); setHi(0); setMo(true); }}
          onFocus={() => setMo(true)}
          onKeyDown={onKey}
          placeholder="Tìm phòng, sự cố, trang…"
          className="text-body"
        />
        {q ? (
          <button type="button" onClick={() => { setQ(""); inputRef.current?.focus(); }} className="text-muted hover:text-strong" aria-label="Xóa ô tìm"><X className="h-4 w-4" strokeWidth={1.8} /></button>
        ) : (
          <kbd className="hidden lg:inline text-tk-xs text-muted rounded-md px-1.5 ring-1 ring-line">Ctrl K</kbd>
        )}
      </label></div>
      {hienDs && (
        <ul id={listId} role="listbox" aria-label="Kết quả tìm kiếm" className="absolute right-0 z-[60] mt-1.5 w-full md:w-96 max-h-[60vh] overflow-auto rounded-xl bg-surface p-1.5 shadow-lg ring-1 ring-line">
          {ketQua.length === 0 && <li role="presentation" className="px-3 py-3 text-tk-xs text-muted">Không tìm thấy “{q.trim()}”. Thử mã phòng (vd C1.R21) hoặc mã phiếu sự cố.</li>}
          {ketQua.map((x, i) => (
            <React.Fragment key={`${x.nhom}:${x.giaTri}`}>
              {(i === 0 || ketQua[i - 1].nhom !== x.nhom) && <li role="presentation" className="px-3 pt-2 pb-1 text-tk-xs font-semibold text-muted">{TEN_NHOM[x.nhom]}</li>}
              <li id={idDong(i)} role="option" aria-selected={i === hi}
                onMouseDown={(e) => { e.preventDefault(); chon(x); }}
                onMouseEnter={() => setHi(i)}
                className={`flex items-baseline gap-2 rounded-lg px-3 py-2 cursor-pointer min-h-[44px] ${i === hi ? "bg-subtle" : ""}`}>
                <span className="text-tk-sm font-semibold text-strong whitespace-nowrap">{x.nhan}</span>
                <span className="text-tk-xs text-muted truncate">{x.phu}</span>
              </li>
            </React.Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}
