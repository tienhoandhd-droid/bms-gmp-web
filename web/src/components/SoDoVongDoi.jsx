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
<marker id="mIPC" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0.5,0.8 L9,5 L0.5,9.2 z" fill="#2a78d6"/></marker>
<marker id="mMEP" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0.5,0.8 L9,5 L0.5,9.2 z" fill="#c98500"/></marker>
<marker id="mLOT" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0.5,0.8 L9,5 L0.5,9.2 z" fill="#e34948"/></marker>
<marker id="mQA" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0.5,0.8 L9,5 L0.5,9.2 z" fill="#008300"/></marker>
<marker id="mSYS" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0.5,0.8 L9,5 L0.5,9.2 z" fill="#4a3aa7"/></marker>
<marker id="mCLOSE" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0.5,0.8 L9,5 L0.5,9.2 z" fill="#5b6774"/></marker>
<filter id="sh" x="-8%" y="-8%" width="116%" height="120%"><feDropShadow dx="0" dy="1.5" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.07"/></filter>
</defs>
<rect x="0" y="0" width="1710" height="2010" fill="#fcfcfb"/>
<rect x="50" y="40" width="1645" height="170" fill="#4a3aa7" opacity=".055" rx="10"/>
<rect x="50" y="48" width="4" height="154" rx="2" fill="#4a3aa7" opacity=".85"/>
<text font-size="13.5" font-weight="800" letter-spacing=".16em" fill="#4a3aa7" transform="rotate(-90 32 125.0)" x="32" y="125.0" text-anchor="middle">HỆ THỐNG</text>
<rect x="50" y="216" width="1645" height="300" fill="#2a78d6" opacity=".055" rx="10"/>
<rect x="50" y="224" width="4" height="284" rx="2" fill="#2a78d6" opacity=".85"/>
<text font-size="13.5" font-weight="800" letter-spacing=".16em" fill="#2a78d6" transform="rotate(-90 32 366.0)" x="32" y="366.0" text-anchor="middle">IPC</text>
<rect x="50" y="522" width="1645" height="540" fill="#c98500" opacity=".055" rx="10"/>
<rect x="50" y="530" width="4" height="524" rx="2" fill="#c98500" opacity=".85"/>
<text font-size="13.5" font-weight="800" letter-spacing=".16em" fill="#c98500" transform="rotate(-90 32 792.0)" x="32" y="792.0" text-anchor="middle">CƠ ĐIỆN</text>
<rect x="50" y="1068" width="1645" height="250" fill="#e34948" opacity=".055" rx="10"/>
<rect x="50" y="1076" width="4" height="234" rx="2" fill="#e34948" opacity=".85"/>
<text font-size="13.5" font-weight="800" letter-spacing=".16em" fill="#e34948" transform="rotate(-90 32 1193.0)" x="32" y="1193.0" text-anchor="middle">TRỰC HSL</text>
<rect x="50" y="1324" width="1645" height="200" fill="#008300" opacity=".055" rx="10"/>
<rect x="50" y="1332" width="4" height="184" rx="2" fill="#008300" opacity=".85"/>
<text font-size="13.5" font-weight="800" letter-spacing=".16em" fill="#008300" transform="rotate(-90 32 1424.0)" x="32" y="1424.0" text-anchor="middle">QA</text>
<rect x="1385" y="40" width="285" height="1024" fill="#f7f9fa" stroke="#e2e7ec" stroke-width="1.4" rx="12"/>
<text x="1527" y="66" text-anchor="middle" font-size="12.5" font-weight="800" letter-spacing=".14em" fill="#98a3ad">KẾT THÚC — VÉ ĐÓNG</text>
<rect x="70" y="78" width="290" height="100" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="70" y="90" width="5" height="76" rx="2.5" fill="#4a3aa7"/>
<text x="90" y="108" font-size="17" font-weight="800" fill="#1f2b38">WF1 chấm điểm mỗi giờ (:02)</text>
<text x="90" y="134" font-size="13" fill="#5b6774">lệch dải &gt; 20′ và 10′ cuối ≥ 4</text>
<text x="90" y="156" font-size="13" fill="#5b6774">→ mở vé NGHIÊM TRỌNG (P1/P2)</text>
<rect x="400" y="78" width="330" height="100" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="400" y="90" width="5" height="76" rx="2.5" fill="#4a3aa7"/>
<text x="420" y="108" font-size="17" font-weight="800" fill="#1f2b38">Cảm biến đứng hình ≥ 3 giờ</text>
<text x="420" y="134" font-size="13" fill="#5b6774">= thiếu dữ liệu — KHÔNG mở vé</text>
<text x="420" y="156" font-size="13" fill="#5b6774">theo dõi tab Cảm biến · WF11 07:00</text>
<rect x="1405" y="78" width="245" height="100" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="1405" y="90" width="5" height="76" rx="2.5" fill="#4a3aa7"/>
<text x="1425" y="108" font-size="17" font-weight="800" fill="#1f2b38">TỰ ĐÓNG ⏹</text>
<text x="1425" y="134" font-size="13" fill="#5b6774">đủ 2 GIỜ SẠCH liên tiếp</text>
<text x="1425" y="156" font-size="13" fill="#5b6774">— áp dụng mọi vé đang mở</text>
<circle cx="760" cy="145" r="5" fill="#008300"/>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M760,145 L1405,145" stroke="#008300" stroke-width="2.3" stroke-dasharray="7 5" marker-end="url(#mQA)"/>
<text x="770" y="131" font-size="13.5" fill="#0c6b4d" font-weight="600" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">KHÔNG cần bấm gì: số liệu đẹp 2 GIỜ liên tiếp → TỰ ĐÓNG (mọi vé đang mở)</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M560,78 L560,30 L1676,30 L1676,850 L1650,850" stroke="#4a3aa7" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#mSYS)"/>
<text x="750" y="25" font-size="13" fill="#98a3ad" font-weight="600" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">vé đang mở của cảm biến đứng hình bị hệ ĐÓNG (ngoài phạm vi)</text>
<rect x="70" y="246" width="340" height="240" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="70" y="258" width="5" height="216" rx="2.5" fill="#2a78d6"/>
<text x="90" y="276" font-size="17" font-weight="800" fill="#1f2b38">CHƯA XỬ LÝ</text>
<text x="232" y="276" font-size="10.5" letter-spacing=".04em" fill="#98a3ad">CHUA_XU_LY</text>
<text x="90" y="300" font-size="13" fill="#5b6774">vé mới · vé MỞ LẠI — IPC ra hiện trường, 4 nút:</text>
<rect x="88" y="314" width="306" height="30" rx="9" fill="#2a78d6" filter="url(#sh)"/>
<text x="99" y="334.5" font-size="14.5" font-weight="800" fill="#ffffff">① Chuyển Cơ điện xử lý</text>
<rect x="88" y="350" width="306" height="30" rx="9" fill="#e9f1fb"/>
<text x="99" y="370.5" font-size="14.5" font-weight="700" fill="#1f5fa8">② Đã kiểm tra — Bình thường ✍ ⏹</text>
<rect x="88" y="386" width="306" height="30" rx="9" fill="#e9f1fb"/>
<text x="99" y="406.5" font-size="14.5" font-weight="700" fill="#1f5fa8">③ Đã khắc phục sự cố ✍ ⏹</text>
<rect x="88" y="422" width="306" height="30" rx="9" fill="#e9f1fb"/>
<text x="99" y="442.5" font-size="14.5" font-weight="700" fill="#1f5fa8">④ Không tại hiện trường ⟳ (ân hạn 1 giờ)</text>
<rect x="1405" y="246" width="245" height="95" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="1405" y="258" width="5" height="71" rx="2.5" fill="#5b6774"/>
<text x="1425" y="276" font-size="17" font-weight="800" fill="#1f2b38">IPC — BÌNH THƯỜNG ⏹</text>
<text x="1425" y="300" font-size="13" fill="#5b6774">cảnh báo giả · ghi lý do ✍</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M410,268 L1405,268" stroke="#2a78d6" stroke-width="2.2" marker-end="url(#mIPC)"/>
<circle cx="432" cy="268" r="14" fill="#fff" stroke="#2a78d6" stroke-width="2.4"/>
<text x="432" y="274" font-size="17" font-weight="800" fill="#2a78d6" text-anchor="middle">2</text>
<text x="452" y="257" font-size="13.5" fill="#5b6774" font-weight="600" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">đóng — cảnh báo giả</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M410,300 L1352,300 L1352,578 L1405,578" stroke="#2a78d6" stroke-width="2.2" marker-end="url(#mIPC)"/>
<circle cx="432" cy="300" r="14" fill="#fff" stroke="#2a78d6" stroke-width="2.4"/>
<text x="432" y="306" font-size="17" font-weight="800" fill="#2a78d6" text-anchor="middle">3</text>
<text x="452" y="322" font-size="13.5" fill="#5b6774" font-weight="600" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">đóng — IPC tự xử lý được</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M410,332 L560,332 L560,552" stroke="#2a78d6" stroke-width="3.6" marker-end="url(#mIPC)"/>
<circle cx="432" cy="332" r="14" fill="#fff" stroke="#2a78d6" stroke-width="2.4"/>
<text x="432" y="338" font-size="17" font-weight="800" fill="#2a78d6" text-anchor="middle">1</text>
<text x="452" y="354" font-size="13.5" fill="#5b6774" font-weight="800" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">đường DUY NHẤT sang Cơ điện</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M950,268 l16,0" stroke="#2a78d6" stroke-width="2.2" marker-end="url(#mIPC)"/>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M950,300 l16,0" stroke="#2a78d6" stroke-width="2.2" marker-end="url(#mIPC)"/>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M1352,450 l0,16" stroke="#2a78d6" stroke-width="2.2" marker-end="url(#mIPC)"/>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M185,178 L185,246" stroke="#4a3aa7" stroke-width="3.2" marker-end="url(#mSYS)"/>
<text x="197" y="218" font-size="13.5" fill="#5b6774" font-weight="600" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">mở vé · email đi ≤ 5′</text>
<rect x="430" y="552" width="350" height="180" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="430" y="564" width="5" height="156" rx="2.5" fill="#c98500"/>
<text x="450" y="582" font-size="17" font-weight="800" fill="#1f2b38">ĐÃ BÁO CƠ ĐIỆN</text>
<text x="450" y="602" font-size="10.5" letter-spacing=".04em" fill="#98a3ad">DA_BAO_CO_DIEN · chờ nhận việc</text>
<rect x="448" y="616" width="316" height="30" rx="9" fill="#8a5e00" filter="url(#sh)"/>
<text x="459" y="636.5" font-size="14.5" font-weight="800" fill="#ffffff">① Đã nhận thông tin — đang xử lý</text>
<rect x="448" y="652" width="316" height="30" rx="9" fill="#faf0dc"/>
<text x="459" y="672.5" font-size="14.5" font-weight="700" fill="#7a5200">② Không tại hiện trường ⟳ (1 giờ)</text>
<text x="450" y="710" font-size="13" fill="#5b6774">email nhắc 2 giờ/lần (07:45–16:45)</text>
<rect x="840" y="552" width="360" height="216" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="840" y="564" width="5" height="192" rx="2.5" fill="#c98500"/>
<text x="860" y="582" font-size="17" font-weight="800" fill="#1f2b38">CƠ ĐIỆN ĐANG XỬ LÝ</text>
<text x="860" y="602" font-size="10.5" letter-spacing=".04em" fill="#98a3ad">CO_DIEN_DANG_XU_LY · sửa AHU</text>
<rect x="858" y="616" width="326" height="30" rx="9" fill="#faf0dc"/>
<text x="869" y="636.5" font-size="14.5" font-weight="700" fill="#7a5200">① Đã khắc phục ✍ ⏹</text>
<rect x="858" y="652" width="326" height="30" rx="9" fill="#faf0dc"/>
<text x="869" y="672.5" font-size="14.5" font-weight="700" fill="#7a5200">② Chờ xử lý (khi rảnh)</text>
<rect x="858" y="688" width="326" height="30" rx="9" fill="#faf0dc"/>
<text x="869" y="708.5" font-size="14.5" font-weight="700" fill="#7a5200">③ Không thể xử lý ✍</text>
<text x="860" y="746" font-size="13" fill="#5b6774">nút 🔒 trong mail mở sau "Đã nhận"</text>
<rect x="840" y="858" width="360" height="160" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="840" y="870" width="5" height="136" rx="2.5" fill="#c98500"/>
<text x="860" y="888" font-size="17" font-weight="800" fill="#1f2b38">CHỜ XỬ LÝ (khi rảnh)</text>
<text x="860" y="908" font-size="10.5" letter-spacing=".04em" fill="#98a3ad">CO_DIEN_CHO_XU_LY · vé VẪN MỞ, vẫn nhắc</text>
<rect x="858" y="922" width="326" height="30" rx="9" fill="#faf0dc"/>
<text x="869" y="942.5" font-size="14.5" font-weight="700" fill="#7a5200">① Đã nhận — xử lý tiếp</text>
<rect x="858" y="958" width="326" height="30" rx="9" fill="#faf0dc"/>
<text x="869" y="978.5" font-size="14.5" font-weight="700" fill="#7a5200">② Không tại hiện trường ⟳ (1 giờ)</text>
<rect x="430" y="858" width="350" height="160" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="430" y="870" width="5" height="136" rx="2.5" fill="#e34948"/>
<text x="450" y="888" font-size="17" font-weight="800" fill="#b3312f">KHÔNG XỬ LÝ ĐƯỢC</text>
<text x="450" y="908" font-size="10.5" letter-spacing=".04em" fill="#98a3ad">CO_DIEN_KHONG_XU_LY_DUOC · bế tắc ✍ · Trực + QA đã được báo</text>
<rect x="448" y="922" width="316" height="30" rx="9" fill="#faf0dc"/>
<text x="459" y="942.5" font-size="14.5" font-weight="700" fill="#7a5200">① Đã có vật tư — xử lý tiếp</text>
<rect x="448" y="958" width="316" height="30" rx="9" fill="#e9f1fb"/>
<text x="459" y="978.5" font-size="14.5" font-weight="700" fill="#1f5fa8">② IPC: Không tại hiện trường ⟳</text>
<rect x="1405" y="548" width="245" height="120" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="1405" y="560" width="5" height="96" rx="2.5" fill="#008300"/>
<text x="1425" y="578" font-size="17" font-weight="800" fill="#0c6b4d">ĐÃ KHẮC PHỤC ⏹</text>
<text x="1425" y="602" font-size="13" fill="#5b6774">sự cố thật, đã sửa xong</text>
<text x="1425" y="624" font-size="13" fill="#5b6774">Cơ điện · IPC · QA · Quản trị ✍</text>
<rect x="1405" y="800" width="245" height="110" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="1405" y="812" width="5" height="86" rx="2.5" fill="#5b6774"/>
<text x="1425" y="830" font-size="17" font-weight="800" fill="#1f2b38">ĐÓNG — NGOÀI PHẠM VI ⏹</text>
<text x="1425" y="854" font-size="13" fill="#5b6774">cảm biến đứng hình ≥ 3h</text>
<text x="1425" y="876" font-size="13" fill="#5b6774">hoặc Quản trị đóng ✍</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M780,630 L840,630" stroke="#c98500" stroke-width="3.6" marker-end="url(#mMEP)"/>
<circle cx="806" cy="630" r="14" fill="#fff" stroke="#c98500" stroke-width="2.4"/>
<text x="806" y="636" font-size="17" font-weight="800" fill="#c98500" text-anchor="middle">1</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M1200,630 L1405,630" stroke="#c98500" stroke-width="3.6" marker-end="url(#mMEP)"/>
<circle cx="1226" cy="630" r="14" fill="#fff" stroke="#c98500" stroke-width="2.4"/>
<text x="1226" y="636" font-size="17" font-weight="800" fill="#c98500" text-anchor="middle">1</text>
<text x="1246" y="622" font-size="13.5" fill="#5b6774" font-weight="600" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">đóng — xong việc</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M1090,768 L1090,858" stroke="#c98500" stroke-width="2.2" marker-end="url(#mMEP)"/>
<circle cx="1090" cy="790" r="14" fill="#fff" stroke="#c98500" stroke-width="2.4"/>
<text x="1090" y="796" font-size="17" font-weight="800" fill="#c98500" text-anchor="middle">2</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M1160,858 L1160,768" stroke="#c98500" stroke-width="2.2" marker-end="url(#mMEP)"/>
<circle cx="1160" cy="836" r="14" fill="#fff" stroke="#c98500" stroke-width="2.4"/>
<text x="1160" y="842" font-size="17" font-weight="800" fill="#c98500" text-anchor="middle">1</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M960,768 L960,832 L760,832 L760,858" stroke="#c98500" stroke-width="2.2" marker-end="url(#mMEP)"/>
<circle cx="960" cy="790" r="14" fill="#fff" stroke="#c98500" stroke-width="2.4"/>
<text x="960" y="796" font-size="17" font-weight="800" fill="#c98500" text-anchor="middle">3</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M700,858 L700,820 L880,820 L880,768" stroke="#c98500" stroke-width="2.2" marker-end="url(#mMEP)"/>
<circle cx="700" cy="840" r="14" fill="#fff" stroke="#c98500" stroke-width="2.4"/>
<text x="700" y="846" font-size="17" font-weight="800" fill="#c98500" text-anchor="middle">1</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M115,486 L115,1074" stroke="#e34948" stroke-width="1.8"/>
<text x="127" y="646" font-size="13.5" fill="#b3312f" font-weight="800" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">KHÔNG bấm gì &gt; 20′</text>
<text x="127" y="668" font-size="13.5" fill="#b3312f" font-weight="600" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">· ④ báo vắng rồi quá 1 GIỜ</text>
<text x="127" y="690" font-size="12" fill="#98a3ad" font-weight="600" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">(đồng hồ tính từ lúc nhận mail)</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M430,690 L400,690 L400,1074" stroke="#e34948" stroke-width="1.8"/>
<text x="392" y="940" font-size="13.5" fill="#b3312f" text-anchor="end" font-weight="600" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">chưa nhận việc &gt; 15′</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M1040,1018 L1040,1074" stroke="#e34948" stroke-width="1.8"/>
<text x="1050" y="1046" font-size="13.5" fill="#b3312f" font-weight="600" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">đang / chờ xử lý &gt; 1 GIỜ</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M620,1018 L620,1074" stroke="#e34948" stroke-width="1.8"/>
<text x="632" y="1050" font-size="13.5" fill="#b3312f" font-weight="800" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">bế tắc → NGAY + CC QA</text>
<path fill="none" d="M115,1074 L1040,1074" stroke="#e34948" stroke-width="1.8" stroke-linecap="round"/>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M540,1074 L540,1098" stroke="#e34948" stroke-width="1.8" marker-end="url(#mLOT)"/>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M730,1074 L730,1098" stroke="#e34948" stroke-width="1.8" marker-end="url(#mLOT)"/>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M920,1074 L920,1098" stroke="#e34948" stroke-width="1.8" marker-end="url(#mLOT)"/>
<rect x="430" y="1098" width="620" height="180" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="430" y="1110" width="5" height="156" rx="2.5" fill="#e34948"/>
<text x="450" y="1128" font-size="17" font-weight="800" fill="#b3312f">TRỰC HSL ĐƯỢC BÁO — tầng điều phối cuối</text>
<rect x="448" y="1142" width="200" height="30" rx="9" fill="#fdecec"/>
<text x="459" y="1162.5" font-size="14.5" font-weight="700" fill="#b3312f">① Nhắc IPC ⟳</text>
<rect x="658" y="1142" width="230" height="30" rx="9" fill="#fdecec"/>
<text x="669" y="1162.5" font-size="14.5" font-weight="700" fill="#b3312f">② Nhắc Cơ điện ⟳</text>
<rect x="448" y="1178" width="440" height="30" rx="9" fill="#fdecec"/>
<text x="459" y="1198.5" font-size="14.5" font-weight="700" fill="#b3312f">③ Tạm dừng cảnh báo 4 giờ ✍ (P1: QA·Quản trị)</text>
<text x="450" y="1236" font-size="13" fill="#5b6774">chưa ai thao tác → Trực được nhắc lại MỖI 1 GIỜ</text>
<text x="450" y="1258" font-size="13" fill="#5b6774">email tổng quan ca 6h · 14h · 22h</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M430,1170 L95,1170 L95,486" stroke="#e34948" stroke-width="2.2" marker-end="url(#mLOT)"/>
<circle cx="406" cy="1170" r="14" fill="#fff" stroke="#e34948" stroke-width="2.4"/>
<text x="406" y="1176" font-size="17" font-weight="800" fill="#e34948" text-anchor="middle">1</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M95,800 l0,-16" stroke="#e34948" stroke-width="2.2" marker-end="url(#mLOT)"/>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M1050,1170 L1240,1170 L1240,700 L1200,700" stroke="#e34948" stroke-width="2.2" marker-end="url(#mLOT)"/>
<circle cx="1076" cy="1170" r="14" fill="#fff" stroke="#e34948" stroke-width="2.4"/>
<text x="1076" y="1176" font-size="17" font-weight="800" fill="#e34948" text-anchor="middle">2</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M1240,880 l0,-16" stroke="#e34948" stroke-width="2.2" marker-end="url(#mLOT)"/>
<text x="1252" y="940" font-size="12.5" fill="#5b6774" font-weight="600" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">nhắc Cơ điện ⟳</text>
<rect x="430" y="1354" width="380" height="110" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="430" y="1366" width="5" height="86" rx="2.5" fill="#008300"/>
<text x="450" y="1384" font-size="17" font-weight="800" fill="#1f2b38">QA GÁC HỒ SƠ</text>
<rect x="448" y="1398" width="346" height="30" rx="9" fill="#e7f4ee"/>
<text x="459" y="1418.5" font-size="14.5" font-weight="700" fill="#0c6b4d">① QA xác nhận đã khắc phục ✍ ⏹</text>
<text x="450" y="1450" font-size="13" fill="#5b6774">được CC NGAY khi Cơ điện bế tắc</text>
<rect x="1405" y="1354" width="245" height="110" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="1405" y="1366" width="5" height="86" rx="2.5" fill="#008300"/>
<text x="1425" y="1384" font-size="17" font-weight="800" fill="#0c6b4d">MỞ LẠI ⟲ ✍</text>
<text x="1425" y="1408" font-size="13" fill="#5b6774">QA / Quản trị — vé đã đóng</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M650,1354 L650,1316 L1372,1316 L1372,646 L1405,646" stroke="#008300" stroke-width="2.2" marker-end="url(#mQA)"/>
<circle cx="650" cy="1336" r="14" fill="#fff" stroke="#008300" stroke-width="2.4"/>
<text x="650" y="1342" font-size="17" font-weight="800" fill="#008300" text-anchor="middle">1</text>
<text x="782" y="1308" font-size="13.5" fill="#5b6774" font-weight="600" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">QA đóng được từ MỌI trạng thái đang mở ✍</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M1372,980 l0,-16" stroke="#008300" stroke-width="2.2" marker-end="url(#mQA)"/>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M1650,880 L1686,880 L1686,1400 L1650,1400" stroke="#5b6774" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#mCLOSE)"/>
<text transform="rotate(90 1699 1140)" x="1699" y="1140" font-size="12" font-weight="600" fill="#98a3ad" text-anchor="middle">vé đã đóng → mở lại ✍</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M1520,1464 L1520,1496 L56,1496 L56,360 L70,360" stroke="#008300" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#mQA)"/>
<text x="620" y="1489" font-size="13.5" fill="#0c6b4d" font-weight="600" paint-order="stroke" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round">MỞ LẠI → vé về CHƯA XỬ LÝ: IPC tiếp nhận lại từ đầu, đồng hồ 20′ chạy lại</text>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M840,1496 l-16,0" stroke="#008300" stroke-width="2.2" marker-end="url(#mQA)"/>
<path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M56,800 l0,-16" stroke="#008300" stroke-width="2.2" marker-end="url(#mQA)"/>
<text x="70" y="1552" font-size="18" font-weight="800" fill="#1f2b38">📧 CHI TIẾT EMAIL — BẤM NÚT NÀO, VÉ ĐI ĐÂU</text>
<text x="70" y="1576" font-size="13" fill="#5b6774">nút = link dùng 1 LẦN, sống 4 GIỜ · chỉ gửi trong khung 07:45–16:45 · bấm ngay trong hộp thư, khỏi mở web</text>
<rect x="70" y="1592" width="795" height="330" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="84" y="1592" width="767" height="4" rx="2" fill="#2a78d6"/>
<text x="90" y="1626" font-size="17" font-weight="800" fill="#1f2b38">Email IPC — nhắc 2 giờ/lần, TOÀN CẢNH khu · 4 nút</text>
<text x="90" y="1648" font-size="13" fill="#5b6774">nút hiện khi vé ở: Chưa xử lý · Mở lại (bế tắc: chỉ còn nút ②③④ + Cơ điện tự gỡ)</text>
<rect x="90" y="1664" width="280" height="34" rx="9" fill="#2a78d6" filter="url(#sh)"/><text x="104" y="1687" font-size="14.5" font-weight="800" fill="#ffffff">① Chuyển Cơ điện xử lý</text>
<text x="384" y="1687" font-size="13.5" fill="#5b6774">→ vé sang <tspan font-weight="700">ĐÃ BÁO CƠ ĐIỆN</tspan></text>
<rect x="90" y="1710" width="280" height="34" rx="9" fill="#e9f1fb"/><text x="104" y="1733" font-size="14.5" font-weight="700" fill="#1f5fa8">② Đã kiểm tra — Bình thường ✍</text>
<text x="384" y="1733" font-size="13.5" fill="#5b6774">→ <tspan font-weight="700">ĐÓNG vé</tspan> (cảnh báo giả)</text>
<rect x="90" y="1756" width="280" height="34" rx="9" fill="#e9f1fb"/><text x="104" y="1779" font-size="14.5" font-weight="700" fill="#1f5fa8">③ Đã khắc phục sự cố ✍</text>
<text x="384" y="1779" font-size="13.5" fill="#5b6774">→ <tspan font-weight="700">ĐÓNG vé</tspan> (IPC tự xử lý được)</text>
<rect x="90" y="1802" width="280" height="34" rx="9" fill="#e9f1fb"/><text x="104" y="1825" font-size="14.5" font-weight="700" fill="#1f5fa8">④ Không tại hiện trường ⟳</text>
<text x="384" y="1825" font-size="13.5" fill="#5b6774">→ đứng yên · ân hạn <tspan font-weight="700">1 giờ</tspan> rồi lên Trực</text>
<text x="90" y="1872" font-size="13" fill="#5b6774">+ mục 2: "CƠ ĐIỆN ĐANG XỬ LÝ" — chỉ theo dõi, không nút. Vé đã sang Cơ điện → IPC còn 2 nút đóng (② ③).</text>
<text x="90" y="1896" font-size="13" font-weight="600" fill="#b3312f">Nhận mail rồi im lặng &gt; 20′ → vé tự lên Trực.</text>
<rect x="895" y="1592" width="775" height="330" rx="14" fill="#fff" stroke="#e2e7ec" stroke-width="1.4" filter="url(#sh)"/>
<rect x="909" y="1592" width="747" height="4" rx="2" fill="#c98500"/>
<text x="915" y="1626" font-size="17" font-weight="800" fill="#1f2b38">Email Cơ điện — theo KHU/AHU · đủ 5 nút</text>
<text x="915" y="1648" font-size="13" fill="#5b6774">2 nút bấm ngay + 3 nút 🔒 (mở SAU khi bấm "Đã nhận")</text>
<rect x="915" y="1664" width="280" height="32" rx="9" fill="#8a5e00" filter="url(#sh)"/><text x="929" y="1686" font-size="14.5" font-weight="800" fill="#ffffff">① Đã nhận — đang xử lý</text>
<text x="1209" y="1686" font-size="13.5" fill="#5b6774">→ sang <tspan font-weight="700">ĐANG XỬ LÝ</tspan> · đồng hồ 1 giờ</text>
<rect x="915" y="1706" width="280" height="32" rx="9" fill="#faf0dc"/><text x="929" y="1728" font-size="14.5" font-weight="700" fill="#7a5200">② Không tại hiện trường ⟳</text>
<text x="1209" y="1728" font-size="13.5" fill="#5b6774">→ ân hạn <tspan font-weight="700">1 giờ</tspan> rồi lên Trực</text>
<rect x="915" y="1748" width="280" height="32" rx="9" fill="#f3f5f7" stroke="#d5dbe1" stroke-width="1" stroke-dasharray="4 3"/><text x="929" y="1770" font-size="14.5" font-weight="700" fill="#9aa4ad">③ 🔒 Đã khắc phục ✍</text>
<text x="1209" y="1770" font-size="13.5" fill="#5b6774">→ <tspan font-weight="700">ĐÓNG vé</tspan> — hết email</text>
<rect x="915" y="1790" width="280" height="32" rx="9" fill="#f3f5f7" stroke="#d5dbe1" stroke-width="1" stroke-dasharray="4 3"/><text x="929" y="1812" font-size="14.5" font-weight="700" fill="#9aa4ad">④ 🔒 Không thể xử lý ✍</text>
<text x="1209" y="1812" font-size="13.5" fill="#5b6774">→ <tspan font-weight="700" fill="#b3312f">bế tắc</tspan> — Trực + QA báo NGAY</text>
<rect x="915" y="1832" width="280" height="32" rx="9" fill="#f3f5f7" stroke="#d5dbe1" stroke-width="1" stroke-dasharray="4 3"/><text x="929" y="1854" font-size="14.5" font-weight="700" fill="#9aa4ad">⑤ 🔒 Chờ xử lý (khi rảnh)</text>
<text x="1209" y="1854" font-size="13.5" fill="#5b6774">→ sang <tspan font-weight="700">CHỜ XỬ LÝ</tspan> — vẫn nhắc 2h</text>
<text x="915" y="1896" font-size="13" fill="#5b6774">🔒 bấm sớm bị từ chối đúng trình tự, KHÔNG mất lượt — "Đã nhận" xong bấm lại là chạy.</text>
<text x="70" y="1960" font-size="13" font-weight="600" fill="#b3312f">Email Trực HSL: tổng quan ca 6h · 14h · 22h + vé leo thang — ① Nhắc IPC ⟳ · ② Nhắc Cơ điện ⟳ · ③ Tạm dừng 4 giờ ✍; nhắc lại mỗi 1 giờ.</text>
<text x="70" y="1984" font-size="13" fill="#5b6774">Email "vé đã đóng" gửi Cơ điện khi người khác đóng vé — KHÔNG có nút (hết việc để bấm, khỏi ra hiện trường vô ích).</text>
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
        <span className="text-[11px] text-muted">Sơ đồ tự co theo màn hình — bấm phóng to nếu muốn xem chữ lớn.</span>
        <button onClick={() => setFull(true)}
          className="shrink-0 rounded-xl bg-subtle px-3 py-1.5 text-[12px] font-semibold text-body ring-1 ring-line hover:bg-subtle">
          ⛶ Phóng to toàn màn hình
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 1240 }} dangerouslySetInnerHTML={{ __html: SVG }} />
      </div>
      {full && (
        <div className="fixed inset-0 z-[90] overflow-auto bg-surface p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <b className="text-[14px] text-strong">Sơ đồ vòng đời sự cố — toàn màn hình</b>
            <button onClick={() => setFull(false)}
              className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-anchorink">✕ Đóng (Esc)</button>
          </div>
          <div style={{ minWidth: 1560 }} dangerouslySetInnerHTML={{ __html: SVG }} />
        </div>
      )}
    </div>
  );
}
