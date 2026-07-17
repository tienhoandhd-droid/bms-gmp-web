// ============================================================
// SoDoVongDoi.jsx — SƠ ĐỒ VÒNG ĐỜI SỰ CỐ chi tiết (tab Nhiệm vụ, 17/07).
// SVG TĨNH đồng bộ từ tài liệu VONG-DOI-SU-CO.html (làn bơi 5 bộ phận +
// tầng chi tiết email). ĐỔI LUẬT → cập nhật tài liệu rồi đồng bộ lại khối
// SVG này (nội dung tin cậy, tự soạn — không phải dữ liệu người dùng).
// Hiển thị: co giãn 100% chiều ngang (viewBox giữ tỉ lệ); màn hình hẹp
// (<1000px) chuyển sang kéo ngang để chữ không quá nhỏ; nút ⛶ mở toàn
// màn hình (Esc/✕ để đóng). Lazy-load để không phình bundle chính.
// ============================================================
import React, { useState, useEffect } from "react";

const SVG = `<svg viewBox="0 0 1710 2010" style="width:100%;height:auto;display:block;font-family:Inter,'Segoe UI',system-ui,Arial,sans-serif" role="img" aria-label="Sơ đồ vòng đời sự cố chi tiết theo bộ phận">
<defs>
<marker id="mIPC" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#185fa5"/></marker>
<marker id="mMEP" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#854f0b"/></marker>
<marker id="mLOT" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#a32d2d"/></marker>
<marker id="mQA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#0f6e56"/></marker>
<marker id="mSYS" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#5b4b8a"/></marker>
<marker id="mCLOSE" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#3f4a54"/></marker>
</defs>
<style>
.ln{fill:none}
.lbl{font-weight:600;paint-order:stroke;stroke:#ffffff;stroke-width:4px;stroke-linejoin:round}
.ttl{font-size:18px;font-weight:800}
.sb{font-size:13.5px;fill:#5f7a90}
.lane{font-size:15px;font-weight:800;letter-spacing:.14em}
.bx{stroke-width:2.4}
</style>
<rect x="50" y="40" width="1645" height="170" fill="#efeaf8" opacity=".5" rx="10"/>
<text class="lane" fill="#5b4b8a" transform="rotate(-90 30 125.0)" x="30" y="125.0" text-anchor="middle">HỆ THỐNG</text>
<rect x="50" y="216" width="1645" height="300" fill="#e6f1fb" opacity=".5" rx="10"/>
<text class="lane" fill="#185fa5" transform="rotate(-90 30 366.0)" x="30" y="366.0" text-anchor="middle">IPC</text>
<rect x="50" y="522" width="1645" height="540" fill="#faeeda" opacity=".5" rx="10"/>
<text class="lane" fill="#854f0b" transform="rotate(-90 30 792.0)" x="30" y="792.0" text-anchor="middle">CƠ ĐIỆN</text>
<rect x="50" y="1068" width="1645" height="250" fill="#fcebeb" opacity=".5" rx="10"/>
<text class="lane" fill="#a32d2d" transform="rotate(-90 30 1193.0)" x="30" y="1193.0" text-anchor="middle">TRỰC HSL</text>
<rect x="50" y="1324" width="1645" height="200" fill="#e7f4ef" opacity=".5" rx="10"/>
<text class="lane" fill="#0f6e56" transform="rotate(-90 30 1424.0)" x="30" y="1424.0" text-anchor="middle">QA</text>
<rect x="1385" y="40" width="285" height="1024" fill="#f8fafb" stroke="#cbd5e1" stroke-dasharray="5 4" rx="12"/>
<text x="1527" y="66" text-anchor="middle" font-size="13.5" font-weight="800" letter-spacing=".12em" fill="#5f7a90">KẾT THÚC — VÉ ĐÓNG</text>
<rect class="bx" x="70" y="78" width="290" height="100" rx="14" stroke="#5b4b8a" fill="#fff"/>
<text class="ttl" x="88" y="108" fill="#5b4b8a">WF1 chấm điểm mỗi giờ (:02)</text>
<text class="sb" x="88" y="134" fill="#5f7a90">lệch dải &gt; 20′ và 10′ cuối ≥ 4</text>
<text class="sb" x="88" y="156" fill="#5f7a90">→ mở vé NGHIÊM TRỌNG (P1/P2)</text>
<rect class="bx" x="400" y="78" width="330" height="100" rx="14" stroke="#5b4b8a" fill="#fff" stroke-dasharray="6 4"/>
<text class="ttl" x="418" y="108" fill="#5b4b8a">Cảm biến đứng hình ≥ 3 giờ</text>
<text class="sb" x="418" y="134" fill="#5f7a90">= thiếu dữ liệu — KHÔNG mở vé</text>
<text class="sb" x="418" y="156" fill="#5f7a90">theo dõi tab Cảm biến · WF11 07:00</text>
<rect class="bx" x="1405" y="78" width="245" height="100" rx="14" stroke="#5b4b8a" fill="#efeaf8"/>
<text class="ttl" x="1423" y="108" fill="#5b4b8a">TỰ ĐÓNG ⏹</text>
<text class="sb" x="1423" y="134" fill="#5f7a90">đủ 2 GIỜ SẠCH liên tiếp</text>
<text class="sb" x="1423" y="156" fill="#5f7a90">— áp dụng mọi vé đang mở</text>
<path class="ln" d="M760,145 L1405,145" stroke="#0f6e56" stroke-width="2.6" stroke-dasharray="7 5" marker-end="url(#mQA)"/>
<text class="lbl" x="770" y="131" fill="#0f6e56" font-size="14">KHÔNG cần bấm gì: số liệu đẹp 2 GIỜ liên tiếp → TỰ ĐÓNG (mọi vé đang mở)</text>
<path class="ln" d="M560,78 L560,52 L1680,52 L1680,850 L1650,850" stroke="#5b4b8a" stroke-width="2.4" stroke-dasharray="6 4" marker-end="url(#mSYS)"/>
<text class="lbl" x="750" y="47" fill="#5b4b8a" font-size="14">vé đang mở của cảm biến đứng hình bị hệ ĐÓNG (ngoài phạm vi)</text>
<rect class="bx" x="70" y="246" width="340" height="240" rx="14" stroke="#185fa5" fill="#fff"/>
<text class="ttl" x="88" y="276" fill="#185fa5">CHƯA XỬ LÝ</text>
<text x="230" y="276" font-size="11" fill="#9aa6b1">CHUA_XU_LY</text>
<text class="sb" x="88" y="300" fill="#5f7a90">vé mới · vé MỞ LẠI — IPC ra hiện trường, 4 nút:</text>
<rect x="86" y="314" width="308" height="30" rx="9" fill="#e6f1fb"/>
<text x="97" y="334.5" font-size="15" font-weight="700" fill="#185fa5">① Chuyển Cơ điện xử lý</text>
<rect x="86" y="350" width="308" height="30" rx="9" fill="#e6f1fb"/>
<text x="97" y="370.5" font-size="15" font-weight="700" fill="#185fa5">② Đã kiểm tra — Bình thường ✍ ⏹</text>
<rect x="86" y="386" width="308" height="30" rx="9" fill="#e6f1fb"/>
<text x="97" y="406.5" font-size="15" font-weight="700" fill="#185fa5">③ Đã khắc phục sự cố ✍ ⏹</text>
<rect x="86" y="422" width="308" height="30" rx="9" fill="#e6f1fb"/>
<text x="97" y="442.5" font-size="15" font-weight="700" fill="#185fa5">④ Không tại hiện trường ⟳ (ân hạn 1 giờ)</text>
<rect class="bx" x="1405" y="246" width="245" height="95" rx="14" stroke="#3f4a54" fill="#eef1f4"/>
<text class="ttl" x="1423" y="276" fill="#3f4a54">IPC — BÌNH THƯỜNG ⏹</text>
<text class="sb" x="1423" y="300" fill="#5f7a90">cảnh báo giả · ghi lý do ✍</text>
<path class="ln" d="M410,268 L1405,268" stroke="#185fa5" stroke-width="2.4" marker-end="url(#mIPC)"/>
<circle cx="432" cy="268" r="11.5" fill="#fff" stroke="#185fa5" stroke-width="1.8"/>
<text x="432" y="272.5" font-size="13" font-weight="800" fill="#185fa5" text-anchor="middle">②</text>
<text class="lbl" x="452" y="261" fill="#185fa5" font-size="14">đóng — cảnh báo giả</text>
<path class="ln" d="M410,300 L1368,300 L1368,578 L1405,578" stroke="#185fa5" stroke-width="2.4" marker-end="url(#mIPC)"/>
<circle cx="432" cy="300" r="11.5" fill="#fff" stroke="#185fa5" stroke-width="1.8"/>
<text x="432" y="304.5" font-size="13" font-weight="800" fill="#185fa5" text-anchor="middle">③</text>
<text class="lbl" x="452" y="322" fill="#185fa5" font-size="14">đóng — IPC tự xử lý được</text>
<path class="ln" d="M410,332 L560,332 L560,522" stroke="#185fa5" stroke-width="2.4" marker-end="url(#mIPC)"/>
<circle cx="432" cy="332" r="11.5" fill="#fff" stroke="#185fa5" stroke-width="1.8"/>
<text x="432" y="336.5" font-size="13" font-weight="800" fill="#185fa5" text-anchor="middle">①</text>
<text class="lbl" x="452" y="354" fill="#185fa5" font-size="14">đường DUY NHẤT sang Cơ điện</text>
<path class="ln" d="M950,268 l16,0" stroke="#185fa5" stroke-width="2.4" marker-end="url(#mIPC)"/>
<path class="ln" d="M950,300 l16,0" stroke="#185fa5" stroke-width="2.4" marker-end="url(#mIPC)"/>
<path class="ln" d="M1368,450 l0,16" stroke="#185fa5" stroke-width="2.4" marker-end="url(#mIPC)"/>
<path class="ln" d="M185,178 L185,246" stroke="#5b4b8a" stroke-width="2.4" marker-end="url(#mSYS)"/>
<text class="lbl" x="197" y="218" fill="#5b4b8a" font-size="14">mở vé · email đi ≤ 5′</text>
<rect class="bx" x="430" y="552" width="350" height="180" rx="14" stroke="#854f0b" fill="#fff"/>
<text class="ttl" x="448" y="582" fill="#854f0b">ĐÃ BÁO CƠ ĐIỆN</text>
<text x="448" y="602" font-size="11" fill="#9aa6b1">DA_BAO_CO_DIEN · chờ nhận việc</text>
<rect x="446" y="616" width="318" height="30" rx="9" fill="#faeeda"/>
<text x="457" y="636.5" font-size="15" font-weight="700" fill="#854f0b">① Đã nhận thông tin — đang xử lý</text>
<rect x="446" y="652" width="318" height="30" rx="9" fill="#faeeda"/>
<text x="457" y="672.5" font-size="15" font-weight="700" fill="#854f0b">② Không tại hiện trường ⟳ (1 giờ)</text>
<text class="sb" x="448" y="710" fill="#5f7a90">email nhắc 2 giờ/lần (07:45–16:45)</text>
<rect class="bx" x="840" y="552" width="360" height="216" rx="14" stroke="#854f0b" fill="#fff"/>
<text class="ttl" x="858" y="582" fill="#854f0b">CƠ ĐIỆN ĐANG XỬ LÝ</text>
<text x="858" y="602" font-size="11" fill="#9aa6b1">CO_DIEN_DANG_XU_LY · sửa AHU</text>
<rect x="856" y="616" width="328" height="30" rx="9" fill="#faeeda"/>
<text x="867" y="636.5" font-size="15" font-weight="700" fill="#854f0b">① Đã khắc phục ✍ ⏹</text>
<rect x="856" y="652" width="328" height="30" rx="9" fill="#faeeda"/>
<text x="867" y="672.5" font-size="15" font-weight="700" fill="#854f0b">② Chờ xử lý (khi rảnh)</text>
<rect x="856" y="688" width="328" height="30" rx="9" fill="#faeeda"/>
<text x="867" y="708.5" font-size="15" font-weight="700" fill="#854f0b">③ Không thể xử lý ✍</text>
<text class="sb" x="858" y="746" fill="#5f7a90">nút 🔒 trong mail mở sau "Đã nhận"</text>
<rect class="bx" x="840" y="858" width="360" height="160" rx="14" stroke="#854f0b" fill="#fff" stroke-dasharray="6 4"/>
<text class="ttl" x="858" y="888" fill="#854f0b">CHỜ XỬ LÝ (khi rảnh)</text>
<text x="858" y="908" font-size="11" fill="#9aa6b1">CO_DIEN_CHO_XU_LY · vé VẪN MỞ, vẫn nhắc</text>
<rect x="856" y="922" width="328" height="30" rx="9" fill="#faeeda"/>
<text x="867" y="942.5" font-size="15" font-weight="700" fill="#854f0b">① Đã nhận — xử lý tiếp</text>
<rect x="856" y="958" width="328" height="30" rx="9" fill="#faeeda"/>
<text x="867" y="978.5" font-size="15" font-weight="700" fill="#854f0b">② Không tại hiện trường ⟳ (1 giờ)</text>
<rect class="bx" x="430" y="858" width="350" height="196" rx="14" stroke="#a32d2d" fill="#fff"/>
<text class="ttl" x="448" y="888" fill="#a32d2d">KHÔNG XỬ LÝ ĐƯỢC</text>
<text x="448" y="908" font-size="11" fill="#9aa6b1">CO_DIEN_KHONG_XU_LY_DUOC · bế tắc ✍</text>
<rect x="446" y="922" width="318" height="30" rx="9" fill="#e6f1fb"/>
<text x="457" y="942.5" font-size="15" font-weight="700" fill="#185fa5">① IPC: Chuyển Cơ điện (giao lại)</text>
<rect x="446" y="958" width="318" height="30" rx="9" fill="#faeeda"/>
<text x="457" y="978.5" font-size="15" font-weight="700" fill="#854f0b">② Đã có vật tư — xử lý tiếp</text>
<rect x="446" y="994" width="318" height="30" rx="9" fill="#e6f1fb"/>
<text x="457" y="1014.5" font-size="15" font-weight="700" fill="#185fa5">③ IPC: Không tại hiện trường ⟳</text>
<rect class="bx" x="1405" y="548" width="245" height="120" rx="14" stroke="#0f6e56" fill="#e7f4ef"/>
<text class="ttl" x="1423" y="578" fill="#0f6e56">ĐÃ KHẮC PHỤC ⏹</text>
<text class="sb" x="1423" y="602" fill="#5f7a90">sự cố thật, đã sửa xong</text>
<text class="sb" x="1423" y="624" fill="#5f7a90">Cơ điện · IPC · QA · Quản trị ✍</text>
<rect class="bx" x="1405" y="800" width="245" height="110" rx="14" stroke="#3f4a54" fill="#eef1f4"/>
<text class="ttl" x="1423" y="830" fill="#3f4a54">ĐÓNG — NGOÀI PHẠM VI ⏹</text>
<text class="sb" x="1423" y="854" fill="#5f7a90">cảm biến đứng hình ≥ 3h</text>
<text class="sb" x="1423" y="876" fill="#5f7a90">hoặc Quản trị đóng ✍</text>
<path class="ln" d="M780,630 L840,630" stroke="#854f0b" stroke-width="2.4" marker-end="url(#mMEP)"/>
<circle cx="810" cy="630" r="11.5" fill="#fff" stroke="#854f0b" stroke-width="1.8"/>
<text x="810" y="634.5" font-size="13" font-weight="800" fill="#854f0b" text-anchor="middle">①</text>
<path class="ln" d="M1200,630 L1405,630" stroke="#854f0b" stroke-width="2.4" marker-end="url(#mMEP)"/>
<circle cx="1224" cy="630" r="11.5" fill="#fff" stroke="#854f0b" stroke-width="1.8"/>
<text x="1224" y="634.5" font-size="13" font-weight="800" fill="#854f0b" text-anchor="middle">①</text>
<text class="lbl" x="1246" y="622" fill="#854f0b" font-size="14">đóng — xong việc</text>
<path class="ln" d="M1090,768 L1090,858" stroke="#854f0b" stroke-width="2.4" marker-end="url(#mMEP)"/>
<circle cx="1090" cy="812" r="11.5" fill="#fff" stroke="#854f0b" stroke-width="1.8"/>
<text x="1090" y="816.5" font-size="13" font-weight="800" fill="#854f0b" text-anchor="middle">②</text>
<path class="ln" d="M1160,858 L1160,768" stroke="#854f0b" stroke-width="2.4" marker-end="url(#mMEP)"/>
<circle cx="1160" cy="812" r="11.5" fill="#fff" stroke="#854f0b" stroke-width="1.8"/>
<text x="1160" y="816.5" font-size="13" font-weight="800" fill="#854f0b" text-anchor="middle">①</text>
<path class="ln" d="M960,768 L960,832 L760,832 L760,858" stroke="#854f0b" stroke-width="2.4" marker-end="url(#mMEP)"/>
<circle cx="960" cy="796" r="11.5" fill="#fff" stroke="#854f0b" stroke-width="1.8"/>
<text x="960" y="800.5" font-size="13" font-weight="800" fill="#854f0b" text-anchor="middle">③</text>
<path class="ln" d="M560,858 L560,732" stroke="#185fa5" stroke-width="2.4" marker-end="url(#mIPC)"/>
<circle cx="560" cy="796" r="11.5" fill="#fff" stroke="#185fa5" stroke-width="1.8"/>
<text x="560" y="800.5" font-size="13" font-weight="800" fill="#185fa5" text-anchor="middle">①</text>
<path class="ln" d="M700,858 L700,820 L880,820 L880,768" stroke="#854f0b" stroke-width="2.4" marker-end="url(#mMEP)"/>
<circle cx="700" cy="840" r="11.5" fill="#fff" stroke="#854f0b" stroke-width="1.8"/>
<text x="700" y="844.5" font-size="13" font-weight="800" fill="#854f0b" text-anchor="middle">②</text>
<path class="ln" d="M115,486 L115,1074" stroke="#a32d2d" stroke-width="2"/>
<text class="lbl" x="125" y="660" fill="#a32d2d" font-size="14" font-weight="800">KHÔNG bấm gì &gt; 20′</text>
<text class="lbl" x="125" y="682" fill="#a32d2d" font-size="12.5">(đồng hồ tính từ lúc nhận mail)</text>
<path class="ln" d="M190,486 L190,1074" stroke="#a32d2d" stroke-width="2"/>
<text class="lbl" x="200" y="770" fill="#a32d2d" font-size="14">④ báo vắng rồi quá 1 GIỜ</text>
<path class="ln" d="M400,690 L400,1074" stroke="#a32d2d" stroke-width="2"/>
<text class="lbl" x="392" y="940" fill="#a32d2d" font-size="14" text-anchor="end">chưa nhận việc &gt; 15′</text>
<path class="ln" d="M1040,1018 L1040,1074" stroke="#a32d2d" stroke-width="2"/>
<text class="lbl" x="1050" y="1046" fill="#a32d2d" font-size="14">đang / chờ xử lý &gt; 1 GIỜ</text>
<path class="ln" d="M620,1054 L620,1074" stroke="#a32d2d" stroke-width="2"/>
<text class="lbl" x="632" y="1064" fill="#a32d2d" font-size="14" font-weight="800">bế tắc → NGAY + CC QA</text>
<path class="ln" d="M115,1074 L1100,1074" stroke="#a32d2d" stroke-width="2"/>
<path class="ln" d="M540,1074 L540,1096" stroke="#a32d2d" stroke-width="2" marker-end="url(#mLOT)"/>
<path class="ln" d="M730,1074 L730,1096" stroke="#a32d2d" stroke-width="2" marker-end="url(#mLOT)"/>
<path class="ln" d="M920,1074 L920,1096" stroke="#a32d2d" stroke-width="2" marker-end="url(#mLOT)"/>
<text class="lbl" x="1110" y="1079" fill="#a32d2d" font-size="13">mọi đường "KHÔNG THAO TÁC" đổ về Trực</text>
<rect class="bx" x="430" y="1098" width="620" height="180" rx="14" stroke="#a32d2d" fill="#fff"/>
<text class="ttl" x="448" y="1128" fill="#a32d2d">TRỰC HSL ĐƯỢC BÁO — tầng điều phối cuối</text>
<rect x="446" y="1142" width="200" height="30" rx="9" fill="#fcebeb"/>
<text x="457" y="1162.5" font-size="15" font-weight="700" fill="#a32d2d">① Nhắc IPC ⟳</text>
<rect x="656" y="1142" width="230" height="30" rx="9" fill="#fcebeb"/>
<text x="667" y="1162.5" font-size="15" font-weight="700" fill="#a32d2d">② Nhắc Cơ điện ⟳</text>
<rect x="446" y="1178" width="440" height="30" rx="9" fill="#fcebeb"/>
<text x="457" y="1198.5" font-size="15" font-weight="700" fill="#a32d2d">③ Tạm dừng cảnh báo 4 giờ ✍ (P1: QA·Quản trị)</text>
<text class="sb" x="448" y="1236" fill="#5f7a90">chưa ai thao tác → Trực được nhắc lại MỖI 1 GIỜ</text>
<text class="sb" x="448" y="1258" fill="#5f7a90">email tổng quan ca 6h · 14h · 22h</text>
<path class="ln" d="M430,1170 L95,1170 L95,486" stroke="#a32d2d" stroke-width="2.4" marker-end="url(#mLOT)"/>
<circle cx="260" cy="1170" r="11.5" fill="#fff" stroke="#a32d2d" stroke-width="1.8"/>
<text x="260" y="1174.5" font-size="13" font-weight="800" fill="#a32d2d" text-anchor="middle">①</text>
<path class="ln" d="M95,800 l0,-16" stroke="#a32d2d" stroke-width="2.4" marker-end="url(#mLOT)"/>
<path class="ln" d="M1050,1170 L1240,1170 L1240,700 L1200,700" stroke="#a32d2d" stroke-width="2.4" marker-end="url(#mLOT)"/>
<circle cx="1140" cy="1170" r="11.5" fill="#fff" stroke="#a32d2d" stroke-width="1.8"/>
<text x="1140" y="1174.5" font-size="13" font-weight="800" fill="#a32d2d" text-anchor="middle">②</text>
<path class="ln" d="M1240,880 l0,-16" stroke="#a32d2d" stroke-width="2.4" marker-end="url(#mLOT)"/>
<text class="lbl" x="1252" y="940" fill="#a32d2d" font-size="13">nhắc Cơ điện ⟳</text>
<rect class="bx" x="430" y="1354" width="380" height="110" rx="14" stroke="#0f6e56" fill="#fff"/>
<text class="ttl" x="448" y="1384" fill="#0f6e56">QA GÁC HỒ SƠ</text>
<rect x="446" y="1398" width="348" height="30" rx="9" fill="#e7f4ef"/>
<text x="457" y="1418.5" font-size="15" font-weight="700" fill="#0f6e56">① QA xác nhận đã khắc phục ✍ ⏹</text>
<text class="sb" x="448" y="1450" fill="#5f7a90">được CC NGAY khi Cơ điện bế tắc</text>
<rect class="bx" x="1405" y="1354" width="245" height="110" rx="14" stroke="#0f6e56" fill="#fff" stroke-dasharray="6 4"/>
<text class="ttl" x="1423" y="1384" fill="#0f6e56">MỞ LẠI ⟲ ✍</text>
<text class="sb" x="1423" y="1408" fill="#5f7a90">QA / Quản trị — vé đã đóng</text>
<path class="ln" d="M650,1354 L650,1316 L1368,1316 L1368,646 L1405,646" stroke="#0f6e56" stroke-width="2.4" marker-end="url(#mQA)"/>
<circle cx="760" cy="1316" r="11.5" fill="#fff" stroke="#0f6e56" stroke-width="1.8"/>
<text x="760" y="1320.5" font-size="13" font-weight="800" fill="#0f6e56" text-anchor="middle">①</text>
<text class="lbl" x="782" y="1308" fill="#0f6e56" font-size="14">QA đóng được từ MỌI trạng thái đang mở ✍</text>
<path class="ln" d="M1368,980 l0,-16" stroke="#0f6e56" stroke-width="2.4" marker-end="url(#mQA)"/>
<path class="ln" d="M1650,880 L1686,880 L1686,1400 L1650,1400" stroke="#3f4a54" stroke-width="2.4" stroke-dasharray="6 4" marker-end="url(#mCLOSE)"/>
<text transform="rotate(90 1699 1140)" x="1699" y="1140" font-size="12.5" font-weight="600" fill="#3f4a54" text-anchor="middle">vé đã đóng → mở lại ✍</text>
<path class="ln" d="M1520,1464 L1520,1496 L56,1496 L56,360 L70,360" stroke="#0f6e56" stroke-width="2.4" stroke-dasharray="6 4" marker-end="url(#mQA)"/>
<text class="lbl" x="620" y="1489" fill="#0f6e56" font-size="14">MỞ LẠI → vé về CHƯA XỬ LÝ: IPC tiếp nhận lại từ đầu, đồng hồ 20′ chạy lại</text>
<path class="ln" d="M840,1496 l-16,0" stroke="#0f6e56" stroke-width="2.4" marker-end="url(#mQA)"/>
<path class="ln" d="M56,800 l0,-16" stroke="#0f6e56" stroke-width="2.4" marker-end="url(#mQA)"/>
<text x="70" y="1552" font-size="18" font-weight="800" fill="#1e2a36">📧 CHI TIẾT EMAIL — BẤM NÚT NÀO, VÉ ĐI ĐÂU</text>
<text x="70" y="1576" font-size="13.5" fill="#5f7a90">nút = link dùng 1 LẦN, sống 4 GIỜ · chỉ gửi trong khung 07:45–16:45 · bấm ngay trong hộp thư, khỏi mở web</text>
<rect class="bx" x="70" y="1592" width="795" height="330" rx="14" stroke="#185fa5" fill="#fff"/>
<text class="ttl" x="90" y="1624" fill="#185fa5">Email IPC — nhắc 2 giờ/lần, TOÀN CẢNH khu · 4 nút</text>
<text class="sb" x="90" y="1646" fill="#5f7a90">nút hiện khi vé ở: Chưa xử lý · Mở lại · Không xử lý được</text>
<rect x="90" y="1662" width="280" height="34" rx="9" fill="#e6f1fb"/><text x="104" y="1685" font-size="15" font-weight="700" fill="#185fa5">① Chuyển Cơ điện xử lý</text>
<text x="384" y="1685" font-size="14" fill="#3f4a54">→ vé sang <tspan font-weight="700">ĐÃ BÁO CƠ ĐIỆN</tspan></text>
<rect x="90" y="1708" width="280" height="34" rx="9" fill="#e6f1fb"/><text x="104" y="1731" font-size="15" font-weight="700" fill="#185fa5">② Đã kiểm tra — Bình thường ✍</text>
<text x="384" y="1731" font-size="14" fill="#3f4a54">→ <tspan font-weight="700">ĐÓNG vé</tspan> (cảnh báo giả)</text>
<rect x="90" y="1754" width="280" height="34" rx="9" fill="#e6f1fb"/><text x="104" y="1777" font-size="15" font-weight="700" fill="#185fa5">③ Đã khắc phục sự cố ✍</text>
<text x="384" y="1777" font-size="14" fill="#3f4a54">→ <tspan font-weight="700">ĐÓNG vé</tspan> (IPC tự xử lý được)</text>
<rect x="90" y="1800" width="280" height="34" rx="9" fill="#e6f1fb"/><text x="104" y="1823" font-size="15" font-weight="700" fill="#185fa5">④ Không tại hiện trường ⟳</text>
<text x="384" y="1823" font-size="14" fill="#3f4a54">→ đứng yên · ân hạn <tspan font-weight="700">1 giờ</tspan> rồi lên Trực</text>
<text class="sb" x="90" y="1870" fill="#5f7a90">+ mục 2: "CƠ ĐIỆN ĐANG XỬ LÝ" — chỉ theo dõi, không nút. Vé đã sang Cơ điện → IPC còn 2 nút đóng (② ③).</text>
<text x="90" y="1894" font-size="13.5" fill="#a32d2d" font-weight="600">Nhận mail rồi im lặng &gt; 20′ → vé tự lên Trực.</text>
<rect class="bx" x="895" y="1592" width="775" height="330" rx="14" stroke="#854f0b" fill="#fff"/>
<text class="ttl" x="915" y="1624" fill="#854f0b">Email Cơ điện — theo KHU/AHU · đủ 5 nút</text>
<text class="sb" x="915" y="1646" fill="#5f7a90">2 nút bấm ngay + 3 nút 🔒 (mở SAU khi bấm "Đã nhận")</text>
<rect x="915" y="1662" width="280" height="32" rx="9" fill="#faeeda"/><text x="929" y="1684" font-size="15" font-weight="700" fill="#854f0b">① Đã nhận — đang xử lý</text>
<text x="1209" y="1684" font-size="14" fill="#3f4a54">→ sang <tspan font-weight="700">ĐANG XỬ LÝ</tspan> · đồng hồ 1 giờ</text>
<rect x="915" y="1704" width="280" height="32" rx="9" fill="#faeeda"/><text x="929" y="1726" font-size="15" font-weight="700" fill="#854f0b">② Không tại hiện trường ⟳</text>
<text x="1209" y="1726" font-size="14" fill="#3f4a54">→ ân hạn <tspan font-weight="700">1 giờ</tspan> rồi lên Trực</text>
<rect x="915" y="1746" width="280" height="32" rx="9" fill="#f1f4f6" stroke="#c8d2da" stroke-dasharray="4 3"/><text x="929" y="1768" font-size="15" font-weight="700" fill="#8a97a3">③ 🔒 Đã khắc phục ✍</text>
<text x="1209" y="1768" font-size="14" fill="#3f4a54">→ <tspan font-weight="700">ĐÓNG vé</tspan> — hết email</text>
<rect x="915" y="1788" width="280" height="32" rx="9" fill="#f1f4f6" stroke="#c8d2da" stroke-dasharray="4 3"/><text x="929" y="1810" font-size="15" font-weight="700" fill="#8a97a3">④ 🔒 Không thể xử lý ✍</text>
<text x="1209" y="1810" font-size="14" fill="#3f4a54">→ <tspan font-weight="700" fill="#a32d2d">bế tắc</tspan> — Trực + QA báo NGAY</text>
<rect x="915" y="1830" width="280" height="32" rx="9" fill="#f1f4f6" stroke="#c8d2da" stroke-dasharray="4 3"/><text x="929" y="1852" font-size="15" font-weight="700" fill="#8a97a3">⑤ 🔒 Chờ xử lý (khi rảnh)</text>
<text x="1209" y="1852" font-size="14" fill="#3f4a54">→ sang <tspan font-weight="700">CHỜ XỬ LÝ</tspan> — vẫn nhắc 2h</text>
<text class="sb" x="915" y="1894" fill="#5f7a90">🔒 bấm sớm bị từ chối đúng trình tự, KHÔNG mất lượt — "Đã nhận" xong bấm lại là chạy.</text>
<text x="70" y="1958" font-size="13.5" fill="#a32d2d" font-weight="600">Email Trực HSL: tổng quan ca 6h · 14h · 22h + vé leo thang — ① Nhắc IPC ⟳ · ② Nhắc Cơ điện ⟳ · ③ Tạm dừng 4 giờ ✍; nhắc lại mỗi 1 giờ.</text>
<text x="70" y="1982" font-size="13.5" fill="#5f7a90">Email "vé đã đóng" gửi Cơ điện khi người khác đóng vé — KHÔNG có nút (hết việc để bấm, khỏi ra hiện trường vô ích).</text>
</svg>`;

export default function SoDoVongDoi() {
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const onKey = (e) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    const cu = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = cu; };
  }, [full]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400">Sơ đồ tự co theo màn hình — bấm phóng to nếu muốn xem chữ lớn.</span>
        <button onClick={() => setFull(true)}
          className="shrink-0 rounded-xl bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200">
          ⛶ Phóng to toàn màn hình
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 1240 }} dangerouslySetInnerHTML={{ __html: SVG }} />
      </div>
      {full && (
        <div className="fixed inset-0 z-[90] overflow-auto bg-white p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <b className="text-[14px] text-slate-800">Sơ đồ vòng đời sự cố — toàn màn hình</b>
            <button onClick={() => setFull(false)}
              className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-slate-700">✕ Đóng (Esc)</button>
          </div>
          <div style={{ minWidth: 1560 }} dangerouslySetInnerHTML={{ __html: SVG }} />
        </div>
      )}
    </div>
  );
}
