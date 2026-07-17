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

const SVG = `<svg viewBox="0 0 1560 1500" style="width:100%;height:auto;display:block;font-family:Inter,'Segoe UI',system-ui,Arial,sans-serif" role="img" aria-label="Sơ đồ vòng đời sự cố theo bộ phận">
  <defs>
    <marker id="mIpc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#185fa5"/></marker>
    <marker id="mMep" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#854f0b"/></marker>
    <marker id="mLot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#a32d2d"/></marker>
    <marker id="mQa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#0f6e56"/></marker>
    <marker id="mSys" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#5b4b8a"/></marker>
    <marker id="mClose" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#3f4a54"/></marker>
  </defs>
  <style>
    .ln{fill:none;stroke-width:2}
    .lbl{font-size:12px;font-weight:600;paint-order:stroke;stroke:#ffffff;stroke-width:3.5px;stroke-linejoin:round}
    .ttl{font-size:13.5px;font-weight:700}
    .sb{font-size:11px;fill:#5f7a90}
    .lane{font-size:12px;font-weight:800;letter-spacing:.14em}
    .bx{fill:#fff;stroke-width:2}
  </style>

  <!-- LÀN NỀN -->
  <rect x="46" y="40"  width="1499" height="145" fill="#efeaf8" opacity=".5" rx="8"/>
  <rect x="46" y="190" width="1499" height="145" fill="#e6f1fb" opacity=".55" rx="8"/>
  <rect x="46" y="340" width="1499" height="360" fill="#faeeda" opacity=".5" rx="8"/>
  <rect x="46" y="705" width="1499" height="180" fill="#fcebeb" opacity=".55" rx="8"/>
  <rect x="46" y="890" width="1499" height="150" fill="#e7f4ef" opacity=".55" rx="8"/>
  <text class="lane" fill="#5b4b8a" transform="rotate(-90 28 112)" x="28" y="112" text-anchor="middle">HỆ THỐNG</text>
  <text class="lane" fill="#185fa5" transform="rotate(-90 28 262)" x="28" y="262" text-anchor="middle">IPC</text>
  <text class="lane" fill="#854f0b" transform="rotate(-90 28 520)" x="28" y="520" text-anchor="middle">CƠ ĐIỆN</text>
  <text class="lane" fill="#a32d2d" transform="rotate(-90 28 795)" x="28" y="795" text-anchor="middle">TRỰC HSL</text>
  <text class="lane" fill="#0f6e56" transform="rotate(-90 28 965)" x="28" y="965" text-anchor="middle">QA</text>

  <!-- CỘT KẾT THÚC -->
  <rect x="1230" y="40" width="235" height="660" fill="#f8fafb" stroke="#cbd5e1" stroke-dasharray="5 4" rx="10"/>
  <text x="1347" y="62" text-anchor="middle" font-size="11" font-weight="800" letter-spacing=".12em" fill="#5f7a90">KẾT THÚC — VÉ ĐÓNG</text>

  <!-- ═ HỆ THỐNG ═ -->
  <rect class="bx" x="70" y="75" width="230" height="80" rx="10" stroke="#5b4b8a"/>
  <text class="ttl" x="85" y="99" fill="#5b4b8a">WF1 chấm điểm mỗi giờ (:02)</text>
  <text class="sb" x="85" y="119">lệch dải &gt; 20′ và 10′ cuối ≥ 4</text>
  <text class="sb" x="85" y="135">→ mở vé NGHIÊM TRỌNG (P1/P2)</text>

  <rect class="bx" x="340" y="75" width="270" height="80" rx="10" stroke="#5b4b8a" stroke-dasharray="6 4"/>
  <text class="ttl" x="355" y="99" fill="#5b4b8a">Cảm biến đứng hình ≥ 3 giờ</text>
  <text class="sb" x="355" y="119">= phòng thiếu dữ liệu — KHÔNG mở vé</text>
  <text class="sb" x="355" y="135">theo dõi riêng tab Cảm biến (WF11 07:00)</text>

  <rect class="bx" x="1240" y="75" width="215" height="85" rx="10" stroke="#5b4b8a" fill="#efeaf8"/>
  <text class="ttl" x="1255" y="99" fill="#5b4b8a">TỰ ĐÓNG ⏹</text>
  <text class="sb" x="1255" y="119">đủ 2 GIỜ SẠCH liên tiếp</text>
  <text class="sb" x="1255" y="135">— áp dụng mọi vé đang mở</text>

  <!-- ═ IPC ═ -->
  <rect class="bx" x="70" y="215" width="230" height="105" rx="10" stroke="#185fa5"/>
  <text class="ttl" x="85" y="237" fill="#185fa5">CHƯA XỬ LÝ</text>
  <text class="sb" x="85" y="257">vé mới · vé MỞ LẠI</text>
  <text class="sb" x="85" y="273">IPC kiểm tra hiện trường</text>
  <text class="sb" x="85" y="291">vắng ⟳ = ân hạn 1 giờ</text>

  <rect class="bx" x="1240" y="215" width="215" height="75" rx="10" stroke="#3f4a54" fill="#eef1f4"/>
  <text class="ttl" x="1255" y="239" fill="#3f4a54">IPC — BÌNH THƯỜNG ⏹</text>
  <text class="sb" x="1255" y="259">cảnh báo giả · ghi lý do ✍</text>

  <!-- ═ CƠ ĐIỆN ═ -->
  <rect class="bx" x="380" y="390" width="240" height="90" rx="10" stroke="#854f0b"/>
  <text class="ttl" x="395" y="413" fill="#854f0b">ĐÃ BÁO CƠ ĐIỆN</text>
  <text class="sb" x="395" y="433">chờ Cơ điện xác nhận nhận việc</text>
  <text class="sb" x="395" y="449">vắng ⟳ = ân hạn 1 giờ</text>

  <rect class="bx" x="700" y="390" width="250" height="110" rx="10" stroke="#854f0b"/>
  <text class="ttl" x="715" y="413" fill="#854f0b">CƠ ĐIỆN ĐANG XỬ LÝ</text>
  <text class="sb" x="715" y="433">kiểm tra AHU, khắc phục</text>
  <text class="sb" x="715" y="449">email nhắc 2 giờ/lần (07:45–16:45)</text>
  <text class="sb" x="715" y="465" fill="#a32d2d">im lặng &gt; 1 giờ → lên Trực</text>

  <rect class="bx" x="700" y="545" width="250" height="75" rx="10" stroke="#854f0b" stroke-dasharray="6 4"/>
  <text class="ttl" x="715" y="568" fill="#854f0b">CHỜ XỬ LÝ (khi rảnh)</text>
  <text class="sb" x="715" y="588">chờ vật tư — vé VẪN MỞ, vẫn nhắc</text>

  <rect class="bx" x="380" y="545" width="250" height="80" rx="10" stroke="#a32d2d"/>
  <text class="ttl" x="395" y="568" fill="#a32d2d">KHÔNG XỬ LÝ ĐƯỢC</text>
  <text class="sb" x="395" y="588">bế tắc — ghi lý do ✍</text>
  <text class="sb" x="395" y="604">chờ IPC giao lại / có vật tư</text>

  <rect class="bx" x="1240" y="410" width="215" height="85" rx="10" stroke="#0f6e56" fill="#e7f4ef"/>
  <text class="ttl" x="1255" y="434" fill="#0f6e56">ĐÃ KHẮC PHỤC ⏹</text>
  <text class="sb" x="1255" y="454">sự cố thật, đã sửa xong</text>
  <text class="sb" x="1255" y="470">Cơ điện · IPC · QA · Quản trị ✍</text>

  <rect class="bx" x="1240" y="530" width="215" height="80" rx="10" stroke="#3f4a54" fill="#eef1f4"/>
  <text class="ttl" x="1255" y="553" fill="#3f4a54">ĐÓNG — NGOÀI PHẠM VI ⏹</text>
  <text class="sb" x="1255" y="573">cảm biến đứng hình ≥ 3h</text>
  <text class="sb" x="1255" y="589">hoặc Quản trị đóng · ghi lý do ✍</text>

  <!-- ═ TRỰC HSL ═ -->
  <rect class="bx" x="380" y="735" width="530" height="120" rx="10" stroke="#a32d2d"/>
  <text class="ttl" x="395" y="759" fill="#a32d2d">TRỰC HSL ĐƯỢC BÁO — tầng điều phối cuối</text>
  <text class="sb" x="395" y="781">Nhắc IPC ⟳ · Nhắc Cơ điện ⟳ · Tạm dừng cảnh báo 4 giờ ✍</text>
  <text class="sb" x="395" y="797">chưa ai thao tác → nhắc lại MỖI 1 GIỜ</text>
  <text class="sb" x="395" y="813">đồng hồ im lặng tính từ mốc gần nhất: thao tác · nhận email · mở vé</text>

  <!-- ═ QA ═ -->
  <rect class="bx" x="380" y="920" width="280" height="75" rx="10" stroke="#0f6e56"/>
  <text class="ttl" x="395" y="944" fill="#0f6e56">QA XÁC NHẬN KHẮC PHỤC</text>
  <text class="sb" x="395" y="964">đóng vé · ghi lý do ✍ ⏹</text>

  <rect class="bx" x="1240" y="920" width="215" height="75" rx="10" stroke="#0f6e56" stroke-dasharray="6 4"/>
  <text class="ttl" x="1255" y="944" fill="#0f6e56">MỞ LẠI ⟲ ✍</text>
  <text class="sb" x="1255" y="964">QA / Quản trị — vé đã đóng</text>

  <!-- ═ MŨI TÊN ═ -->
  <!-- Hệ thống mở vé -->
  <path class="ln" d="M185,155 L185,215" stroke="#5b4b8a" marker-end="url(#mSys)"/>
  <text class="lbl" x="195" y="188" fill="#5b4b8a">mở vé · email đi ≤ 5′</text>
  <!-- Đứng hình → đóng ngoài phạm vi -->
  <path class="ln" d="M475,75 L475,52 L1500,52 L1500,565 L1455,565" stroke="#5b4b8a" stroke-dasharray="6 4" marker-end="url(#mSys)"/>
  <text class="lbl" x="620" y="47" fill="#5b4b8a">vé đang mở của cảm biến đó bị hệ ĐÓNG</text>

  <!-- IPC từ CHƯA XỬ LÝ -->
  <path class="ln" d="M300,228 L1240,228" stroke="#185fa5" marker-end="url(#mIpc)"/>
  <text class="lbl" x="320" y="222" fill="#185fa5">Đã kiểm tra — Bình thường ✍ (đóng: cảnh báo giả)</text>
  <path class="ln" d="M300,252 L1200,252 L1200,445 L1240,445" stroke="#185fa5" marker-end="url(#mIpc)"/>
  <text class="lbl" x="700" y="246" fill="#185fa5">Đã khắc phục sự cố ✍ (đóng)</text>
  <path class="ln" d="M300,276 L470,276 L470,390" stroke="#185fa5" marker-end="url(#mIpc)"/>
  <text class="lbl" x="320" y="270" fill="#185fa5">Chuyển Cơ điện — đường DUY NHẤT sang tay</text>

  <!-- Cơ điện xử lý -->
  <path class="ln" d="M620,430 L700,430" stroke="#854f0b" marker-end="url(#mMep)"/>
  <text class="lbl" x="626" y="422" fill="#854f0b">Đã nhận</text>
  <path class="ln" d="M790,500 L790,545" stroke="#854f0b" marker-end="url(#mMep)"/>
  <text class="lbl" x="797" y="530" fill="#854f0b">Chờ vật tư</text>
  <path class="ln" d="M880,545 L880,500" stroke="#854f0b" marker-end="url(#mMep)"/>
  <text class="lbl" x="887" y="540" fill="#854f0b">Đã nhận lại</text>
  <path class="ln" d="M700,470 L660,470 L660,560 L630,560" stroke="#854f0b" marker-end="url(#mMep)"/>
  <text class="lbl" x="652" y="520" fill="#854f0b" text-anchor="end">Không thể xử lý ✍</text>
  <path class="ln" d="M630,600 L680,600 L680,480 L700,480" stroke="#854f0b" marker-end="url(#mMep)"/>
  <text class="lbl" x="686" y="528" fill="#854f0b">Đã có vật tư ⟲</text>
  <path class="ln" d="M460,545 L460,480" stroke="#185fa5" marker-end="url(#mIpc)"/>
  <text class="lbl" x="452" y="518" fill="#185fa5" text-anchor="end">IPC giao lại ⟲</text>
  <path class="ln" d="M950,455 L1240,455" stroke="#854f0b" marker-end="url(#mMep)"/>
  <text class="lbl" x="1000" y="447" fill="#854f0b">Đã khắc phục ✍ (đóng)</text>

  <!-- Leo thang xuống Trực -->
  <path class="ln" d="M150,320 L150,715" stroke="#a32d2d" stroke-width="1.7" marker-end="url(#mLot)"/>
  <text class="lbl" x="158" y="490" fill="#a32d2d">IPC im lặng &gt; 20′</text>
  <text class="lbl" x="158" y="506" fill="#a32d2d">· báo vắng quá 1 giờ</text>
  <path class="ln" d="M380,455 L362,455 L362,715" stroke="#a32d2d" stroke-width="1.7" marker-end="url(#mLot)"/>
  <text class="lbl" x="354" y="644" fill="#a32d2d" text-anchor="end">chưa nhận việc &gt; 15′</text>
  <path class="ln" d="M825,620 L825,715" stroke="#a32d2d" stroke-width="1.7" marker-end="url(#mLot)"/>
  <text class="lbl" x="832" y="668" fill="#a32d2d">im lặng &gt; 1 giờ</text>
  <path class="ln" d="M505,625 L505,715" stroke="#a32d2d" stroke-width="1.7" marker-end="url(#mLot)"/>
  <text class="lbl" x="513" y="668" fill="#a32d2d" font-weight="800">bế tắc → NGAY + CC QA</text>
  <path class="ln" d="M150,717 L825,717" stroke="#a32d2d" stroke-width="1.7"/>
  <path class="ln" d="M450,717 L450,733" stroke="#a32d2d" stroke-width="1.7" marker-end="url(#mLot)"/>
  <path class="ln" d="M645,717 L645,733" stroke="#a32d2d" stroke-width="1.7" marker-end="url(#mLot)"/>
  <path class="ln" d="M790,717 L790,733" stroke="#a32d2d" stroke-width="1.7" marker-end="url(#mLot)"/>

  <!-- Trực nhắc ngược lên -->
  <path class="ln" d="M380,795 L90,795 L90,320" stroke="#a32d2d" marker-end="url(#mLot)"/>
  <text class="lbl" x="98" y="600" fill="#a32d2d">Nhắc IPC ⟳</text>
  <path class="ln" d="M910,795 L985,795 L985,515 L930,515 L930,500" stroke="#a32d2d" marker-end="url(#mLot)"/>
  <text class="lbl" x="993" y="655" fill="#a32d2d">Nhắc Cơ điện ⟳</text>

  <!-- QA -->
  <path class="ln" d="M560,920 L560,905 L1210,905 L1210,475 L1240,475" stroke="#0f6e56" marker-end="url(#mQa)"/>
  <text class="lbl" x="600" y="898" fill="#0f6e56">QA đóng được từ MỌI trạng thái đang mở ✍</text>
  <path class="ln" d="M1455,590 L1520,590 L1520,957 L1455,957" stroke="#3f4a54" stroke-dasharray="6 4" marker-end="url(#mClose)"/>
  <text class="lbl" x="1462" y="583" fill="#3f4a54">mở lại ✍</text>
  <path class="ln" d="M1345,995 L1345,1025 L52,1025 L52,266 L70,266" stroke="#0f6e56" stroke-dasharray="6 4" marker-end="url(#mQa)"/>
  <text class="lbl" x="600" y="1018" fill="#0f6e56">MỞ LẠI → vé về CHƯA XỬ LÝ: IPC tiếp nhận lại từ đầu, đồng hồ 20′ chạy lại</text>

  <!-- mũi tên chỉ hướng GIỮA đường (cho các đường dài dễ theo dõi) -->
  <path class="ln" d="M620,228 l14,0" stroke="#185fa5" marker-end="url(#mIpc)"/>
  <path class="ln" d="M960,228 l14,0" stroke="#185fa5" marker-end="url(#mIpc)"/>
  <path class="ln" d="M640,252 l14,0" stroke="#185fa5" marker-end="url(#mIpc)"/>
  <path class="ln" d="M1200,335 l0,14" stroke="#185fa5" marker-end="url(#mIpc)"/>
  <path class="ln" d="M820,52 l14,0" stroke="#5b4b8a" marker-end="url(#mSys)"/>
  <path class="ln" d="M1500,285 l0,14" stroke="#5b4b8a" marker-end="url(#mSys)"/>
  <path class="ln" d="M150,560 l0,14" stroke="#a32d2d" marker-end="url(#mLot)"/>
  <path class="ln" d="M362,555 l0,14" stroke="#a32d2d" marker-end="url(#mLot)"/>
  <path class="ln" d="M240,795 l-14,0" stroke="#a32d2d" marker-end="url(#mLot)"/>
  <path class="ln" d="M90,560 l0,-14" stroke="#a32d2d" marker-end="url(#mLot)"/>
  <path class="ln" d="M985,690 l0,-14" stroke="#a32d2d" marker-end="url(#mLot)"/>
  <path class="ln" d="M900,905 l14,0" stroke="#0f6e56" marker-end="url(#mQa)"/>
  <path class="ln" d="M1210,700 l0,-14" stroke="#0f6e56" marker-end="url(#mQa)"/>
  <path class="ln" d="M800,1025 l-14,0" stroke="#0f6e56" marker-end="url(#mQa)"/>
  <path class="ln" d="M52,650 l0,-14" stroke="#0f6e56" marker-end="url(#mQa)"/>
  <path class="ln" d="M1520,765 l0,14" stroke="#3f4a54" marker-end="url(#mClose)"/>

  <!-- ═══ TẦNG CHI TIẾT EMAIL: bấm nút nào, vé đi đâu ═══ -->
  <text x="70" y="1078" font-size="15" font-weight="800" fill="#1e2a36">📧 CHI TIẾT EMAIL — BẤM NÚT NÀO, VÉ ĐI ĐÂU</text>
  <text x="490" y="1078" font-size="11.5" fill="#5f7a90">(nút là link dùng 1 LẦN, sống 4 GIỜ · chỉ gửi trong khung 07:45–16:45 · bấm được ngay trong hộp thư, khỏi mở web)</text>

  <!-- Panel EMAIL IPC -->
  <rect x="70" y="1092" width="690" height="300" rx="12" fill="#fff" stroke="#185fa5" stroke-width="2"/>
  <text class="ttl" x="88" y="1118" fill="#185fa5">Email IPC — nhắc 2 giờ/lần, TOÀN CẢNH khu · 4 nút</text>
  <text class="sb" x="88" y="1136">nút hiện khi vé ở: Chưa xử lý · Mở lại · Không xử lý được</text>
  <rect x="88" y="1150" width="216" height="30" rx="8" fill="#e6f1fb"/><text x="100" y="1170" font-size="12.5" font-weight="700" fill="#185fa5">1 · Chuyển Cơ điện xử lý</text>
  <text x="316" y="1170" font-size="12" fill="#3f4a54">→ vé sang <tspan font-weight="700">ĐÃ BÁO CƠ ĐIỆN</tspan> — đường duy nhất sang tay</text>
  <rect x="88" y="1194" width="216" height="30" rx="8" fill="#e6f1fb"/><text x="100" y="1214" font-size="12.5" font-weight="700" fill="#185fa5">2 · Đã kiểm tra — Bình thường ✍</text>
  <text x="316" y="1214" font-size="12" fill="#3f4a54">→ <tspan font-weight="700">ĐÓNG vé</tspan> (cảnh báo giả — IPC đã ra tận nơi)</text>
  <rect x="88" y="1238" width="216" height="30" rx="8" fill="#e6f1fb"/><text x="100" y="1258" font-size="12.5" font-weight="700" fill="#185fa5">3 · Đã khắc phục sự cố ✍</text>
  <text x="316" y="1258" font-size="12" fill="#3f4a54">→ <tspan font-weight="700">ĐÓNG vé</tspan> (IPC tự xử lý được tại chỗ)</text>
  <rect x="88" y="1282" width="216" height="30" rx="8" fill="#e6f1fb"/><text x="100" y="1302" font-size="12.5" font-weight="700" fill="#185fa5">4 · Không tại hiện trường ⟳</text>
  <text x="316" y="1302" font-size="12" fill="#3f4a54">→ vé đứng yên · ân hạn <tspan font-weight="700">1 giờ</tspan>, quá thì lên Trực</text>
  <text x="88" y="1340" font-size="11" fill="#5f7a90">+ mục 2 trong mail: "CƠ ĐIỆN ĐANG XỬ LÝ" — chỉ theo dõi, không nút, kèm đồng hồ Cơ điện.</text>
  <text x="88" y="1358" font-size="11" fill="#5f7a90">Vé đã sang Cơ điện → IPC còn 2 nút đóng (số 2 và 3 — luật "mọi trạng thái"), không phải mất nút.</text>
  <text x="88" y="1376" font-size="11" fill="#a32d2d">Nhận mail rồi im lặng &gt; 20′ → vé tự lên Trực.</text>

  <!-- Panel EMAIL CƠ ĐIỆN -->
  <rect x="800" y="1092" width="700" height="300" rx="12" fill="#fff" stroke="#854f0b" stroke-width="2"/>
  <text class="ttl" x="818" y="1118" fill="#854f0b">Email Cơ điện — theo KHU/AHU · đủ 5 nút ngay từ mail đầu</text>
  <text class="sb" x="818" y="1136">2 nút bấm được ngay + 3 nút 🔒 (mở khóa SAU khi bấm "Đã nhận")</text>
  <rect x="818" y="1150" width="230" height="30" rx="8" fill="#faeeda"/><text x="830" y="1170" font-size="12.5" font-weight="700" fill="#854f0b">1 · Đã nhận — đang xử lý</text>
  <text x="1060" y="1170" font-size="12" fill="#3f4a54">→ vé sang <tspan font-weight="700">ĐANG XỬ LÝ</tspan> · đồng hồ im lặng 1 giờ</text>
  <rect x="818" y="1194" width="230" height="30" rx="8" fill="#faeeda"/><text x="830" y="1214" font-size="12.5" font-weight="700" fill="#854f0b">2 · Không tại hiện trường ⟳</text>
  <text x="1060" y="1214" font-size="12" fill="#3f4a54">→ vé đứng yên · ân hạn <tspan font-weight="700">1 giờ</tspan>, quá thì lên Trực</text>
  <rect x="818" y="1238" width="230" height="30" rx="8" fill="#f1f4f6" stroke="#c8d2da" stroke-dasharray="4 3"/><text x="830" y="1258" font-size="12.5" font-weight="700" fill="#8a97a3">3 · 🔒 Đã khắc phục ✍</text>
  <text x="1060" y="1258" font-size="12" fill="#3f4a54">→ <tspan font-weight="700">ĐÓNG vé</tspan> — xong việc, hết email</text>
  <rect x="818" y="1282" width="230" height="30" rx="8" fill="#f1f4f6" stroke="#c8d2da" stroke-dasharray="4 3"/><text x="830" y="1302" font-size="12.5" font-weight="700" fill="#8a97a3">4 · 🔒 Không thể xử lý ✍</text>
  <text x="1060" y="1302" font-size="12" fill="#a32d2d">→ <tspan font-weight="700">bế tắc</tspan> — Trực + QA được báo NGAY</text>
  <rect x="818" y="1326" width="230" height="30" rx="8" fill="#f1f4f6" stroke="#c8d2da" stroke-dasharray="4 3"/><text x="830" y="1346" font-size="12.5" font-weight="700" fill="#8a97a3">5 · 🔒 Chờ xử lý (khi rảnh)</text>
  <text x="1060" y="1346" font-size="12" fill="#3f4a54">→ vé sang <tspan font-weight="700">CHỜ XỬ LÝ</tspan> — vẫn nhắc 2h, đồng hồ 1 giờ</text>
  <text x="818" y="1376" font-size="11" fill="#5f7a90">🔒 bấm sớm bị máy chủ từ chối đúng trình tự, KHÔNG mất lượt — bấm lại sau khi "Đã nhận" là chạy.</text>

  <!-- Ghi chú email Trực + vé đóng -->
  <text x="70" y="1420" font-size="11.5" fill="#a32d2d" font-weight="600">Email Trực HSL: tổng quan ca 6h · 14h · 22h + vé leo thang — nút "Nhắc IPC ⟳" · "Nhắc Cơ điện ⟳" · "Tạm dừng cảnh báo 4 giờ ✍"; nhắc lại mỗi 1 giờ tới khi có người thao tác.</text>
  <text x="70" y="1440" font-size="11.5" fill="#5f7a90">Email "vé đã đóng" gửi cho Cơ điện đang xử lý khi người khác đóng vé — KHÔNG có nút (hết việc để bấm, khỏi ra hiện trường vô ích).</text>
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
        <div style={{ minWidth: 1000 }} dangerouslySetInnerHTML={{ __html: SVG }} />
      </div>
      {full && (
        <div className="fixed inset-0 z-[90] overflow-auto bg-white p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <b className="text-[14px] text-slate-800">Sơ đồ vòng đời sự cố — toàn màn hình</b>
            <button onClick={() => setFull(false)}
              className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-slate-700">✕ Đóng (Esc)</button>
          </div>
          <div style={{ minWidth: 1280 }} dangerouslySetInnerHTML={{ __html: SVG }} />
        </div>
      )}
    </div>
  );
}
