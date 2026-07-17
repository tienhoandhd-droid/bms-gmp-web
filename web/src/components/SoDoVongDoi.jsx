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

const SVG = `<svg viewBox="0 0 1700 1790" style="width:100%;height:auto;display:block;font-family:Inter,'Segoe UI',system-ui,Arial,sans-serif" role="img" aria-label="Sơ đồ vòng đời sự cố chi tiết theo bộ phận">
<defs>
<marker id="mIPC" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#185fa5"/></marker>
<marker id="mMEP" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#854f0b"/></marker>
<marker id="mLOT" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#a32d2d"/></marker>
<marker id="mQA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#0f6e56"/></marker>
<marker id="mSYS" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#5b4b8a"/></marker>
<marker id="mCLOSE" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#3f4a54"/></marker>
</defs>
<style>
.ln{fill:none;stroke-width:2}
.lbl{font-size:12px;font-weight:600;paint-order:stroke;stroke:#ffffff;stroke-width:3.5px;stroke-linejoin:round}
.ttl{font-size:14px;font-weight:800}
.sb{font-size:11px;fill:#5f7a90}
.lane{font-size:12px;font-weight:800;letter-spacing:.14em}
.bx{stroke-width:2}
</style>
<rect x="46" y="40" width="1639" height="150" fill="#efeaf8" opacity=".5" rx="8"/>
<text class="lane" fill="#5b4b8a" transform="rotate(-90 28 115.0)" x="28" y="115.0" text-anchor="middle">HỆ THỐNG</text>
<rect x="46" y="196" width="1639" height="250" fill="#e6f1fb" opacity=".5" rx="8"/>
<text class="lane" fill="#185fa5" transform="rotate(-90 28 321.0)" x="28" y="321.0" text-anchor="middle">IPC</text>
<rect x="46" y="452" width="1639" height="450" fill="#faeeda" opacity=".5" rx="8"/>
<text class="lane" fill="#854f0b" transform="rotate(-90 28 677.0)" x="28" y="677.0" text-anchor="middle">CƠ ĐIỆN</text>
<rect x="46" y="908" width="1639" height="210" fill="#fcebeb" opacity=".5" rx="8"/>
<text class="lane" fill="#a32d2d" transform="rotate(-90 28 1013.0)" x="28" y="1013.0" text-anchor="middle">TRỰC HSL</text>
<rect x="46" y="1124" width="1639" height="170" fill="#e7f4ef" opacity=".5" rx="8"/>
<text class="lane" fill="#0f6e56" transform="rotate(-90 28 1209.0)" x="28" y="1209.0" text-anchor="middle">QA</text>
<rect x="1400" y="40" width="260" height="862" fill="#f8fafb" stroke="#cbd5e1" stroke-dasharray="5 4" rx="10"/>
<text x="1530" y="62" text-anchor="middle" font-size="11" font-weight="800" letter-spacing=".12em" fill="#5f7a90">KẾT THÚC — VÉ ĐÓNG</text>
<rect class="bx" x="70" y="70" width="240" height="90" rx="12" stroke="#5b4b8a" fill="#fff"/>
<text class="ttl" x="85" y="94" fill="#5b4b8a">WF1 chấm điểm mỗi giờ (:02)</text>
<text class="sb" x="85" y="114" fill="#5f7a90">lệch dải &gt; 20′ và 10′ cuối ≥ 4</text>
<text class="sb" x="85" y="130" fill="#5f7a90">→ mở vé NGHIÊM TRỌNG (P1/P2)</text>
<rect class="bx" x="350" y="70" width="280" height="90" rx="12" stroke="#5b4b8a" fill="#fff" stroke-dasharray="6 4"/>
<text class="ttl" x="365" y="94" fill="#5b4b8a">Cảm biến đứng hình ≥ 3 giờ</text>
<text class="sb" x="365" y="114" fill="#5f7a90">= thiếu dữ liệu — KHÔNG mở vé</text>
<text class="sb" x="365" y="130" fill="#5f7a90">theo dõi tab Cảm biến · WF11 07:00</text>
<rect class="bx" x="1420" y="70" width="220" height="95" rx="12" stroke="#5b4b8a" fill="#efeaf8"/>
<text class="ttl" x="1435" y="94" fill="#5b4b8a">TỰ ĐÓNG ⏹</text>
<text class="sb" x="1435" y="114" fill="#5f7a90">đủ 2 GIỜ SẠCH liên tiếp</text>
<text class="sb" x="1435" y="130" fill="#5f7a90">— áp dụng mọi vé đang mở</text>
<path class="ln" d="M700,117 L1420,117" stroke="#0f6e56" stroke-width="2" stroke-dasharray="7 5" marker-end="url(#mQA)"/>
<text class="lbl" x="710" y="105" fill="#0f6e56">KHÔNG cần bấm gì: số liệu về dải và đẹp 2 GIỜ liên tiếp → hệ TỰ ĐÓNG vé (mọi trạng thái đang mở)</text>
<path class="ln" d="M490,70 L490,48 L1676,48 L1676,720 L1640,720" stroke="#5b4b8a" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#mSYS)"/>
<text class="lbl" x="700" y="44" fill="#5b4b8a">vé đang mở của cảm biến đứng hình bị hệ ĐÓNG (ngoài phạm vi)</text>
<rect class="bx" x="70" y="226" width="310" height="192" rx="12" stroke="#185fa5" fill="#fff"/>
<text class="ttl" x="86" y="250" fill="#185fa5">CHƯA XỬ LÝ</text>
<text x="86" y="266" font-size="9.5" fill="#9aa6b1">CHUA_XU_LY · vé mới · vé MỞ LẠI</text>
<text class="sb" x="86" y="284" fill="#5f7a90">IPC kiểm tra hiện trường — 4 nút trong email:</text>
<rect x="86" y="294" width="278" height="24" rx="8" fill="#e6f1fb"/>
<text x="95" y="310.5" font-size="12" font-weight="700" fill="#185fa5">① Chuyển Cơ điện xử lý</text>
<rect x="86" y="324" width="278" height="24" rx="8" fill="#e6f1fb"/>
<text x="95" y="340.5" font-size="12" font-weight="700" fill="#185fa5">② Đã kiểm tra — Bình thường ✍ ⏹</text>
<rect x="86" y="354" width="278" height="24" rx="8" fill="#e6f1fb"/>
<text x="95" y="370.5" font-size="12" font-weight="700" fill="#185fa5">③ Đã khắc phục sự cố ✍ ⏹</text>
<rect x="86" y="384" width="278" height="24" rx="8" fill="#e6f1fb"/>
<text x="95" y="400.5" font-size="12" font-weight="700" fill="#185fa5">④ Không tại hiện trường ⟳ (ân hạn 1 giờ)</text>
<rect class="bx" x="1420" y="226" width="220" height="80" rx="12" stroke="#3f4a54" fill="#eef1f4"/>
<text class="ttl" x="1435" y="250" fill="#3f4a54">IPC — BÌNH THƯỜNG ⏹</text>
<text class="sb" x="1435" y="270" fill="#5f7a90">cảnh báo giả · ghi lý do ✍</text>
<path class="ln" d="M380,246 L1420,246" stroke="#185fa5" stroke-width="2" marker-end="url(#mIPC)"/>
<circle cx="398" cy="246" r="9.5" fill="#fff" stroke="#185fa5" stroke-width="1.6"/>
<text x="398" y="250" font-size="11" font-weight="800" fill="#185fa5" text-anchor="middle">②</text>
<text class="lbl" x="415" y="240" fill="#185fa5">đóng — cảnh báo giả</text>
<path class="ln" d="M380,270 L1390,270 L1390,610 L1420,610" stroke="#185fa5" stroke-width="2" marker-end="url(#mIPC)"/>
<circle cx="398" cy="270" r="9.5" fill="#fff" stroke="#185fa5" stroke-width="1.6"/>
<text x="398" y="274" font-size="11" font-weight="800" fill="#185fa5" text-anchor="middle">③</text>
<text class="lbl" x="415" y="288" fill="#185fa5">đóng — IPC tự xử lý được</text>
<path class="ln" d="M380,294 L520,294 L520,466" stroke="#185fa5" stroke-width="2" marker-end="url(#mIPC)"/>
<circle cx="398" cy="294" r="9.5" fill="#fff" stroke="#185fa5" stroke-width="1.6"/>
<text x="398" y="298" font-size="11" font-weight="800" fill="#185fa5" text-anchor="middle">①</text>
<text class="lbl" x="415" y="312" fill="#185fa5">đường DUY NHẤT sang Cơ điện</text>
<path class="ln" d="M900,246 l14,0" stroke="#185fa5" stroke-width="2" marker-end="url(#mIPC)"/>
<path class="ln" d="M900,270 l14,0" stroke="#185fa5" stroke-width="2" marker-end="url(#mIPC)"/>
<path class="ln" d="M1390,430 l0,14" stroke="#185fa5" stroke-width="2" marker-end="url(#mIPC)"/>
<rect class="bx" x="400" y="466" width="310" height="150" rx="12" stroke="#854f0b" fill="#fff"/>
<text class="ttl" x="416" y="490" fill="#854f0b">ĐÃ BÁO CƠ ĐIỆN</text>
<text x="416" y="506" font-size="9.5" fill="#9aa6b1">DA_BAO_CO_DIEN · chờ xác nhận nhận việc</text>
<rect x="416" y="516" width="278" height="24" rx="8" fill="#faeeda"/>
<text x="425" y="532.5" font-size="12" font-weight="700" fill="#854f0b">① Đã nhận thông tin — đang xử lý</text>
<rect x="416" y="546" width="278" height="24" rx="8" fill="#faeeda"/>
<text x="425" y="562.5" font-size="12" font-weight="700" fill="#854f0b">② Không tại hiện trường ⟳ (ân hạn 1 giờ)</text>
<text class="sb" x="416" y="600" fill="#5f7a90">email nhắc 2 giờ/lần (07:45–16:45)</text>
<rect class="bx" x="790" y="466" width="330" height="180" rx="12" stroke="#854f0b" fill="#fff"/>
<text class="ttl" x="806" y="490" fill="#854f0b">CƠ ĐIỆN ĐANG XỬ LÝ</text>
<text x="806" y="506" font-size="9.5" fill="#9aa6b1">CO_DIEN_DANG_XU_LY · kiểm tra AHU, khắc phục</text>
<rect x="806" y="516" width="298" height="24" rx="8" fill="#faeeda"/>
<text x="815" y="532.5" font-size="12" font-weight="700" fill="#854f0b">① Đã khắc phục ✍ ⏹</text>
<rect x="806" y="546" width="298" height="24" rx="8" fill="#faeeda"/>
<text x="815" y="562.5" font-size="12" font-weight="700" fill="#854f0b">② Chờ xử lý (khi rảnh)</text>
<rect x="806" y="576" width="298" height="24" rx="8" fill="#faeeda"/>
<text x="815" y="592.5" font-size="12" font-weight="700" fill="#854f0b">③ Không thể xử lý ✍</text>
<text class="sb" x="806" y="630" fill="#5f7a90">email nhắc 2 giờ/lần · nút 🔒 trong mail mở sau "Đã nhận"</text>
<rect class="bx" x="790" y="706" width="330" height="130" rx="12" stroke="#854f0b" fill="#fff" stroke-dasharray="6 4"/>
<text class="ttl" x="806" y="730" fill="#854f0b">CHỜ XỬ LÝ (khi rảnh)</text>
<text x="806" y="746" font-size="9.5" fill="#9aa6b1">CO_DIEN_CHO_XU_LY · chờ vật tư — vé VẪN MỞ, vẫn nhắc</text>
<rect x="806" y="756" width="298" height="24" rx="8" fill="#faeeda"/>
<text x="815" y="772.5" font-size="12" font-weight="700" fill="#854f0b">① Đã nhận — xử lý tiếp</text>
<rect x="806" y="786" width="298" height="24" rx="8" fill="#faeeda"/>
<text x="815" y="802.5" font-size="12" font-weight="700" fill="#854f0b">② Không tại hiện trường ⟳ (ân hạn 1 giờ)</text>
<rect class="bx" x="400" y="706" width="310" height="150" rx="12" stroke="#a32d2d" fill="#fff"/>
<text class="ttl" x="416" y="730" fill="#a32d2d">KHÔNG XỬ LÝ ĐƯỢC</text>
<text x="416" y="746" font-size="9.5" fill="#9aa6b1">CO_DIEN_KHONG_XU_LY_DUOC · bế tắc ✍</text>
<rect x="416" y="756" width="278" height="24" rx="8" fill="#e6f1fb"/>
<text x="425" y="772.5" font-size="12" font-weight="700" fill="#185fa5">① IPC: Chuyển Cơ điện (giao lại)</text>
<rect x="416" y="786" width="278" height="24" rx="8" fill="#faeeda"/>
<text x="425" y="802.5" font-size="12" font-weight="700" fill="#854f0b">② Đã có vật tư — xử lý tiếp</text>
<rect x="416" y="816" width="278" height="24" rx="8" fill="#e6f1fb"/>
<text x="425" y="832.5" font-size="12" font-weight="700" fill="#185fa5">③ IPC: Không tại hiện trường ⟳</text>
<rect class="bx" x="1420" y="560" width="220" height="95" rx="12" stroke="#0f6e56" fill="#e7f4ef"/>
<text class="ttl" x="1435" y="584" fill="#0f6e56">ĐÃ KHẮC PHỤC ⏹</text>
<text class="sb" x="1435" y="604" fill="#5f7a90">sự cố thật, đã sửa xong</text>
<text class="sb" x="1435" y="620" fill="#5f7a90">Cơ điện · IPC · QA · Quản trị ✍</text>
<rect class="bx" x="1420" y="700" width="220" height="90" rx="12" stroke="#3f4a54" fill="#eef1f4"/>
<text class="ttl" x="1435" y="724" fill="#3f4a54">ĐÓNG — NGOÀI PHẠM VI ⏹</text>
<text class="sb" x="1435" y="744" fill="#5f7a90">cảm biến đứng hình ≥ 3h</text>
<text class="sb" x="1435" y="760" fill="#5f7a90">hoặc Quản trị đóng ✍</text>
<path class="ln" d="M710,528 L790,528" stroke="#854f0b" stroke-width="2" marker-end="url(#mMEP)"/>
<circle cx="750" cy="528" r="9.5" fill="#fff" stroke="#854f0b" stroke-width="1.6"/>
<text x="750" y="532" font-size="11" font-weight="800" fill="#854f0b" text-anchor="middle">①</text>
<path class="ln" d="M1120,528 L1360,528 L1360,585 L1420,585" stroke="#854f0b" stroke-width="2" marker-end="url(#mMEP)"/>
<circle cx="1140" cy="528" r="9.5" fill="#fff" stroke="#854f0b" stroke-width="1.6"/>
<text x="1140" y="532" font-size="11" font-weight="800" fill="#854f0b" text-anchor="middle">①</text>
<text class="lbl" x="1158" y="522" fill="#854f0b">đóng — xong việc</text>
<path class="ln" d="M955,646 L955,706" stroke="#854f0b" stroke-width="2" marker-end="url(#mMEP)"/>
<circle cx="955" cy="676" r="9.5" fill="#fff" stroke="#854f0b" stroke-width="1.6"/>
<text x="955" y="680" font-size="11" font-weight="800" fill="#854f0b" text-anchor="middle">②</text>
<path class="ln" d="M890,706 L890,646" stroke="#854f0b" stroke-width="2" marker-end="url(#mMEP)"/>
<circle cx="890" cy="676" r="9.5" fill="#fff" stroke="#854f0b" stroke-width="1.6"/>
<text x="890" y="680" font-size="11" font-weight="800" fill="#854f0b" text-anchor="middle">①</text>
<path class="ln" d="M840,646 L840,690 L680,690 L680,706" stroke="#854f0b" stroke-width="2" marker-end="url(#mMEP)"/>
<circle cx="840" cy="668" r="9.5" fill="#fff" stroke="#854f0b" stroke-width="1.6"/>
<text x="840" y="672" font-size="11" font-weight="800" fill="#854f0b" text-anchor="middle">③</text>
<path class="ln" d="M520,706 L520,616" stroke="#185fa5" stroke-width="2" marker-end="url(#mIPC)"/>
<circle cx="520" cy="668" r="9.5" fill="#fff" stroke="#185fa5" stroke-width="1.6"/>
<text x="520" y="672" font-size="11" font-weight="800" fill="#185fa5" text-anchor="middle">①</text>
<path class="ln" d="M660,706 L660,676 L770,676 L770,646" stroke="#854f0b" stroke-width="2" marker-end="url(#mMEP)"/>
<circle cx="700" cy="676" r="9.5" fill="#fff" stroke="#854f0b" stroke-width="1.6"/>
<text x="700" y="680" font-size="11" font-weight="800" fill="#854f0b" text-anchor="middle">②</text>
<path class="ln" d="M110,418 L110,918" stroke="#a32d2d" stroke-width="1.7"/>
<text class="lbl" x="118" y="560" fill="#a32d2d" font-weight="800">KHÔNG bấm gì &gt; 20′</text>
<text class="lbl" x="118" y="576" fill="#a32d2d">(đồng hồ tính từ lúc nhận mail)</text>
<path class="ln" d="M180,418 L180,918" stroke="#a32d2d" stroke-width="1.7"/>
<text class="lbl" x="188" y="650" fill="#a32d2d">④ báo vắng rồi quá 1 GIỜ</text>
<path class="ln" d="M370,560 L370,918" stroke="#a32d2d" stroke-width="1.7"/>
<text class="lbl" x="362" y="800" fill="#a32d2d" text-anchor="end">chưa nhận việc &gt; 15′</text>
<path class="ln" d="M955,836 L955,918" stroke="#a32d2d" stroke-width="1.7"/>
<text class="lbl" x="963" y="880" fill="#a32d2d">đang / chờ xử lý &gt; 1 GIỜ</text>
<path class="ln" d="M555,856 L555,918" stroke="#a32d2d" stroke-width="1.7"/>
<text class="lbl" x="563" y="890" fill="#a32d2d" font-weight="800">bế tắc → NGAY + CC QA</text>
<path class="ln" d="M110,918 L1000,918" stroke="#a32d2d" stroke-width="1.7"/>
<path class="ln" d="M500,918 L500,938" stroke="#a32d2d" stroke-width="1.7" marker-end="url(#mLOT)"/>
<path class="ln" d="M700,918 L700,938" stroke="#a32d2d" stroke-width="1.7" marker-end="url(#mLOT)"/>
<path class="ln" d="M900,918 L900,938" stroke="#a32d2d" stroke-width="1.7" marker-end="url(#mLOT)"/>
<text class="lbl" x="1010" y="922" fill="#a32d2d">mọi đường "KHÔNG THAO TÁC" đổ về Trực</text>
<rect class="bx" x="400" y="940" width="560" height="150" rx="12" stroke="#a32d2d" fill="#fff"/>
<text class="ttl" x="416" y="964" fill="#a32d2d">TRỰC HSL ĐƯỢC BÁO — tầng điều phối cuối</text>
<rect x="416" y="976" width="170" height="24" rx="8" fill="#fcebeb"/>
<text x="425" y="992.5" font-size="12" font-weight="700" fill="#a32d2d">① Nhắc IPC ⟳</text>
<rect x="596" y="976" width="180" height="24" rx="8" fill="#fcebeb"/>
<text x="605" y="992.5" font-size="12" font-weight="700" fill="#a32d2d">② Nhắc Cơ điện ⟳</text>
<rect x="416" y="1006" width="360" height="24" rx="8" fill="#fcebeb"/>
<text x="425" y="1022.5" font-size="12" font-weight="700" fill="#a32d2d">③ Tạm dừng cảnh báo 4 giờ ✍ ⟳ (P1/CRITICAL: QA·Quản trị)</text>
<text class="sb" x="416" y="1054" fill="#5f7a90">chưa ai thao tác → Trực được nhắc lại MỖI 1 GIỜ</text>
<text class="sb" x="416" y="1070" fill="#5f7a90">email tổng quan ca 6h · 14h · 22h</text>
<path class="ln" d="M400,1000 L90,1000 L90,418" stroke="#a32d2d" stroke-width="2" marker-end="url(#mLOT)"/>
<circle cx="240" cy="1000" r="9.5" fill="#fff" stroke="#a32d2d" stroke-width="1.6"/>
<text x="240" y="1004" font-size="11" font-weight="800" fill="#a32d2d" text-anchor="middle">①</text>
<path class="ln" d="M90,700 l0,-14" stroke="#a32d2d" stroke-width="2" marker-end="url(#mLOT)"/>
<path class="ln" d="M960,1000 L1160,1000 L1160,600 L1120,600" stroke="#a32d2d" stroke-width="2" marker-end="url(#mLOT)"/>
<circle cx="1060" cy="1000" r="9.5" fill="#fff" stroke="#a32d2d" stroke-width="1.6"/>
<text x="1060" y="1004" font-size="11" font-weight="800" fill="#a32d2d" text-anchor="middle">②</text>
<path class="ln" d="M1160,760 l0,-14" stroke="#a32d2d" stroke-width="2" marker-end="url(#mLOT)"/>
<text class="lbl" x="1168" y="880" fill="#a32d2d">nhắc Cơ điện ⟳</text>
<rect class="bx" x="400" y="1154" width="340" height="95" rx="12" stroke="#0f6e56" fill="#fff"/>
<text class="ttl" x="416" y="1178" fill="#0f6e56">QA GÁC HỒ SƠ</text>
<rect x="416" y="1190" width="308" height="24" rx="8" fill="#e7f4ef"/>
<text x="425" y="1206.5" font-size="12" font-weight="700" fill="#0f6e56">① QA xác nhận đã khắc phục ✍ ⏹</text>
<text class="sb" x="416" y="1238" fill="#5f7a90">được CC NGAY khi Cơ điện bế tắc</text>
<rect class="bx" x="1420" y="1154" width="220" height="95" rx="12" stroke="#0f6e56" fill="#fff" stroke-dasharray="6 4"/>
<text class="ttl" x="1435" y="1178" fill="#0f6e56">MỞ LẠI ⟲ ✍</text>
<text class="sb" x="1435" y="1198" fill="#5f7a90">QA / Quản trị — vé đã đóng</text>
<path class="ln" d="M600,1154 L600,1136 L1370,1136 L1370,635 L1420,635" stroke="#0f6e56" stroke-width="2" marker-end="url(#mQA)"/>
<circle cx="700" cy="1136" r="9.5" fill="#fff" stroke="#0f6e56" stroke-width="1.6"/>
<text x="700" y="1140" font-size="11" font-weight="800" fill="#0f6e56" text-anchor="middle">①</text>
<text class="lbl" x="720" y="1130" fill="#0f6e56">QA đóng được từ MỌI trạng thái đang mở ✍</text>
<path class="ln" d="M1370,900 l0,-14" stroke="#0f6e56" stroke-width="2" marker-end="url(#mQA)"/>
<path class="ln" d="M1640,745 L1668,745 L1668,1190 L1640,1190" stroke="#3f4a54" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#mCLOSE)"/>
<text transform="rotate(90 1680 950)" x="1680" y="950" font-size="11" font-weight="600" fill="#3f4a54" text-anchor="middle">vé đã đóng → mở lại ✍</text>
<path class="ln" d="M1530,1249 L1530,1274 L52,1274 L52,300 L70,300" stroke="#0f6e56" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#mQA)"/>
<text class="lbl" x="600" y="1268" fill="#0f6e56">MỞ LẠI → vé về CHƯA XỬ LÝ: IPC tiếp nhận lại từ đầu, đồng hồ 20′ chạy lại</text>
<path class="ln" d="M800,1274 l-14,0" stroke="#0f6e56" stroke-width="2" marker-end="url(#mQA)"/>
<path class="ln" d="M52,700 l0,-14" stroke="#0f6e56" stroke-width="2" marker-end="url(#mQA)"/>
<path class="ln" d="M185,160 L185,226" stroke="#5b4b8a" stroke-width="2" marker-end="url(#mSYS)"/>
<text class="lbl" x="195" y="196" fill="#5b4b8a">mở vé · email đi ≤ 5′</text>
<text x="70" y="1320" font-size="15" font-weight="800" fill="#1e2a36">📧 CHI TIẾT EMAIL — BẤM NÚT NÀO, VÉ ĐI ĐÂU</text>
<text x="500" y="1320" font-size="11.5" fill="#5f7a90">(nút = link dùng 1 LẦN, sống 4 GIỜ · chỉ gửi trong khung 07:45–16:45 · bấm ngay trong hộp thư, khỏi mở web)</text>
<rect class="bx" x="70" y="1334" width="760" height="300" rx="12" stroke="#185fa5" fill="#fff"/>
<text class="ttl" x="88" y="1360" fill="#185fa5">Email IPC — nhắc 2 giờ/lần, TOÀN CẢNH khu · 4 nút</text>
<text class="sb" x="88" y="1378" fill="#5f7a90">nút hiện khi vé ở: Chưa xử lý · Mở lại · Không xử lý được</text>
<rect x="88" y="1392" width="230" height="30" rx="8" fill="#e6f1fb"/><text x="100" y="1412" font-size="12.5" font-weight="700" fill="#185fa5">① Chuyển Cơ điện xử lý</text>
<text x="330" y="1412" font-size="12" fill="#3f4a54">→ vé sang <tspan font-weight="700">ĐÃ BÁO CƠ ĐIỆN</tspan> — đường duy nhất sang tay</text>
<rect x="88" y="1436" width="230" height="30" rx="8" fill="#e6f1fb"/><text x="100" y="1456" font-size="12.5" font-weight="700" fill="#185fa5">② Đã kiểm tra — Bình thường ✍</text>
<text x="330" y="1456" font-size="12" fill="#3f4a54">→ <tspan font-weight="700">ĐÓNG vé</tspan> (cảnh báo giả — IPC đã ra tận nơi)</text>
<rect x="88" y="1480" width="230" height="30" rx="8" fill="#e6f1fb"/><text x="100" y="1500" font-size="12.5" font-weight="700" fill="#185fa5">③ Đã khắc phục sự cố ✍</text>
<text x="330" y="1500" font-size="12" fill="#3f4a54">→ <tspan font-weight="700">ĐÓNG vé</tspan> (IPC tự xử lý được tại chỗ)</text>
<rect x="88" y="1524" width="230" height="30" rx="8" fill="#e6f1fb"/><text x="100" y="1544" font-size="12.5" font-weight="700" fill="#185fa5">④ Không tại hiện trường ⟳</text>
<text x="330" y="1544" font-size="12" fill="#3f4a54">→ vé đứng yên · ân hạn <tspan font-weight="700">1 giờ</tspan>, quá thì lên Trực</text>
<text class="sb" x="88" y="1582" fill="#5f7a90">+ mục 2 trong mail: "CƠ ĐIỆN ĐANG XỬ LÝ" — chỉ theo dõi, không nút, kèm đồng hồ Cơ điện.</text>
<text class="sb" x="88" y="1600" fill="#5f7a90">Vé đã sang Cơ điện → IPC còn 2 nút đóng (② và ③ — luật "mọi trạng thái"), không phải mất nút.</text>
<text x="88" y="1618" font-size="11" fill="#a32d2d">Nhận mail rồi im lặng &gt; 20′ → vé tự lên Trực.</text>
<rect class="bx" x="870" y="1334" width="790" height="300" rx="12" stroke="#854f0b" fill="#fff"/>
<text class="ttl" x="888" y="1360" fill="#854f0b">Email Cơ điện — theo KHU/AHU · đủ 5 nút ngay từ mail đầu</text>
<text class="sb" x="888" y="1378" fill="#5f7a90">2 nút bấm được ngay + 3 nút 🔒 (mở khóa SAU khi bấm "Đã nhận")</text>
<rect x="888" y="1392" width="240" height="30" rx="8" fill="#faeeda"/><text x="900" y="1412" font-size="12.5" font-weight="700" fill="#854f0b">① Đã nhận — đang xử lý</text>
<text x="1140" y="1412" font-size="12" fill="#3f4a54">→ vé sang <tspan font-weight="700">ĐANG XỬ LÝ</tspan> · đồng hồ im lặng 1 giờ</text>
<rect x="888" y="1432" width="240" height="30" rx="8" fill="#faeeda"/><text x="900" y="1452" font-size="12.5" font-weight="700" fill="#854f0b">② Không tại hiện trường ⟳</text>
<text x="1140" y="1452" font-size="12" fill="#3f4a54">→ vé đứng yên · ân hạn <tspan font-weight="700">1 giờ</tspan>, quá thì lên Trực</text>
<rect x="888" y="1472" width="240" height="30" rx="8" fill="#f1f4f6" stroke="#c8d2da" stroke-dasharray="4 3"/><text x="900" y="1492" font-size="12.5" font-weight="700" fill="#8a97a3">③ 🔒 Đã khắc phục ✍</text>
<text x="1140" y="1492" font-size="12" fill="#3f4a54">→ <tspan font-weight="700">ĐÓNG vé</tspan> — xong việc, hết email</text>
<rect x="888" y="1512" width="240" height="30" rx="8" fill="#f1f4f6" stroke="#c8d2da" stroke-dasharray="4 3"/><text x="900" y="1532" font-size="12.5" font-weight="700" fill="#8a97a3">④ 🔒 Không thể xử lý ✍</text>
<text x="1140" y="1532" font-size="12" fill="#3f4a54">→ <tspan font-weight="700" fill="#a32d2d">bế tắc</tspan> — Trực + QA được báo NGAY</text>
<rect x="888" y="1552" width="240" height="30" rx="8" fill="#f1f4f6" stroke="#c8d2da" stroke-dasharray="4 3"/><text x="900" y="1572" font-size="12.5" font-weight="700" fill="#8a97a3">⑤ 🔒 Chờ xử lý (khi rảnh)</text>
<text x="1140" y="1572" font-size="12" fill="#3f4a54">→ vé sang <tspan font-weight="700">CHỜ XỬ LÝ</tspan> — vẫn nhắc 2h, đồng hồ 1 giờ</text>
<text class="sb" x="888" y="1618" fill="#5f7a90">🔒 bấm sớm bị máy chủ từ chối đúng trình tự, KHÔNG mất lượt — bấm lại sau khi "Đã nhận" là chạy.</text>
<text x="70" y="1672" font-size="11.5" fill="#a32d2d" font-weight="600">Email Trực HSL: tổng quan ca 6h · 14h · 22h + vé leo thang — nút ① Nhắc IPC ⟳ · ② Nhắc Cơ điện ⟳ · ③ Tạm dừng cảnh báo 4 giờ ✍; nhắc lại mỗi 1 giờ tới khi có người thao tác.</text>
<text x="70" y="1692" font-size="11.5" fill="#5f7a90">Email "vé đã đóng" gửi cho Cơ điện đang xử lý khi người khác đóng vé — KHÔNG có nút (hết việc để bấm, khỏi ra hiện trường vô ích).</text>
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
