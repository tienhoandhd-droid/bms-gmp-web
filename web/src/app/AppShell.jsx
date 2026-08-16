// AppShell.jsx — khung ứng dụng (đổi tên từ App(), tách từ App.jsx 17/08/2026 — move-only).
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_DATA_SOURCE, HAS_SUPABASE } from "../lib/config";
import { useLiveData } from "../hooks/useLiveData";
import { PHIEN_BAN_GIAO_THUC, capNhatPhut8h, layNguoiDung, luuNguoiDung, layTaiKhoanChuaPhanQuyen, thaoTacSuCo, kiemVeThaoTac, thaoTacSuCoTuEmail, tamDungCanhBao, batLaiCanhBao, kiemGiaoThuc, ketLuanCum, layHoSoCum, kiemChuoiHashAudit, ACTION_LABEL_TO_CODE, TRANG_THAI_CODE_TO_LABEL, layChuoiXuHuong, layChuoiXuHuongChiTiet, layChuoiXuHuongDaSensor, layChuoiGiaTriPhong, layPhanTichSau, layQuetBatThuong, layDuBaoXuHuong, layMaTranPhongNgay, luuPhanTichAi, layWebhookAi, layWebhookAiSau, phanTichAiQuaWorkflow, layWebhookWf7b, guiNhanDinhXuHuong, layWebhookBaoCaoBu, guiBaoCaoBu, themPhong, suaPhong, xoaPhong, suaGioiHan, themCamBien, xoaCamBien, suaNguong, moPhongNguong, layCanhBaoUuTien, datCanhBaoUuTien, layCanhBaoHuong, datCanhBaoHuong, layCauHinhEmail, datCauHinhEmail, layNguoiNhanBaoCao, luuNguoiNhanBaoCao, xoaNguoiNhanBaoCao, layNguoiNhanCanhBao, luuNguoiNhanCanhBao, xoaNguoiNhanCanhBao, layDanhSachAhu, layLuatPhanTuyen, luuLuatPhanTuyen, xoaLuatPhanTuyen, datCongTacPhanTuyen, layCamBienDungHinh, layChenhApTheoAhu, dangKyRealtimeChenhAp, layDanhGiaHieuQuaCanhBao, layDanhGiaCanhBaoTuan, layKhungGioCanhBao, luuKhungGioCanhBao, EMAIL_KEYS_HE_THONG, EMAIL_KEYS_BAO_CAO } from "../lib/supabaseData";
import { moTaLoi } from "../lib/bmsClient";
import { dangNhapMatKhau, dangXuat as authDangXuat, layPhienHienTai, theoDoiPhien, doiMatKhau, thuKhoiPhucPhien } from "../lib/auth";
import { COLOR, SENSOR_COLOR, SENSOR_META_BASE, COMPLY_OK, COMPLY_BAD, fmtPct } from "../lib/designTokens";
import AuthGate from "../AuthGate";
// Nạp TRỄ 2 trang nặng KHÔNG thuộc màn hình đầu: Nhật ký kiểm toán (tab Nhật ký) và
// Sơ đồ luật (tab Cài đặt) — ~880 dòng. Cắt khỏi bundle "main" eager, chỉ tải khi mở
// đúng tab → màn hình đầu tải & dựng nhanh hơn.
const AuditLogPage = React.lazy(() => import("../components/AuditLogPage"));
const SoDoLuatCard = React.lazy(() => import("../components/SoDoLuatCard"));
const SoDoVongDoi = React.lazy(() => import("../components/SoDoVongDoi"));
// Nạp trễ các trang feature lớn (17/08) — chỉ tải khi mở đúng tab:
const TrendPage = React.lazy(() => import("../features/trends/TrendPage"));
const ReportsPage = React.lazy(() => import("../features/reports/ReportsPage"));
const ChenhApTheoAhu = React.lazy(() => import("../features/pressure/ChenhApTheoAhu"));
const CauHinhNguoiNhan = React.lazy(() => import("../features/recipients/RecipientsPage"));
const LuatPhanTuyenCard = React.lazy(() => import("../features/recipients/RecipientsPage").then((m) => ({ default: m.LuatPhanTuyenCard })));
import { moHoSoCumBanIn } from "../lib/hoSoCum";
import {
  Droplets, Thermometer, Sparkles, ShieldCheck, ShieldAlert, Activity,
  AlertTriangle, CheckCircle2, HelpCircle, Clock, ChevronRight, X, FileText,
  TrendingDown, TrendingUp, Gauge, CircleDot, Check, ChevronDown, Bell, BellOff, Mail, Cpu,
  Wind, FileBarChart, LayoutDashboard, AlertOctagon, Building2, LineChart as LineIcon,
  ScrollText, Settings as Cog, Wifi, Printer, Plus, Trash2, Search, LogIn, LogOut,
  User, Eye, SlidersHorizontal, History, Pencil, KeyRound, Layers, Minus, Save, GitBranch, Power,
  Radio, RefreshCw, ClipboardList
} from "lucide-react";
import logoCpc1hn from "../assets/logo-cpc1hn.png";


// ===== Đã tách move-only 17/08/2026 → lib/uiConst, lib/phanQuyen, lib/dinhDang, lib/moPhong, lib/nutThaoTac, components/ui/CpcLogo =====
import { PAGE_BG, cardShadow, CARD, STATUS, PRIORITY, MUC, LEVELS, LEVEL_PRIORITY, LEVEL_GLYPH, levelGlyph, SENSOR_META, OOS_FILL, ICON_CANH_BAO } from "../lib/uiConst";
import { ROLE_VI, TEN_VAI_KHU, khuCua, tenVaiTro, docTenVaiTro, FULL_ACCESS, canManageRooms, TAB_ROLES, roleCanSeeTab } from "../lib/phanQuyen";
import { mulberry32, hashStr, fmtH, fmtDelta, deltaTone, pad, toLocalInput, vnNow } from "../lib/dinhDang";
import { RAW, ROOM_BIAS, rawSeries, sensorStats, sensorLevel, roomLevel, roomCompliance, roomHourlyOOS, genDaily, genHourly, SCOPES, MASTER, byType, findScope, RANGES, SENSORS, SCOPE_LEVELS, applySensor, getSeries, AREAS, AHUS, defSensors, ROOM_SEED, INITIAL_ROOMS, INCIDENTS0, SYSTEM_ALERTS, SOP } from "../lib/moPhong";
import { A_TEAL, A_AMBER, A_INFO, A_ROSE, A_SLATE, A_IPC, A_MEP_NHAN, A_MEP_XONG, A_MEP_KHONG, STATUS_ACTIONS, rolesOfStatus, firstActionFor, nutKhopTrangThai, nutChoVaiTro, STATUS_DOT } from "../lib/nutThaoTac";
import CpcLogo from "../components/ui/CpcLogo";
import Chart from "../components/ui/Chart";
import { Card, SectionTitle, MucBadge, HeaderChip } from "../components/ui/Card";
import ServerClock from "../components/ui/ServerClock";
import { BannerCapNhat } from "../components/ui/BannerCapNhat";
import { KpiCard, OosMiniBars } from "../components/ui/KpiCard";





/* Memo (nâng cấp 07/07): 4 thẻ KPI + lưới thẻ phòng re-render toàn bộ mỗi nhịp 60s và
   mỗi lần bấm bất kỳ nút nào trên trang. Comparator BỎ QUA identity của prop hàm/objeto
   trang trí (onClick, accent tạo inline) — chỉ so giá trị hiển thị; hành vi hàm không đổi
   giữa các render nên bỏ qua identity là an toàn. */




/* ===== #3 — DANH SÁCH PHÒNG THEO Ô KPI (bấm ô → biết phòng nào) ===== */

/* ===== QUẢN LÝ PHÒNG (gồm sửa cảm biến/giới hạn phòng cũ) ===== */

import { HuongDanEmailNut, ModalVeEmail } from "../features/reports/EmailParts";
import { LoginModal, SucKhoeWidget, DoiMatKhauCard, DoiMatKhauModal, PhanTichGmpCard, TaiKhoanCard, ChuoiHashCard } from "../features/settings/SettingsParts";
import { DS_KHU, DB_MOI_MAC_DINH } from "../lib/phanQuyen";
import CamBienPage, { TheDungHinhTongQuan, ModalKetLuanCum, ModalMoLai, CumDrawer } from "../features/sensors/CamBienPage";
import { BuocSuCo, KiemSoatXuLy, ApprovalModal, DanhGiaHieuQuaCanhBao } from "../features/incidents/IncidentsParts";
import ViecCuaBan from "../features/tasks/ViecCuaBan";
import { RoomCard, RoomDetailModal, KpiListModal, RoomManager } from "../features/dashboard/DashboardParts";
import GiaoDienCard from "../features/settings/GiaoDienCard";
import StatusAnchor from "../components/layout/StatusAnchor";
import { fmtPhut } from "../lib/dinhDang";



/* ============ APP ============ */








/* ===== QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN XEM THEO KHU (chỉ ADMIN) ===== */

/* ===== SỰ CỐ GẦN ĐÂY — bản đồ phút cửa sổ 8h (chỉ phòng có sự cố) ===== */
const RECENT_RANGES = [{ k: 1, label: "1 giờ" }, { k: 4, label: "4 giờ" }, { k: 8, label: "8 giờ" }];

/* ═══ TỔNG QUAN — thẻ CẢM BIẾN ĐỨNG HÌNH (chính sách 13/07: tách riêng) ═══
   Phòng có cảm biến đứng hình = tương đương THIẾU DỮ LIỆU: không chấm mức,
   không mở sự cố, không vào báo cáo chung. Thẻ này là lối vào nhanh từ Tổng
   quan; chi tiết + nút làm mới nằm ở tab Cảm biến. Ẩn khi không có cái nào. */




const TABS = [{ k: "home", label: "Tổng quan", icon: LayoutDashboard }, { k: "tasks", label: "Công việc", icon: ClipboardList }, { k: "events", label: "Sự cố", icon: AlertOctagon }, { k: "recent", label: "Chênh áp", icon: Gauge }, { k: "sensors", label: "Cảm biến", icon: Gauge }, { k: "trend", label: "Xu hướng & tuân thủ", icon: LineIcon }, { k: "reports", label: "Báo cáo", icon: FileBarChart }, { k: "audit", label: "Nhật ký & SOP", icon: ScrollText }, { k: "recipients", label: "Người nhận thông báo", icon: Mail }, { k: "settings", label: "Cài đặt", icon: Cog }];

// ═══════════════════════════════════════════════════════════════════════════
// CỤM ĐIỀU TRA & MỞ LẠI SỰ CỐ — modal/ngăn kéo (10/07/2026)
// Thay 4 hộp window.prompt nối đuôi: QA nhìn cả bốn trường một lúc, biết trường nào
// bắt buộc, sửa được trước khi ghi. RPC phía sau giữ nguyên (rpc_ket_luan_cum,
// rpc_thao_tac_su_co) — giao diện chỉ là lớp vỏ, luật vẫn nằm ở máy chủ.
// ═══════════════════════════════════════════════════════════════════════════



const HIEN_VIEC_CUA_BAN = false;   // 16/07: user tạm ẩn — chưa cần thiết giai đoạn này




export default function AppShell() {
  const [tab, setTab] = useState(() => { try { const t = new URLSearchParams(window.location.search).get("tab"); return TABS.some((x) => x.k === t) ? t : "home"; } catch { return "home"; } });
  // KEEP-ALIVE tab nặng (Xu hướng & tuân thủ, Sự cố gần đây): đã mở 1 lần thì GIỮ MOUNTED, chỉ ẩn
  // bằng display:none — đổi tab rồi quay lại KHÔNG tải lại từ đầu (giữ cache chuỗi, kết quả AI,
  // bộ lọc, vị trí cuộn trong tab). Kèm cú "resize" khi quay lại để ECharts tự căn lại khung.
  const [daMo, setDaMo] = useState({});
  useEffect(() => {
    setDaMo((v) => (v[tab] ? v : { ...v, [tab]: true }));
    if (tab === "trend" || tab === "recent") { try { requestAnimationFrame(() => window.dispatchEvent(new Event("resize"))); } catch { /* không chặn render */ } }
  }, [tab]);
  const [auditTab, setAuditTab] = useState("audit");   // tab con Nhật ký & SOP: audit | config | sop
  const [cfgTab, setCfgTab] = useState("canhbao");     // tab con Cài đặt: canhbao | phong | phantuyen | hethong
  const [dataSource, setDataSource] = useState(DEFAULT_DATA_SOURCE);   // 'demo' | 'live'
  const LIVE_MAC_DINH = DEFAULT_DATA_SOURCE === "live";   // LIVE → KHÔNG nhồi dữ liệu demo (tránh "thông tin không khớp")
  const [rooms, setRooms] = useState(LIVE_MAC_DINH ? [] : INITIAL_ROOMS);
  const [incidents, setIncidents] = useState(LIVE_MAC_DINH ? [] : INCIDENTS0);
  const [evtKhu, setEvtKhu] = useState("ALL");   // Sự cố: lọc theo khu (ALL/C1/C4/Q2)
  const [evtAhu, setEvtAhu] = useState("ALL");   // Sự cố: lọc theo AHU trong khu đã chọn
  const [cfg, setCfg] = useState({ warn: 20, action: 4 });   // ngưỡng ĐANG ÁP DỤNG (LIVE đọc từ cau_hinh)
  // ③ Bản nháp + kết quả mô phỏng. Kéo thanh trượt KHÔNG còn ghi thẳng xuống production:
  // hai khoá này quyết định giờ nào mở sự cố, giờ nào GỬI MAIL, giờ nào TỰ ĐÓNG.
  const [cfgNhap, setCfgNhap] = useState(null);   // null = chưa sửa gì
  const [moPhong, setMoPhong] = useState(null);   // {dangTai} | {kq} | {loi}
  const [alertUuTien, setAlertUuTien] = useState(["P1", "P2", "P3"]); // cấp độ phòng được cảnh báo (config)
  // Khoá con `canh_bao` đã gỡ 10/07/2026: chưa hàm/view/dòng web nào đọc nó, và nó cũng
  // chưa bao giờ được vẽ ra. Một nút không làm gì còn tệ hơn không có nút.
  const [alertHuong, setAlertHuong] = useState({ DP: { su_co: "CA_HAI" }, RH: { su_co: "CA_HAI" }, T: { su_co: "CA_HAI" } }); // hướng mở sự cố
  const [user, setUser] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [roomModal, setRoomModal] = useState(null);
  const [configHistory, setConfigHistory] = useState(LIVE_MAC_DINH ? [] : [{ t: "08:00 29/5", who: "Quản trị (ADMIN)", change: "Khởi tạo cấu hình hệ thống · 6 phòng" }]);
  const [audit, setAudit] = useState(LIVE_MAC_DINH ? [] : [{ t: "13:05 29/5", who: "Hệ thống", act: "Tạo sự cố", obj: "SC-1042 / C4.R7", detail: "Chênh áp nghiêm trọng" }, { t: "10:18 29/5", who: "Nam (IPC)", act: "Xác nhận bất thường", obj: "SC-1038 / C4.R1", detail: "Kiểm tra thực tế" }]);
  const [ai, setAi] = useState(null);
  const [pwOpen, setPwOpen] = useState(false);   // #5 — modal đổi mật khẩu (mọi vai trò)
  // Ẩn banner "Đang đọc/ghi dữ liệu thật…" cho gọn (nhớ qua localStorage; bấm ô
  // "Nguồn dữ liệu" trên header để hiện/ẩn lại). Khi CÓ LỖI tải banner luôn hiện.
  const [anBannerLive, setAnBannerLive] = useState(() => { try { return localStorage.getItem("bms_an_banner_live") === "1"; } catch { return false; } });
  const doiBannerLive = () => setAnBannerLive((v) => { const m = !v; try { localStorage.setItem("bms_an_banner_live", m ? "1" : "0"); } catch { /* bỏ qua */ } return m; });
  const [kpiModal, setKpiModal] = useState(null); // #3 — modal danh sách phòng theo ô KPI ('dat'|'khong'|'thieu'|'p1')
  const [xemTatCaPhong, setXemTatCaPhong] = useState(false);   // Overview: ưu tiên 1&2 (mặc định) ↔ tất cả phòng
  // Nút bấm từ email: ?sc=&act=&token=. Đọc token NGAY khi tải trang rồi dọn URL
  // (token là bí mật, không để nằm trên thanh địa chỉ / lịch sử trình duyệt).
  // Chưa đăng nhập thì AuthGate chặn màn hình, token vẫn nằm trong ref → xử lý sau khi vào.
  const tokenEmail = useRef(null);
  const [veEmail, setVeEmail] = useState(null);   // { dangTai } | { ve } | { loi }
  // CHẾ ĐỘ THAO TÁC NHẸ (mở web từ nút trong email): bấm nút mail deep-link vào web;
  // TRƯỚC ĐÂY mỗi cú bấm bung TOÀN BỘ dashboard + useLiveData (tải nặng) + phiên mới →
  // bấm nhiều nút = nhiều tab nặng cùng lúc → web lag + refresh-token đa-tab đá nhau =
  // "lỗi đăng nhập". Nay khi mở từ email chỉ dựng màn thao tác nhẹ; dashboard chỉ mount
  // khi người dùng CHỦ ĐỘNG bấm "Mở bảng điều khiển". moTuEmail chốt ở render đầu (effect
  // dọn URL xoá token ngay sau đó).
  const [moTuEmail] = useState(() => { try { return !!new URLSearchParams(window.location.search).get("token"); } catch { return false; } });
  const [vaoDashboard, setVaoDashboard] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const tk = q.get("token");
    if (!tk) return;
    tokenEmail.current = tk;
    q.delete("token"); q.delete("sc"); q.delete("act");
    const sach = window.location.pathname + (q.toString() ? "?" + q.toString() : "") + window.location.hash;
    window.history.replaceState(null, "", sach);
  }, []);
  const role = user?.role; const canManage = canManageRooms(role);
  const isLive = dataSource === "live";
  // #5 — danh sách tab hiển thị theo vai trò
  // Tab hiển thị theo vai trò. LIVE mà vai trò CHƯA xác định (đang tải / lỗi tra) → chỉ
  // các tab xem cơ bản (không lộ Cài đặt/Người nhận khi role=null). RPC vẫn gate server-side.
  // ===== Dữ liệu LIVE từ Supabase (Tổng quan/Sự cố/Nhật ký) =====
  // ④ Release manifest — web cũ + DB mới = nút không hoạt động, không một thông báo nào.
  // Hôm nay đã gặp: rpc_sua_nguong_canh_bao đổi từ 4 tham số xuống 3.
  const [giaoThucLech, setGiaoThucLech] = useState(null);
  useEffect(() => {
    if (!isLive) return;
    let huy = false;
    kiemGiaoThuc().then((r) => { if (!huy && !r.ok) setGiaoThucLech(r.phienBanDb); }).catch(() => {});
    return () => { huy = true; };
  }, [isLive]);

  // P0-3: gắn hook với danh tính phiên. Đổi tài khoản ⇒ hook xoá sạch state trong lúc
  // render và bỏ mọi phản hồi của phiên cũ. Không còn cửa sổ lộ dữ liệu khu người trước.
  // batDau=false khi đang ở chế độ thao tác nhẹ (mở từ email, chưa vào dashboard) → hook
  // KHÔNG tải gì cho tới khi người dùng bấm "Mở bảng điều khiển".
  const cheDoThaoTac = moTuEmail && !vaoDashboard;
  const live = useLiveData(dataSource, { phienId: user?.email || null, batDau: !cheDoThaoTac });
  // Có token email + đã đăng nhập → soi phiếu (CHỈ ĐỌC). DB kiểm vai trò, khu, hạn
  // token, và cả việc sự cố đã đổi trạng thái từ lúc gửi mail.
  //
  // ⚠ BUG ĐÃ SỬA (10/07/2026) — effect tự huỷ chính nó, modal kẹt ở "Đang kiểm tra liên kết…":
  //   Bản cũ để `veEmail` trong mảng phụ thuộc VÀ gọi setVeEmail({dangTai:true}) ngay trong
  //   effect. Chuỗi sự kiện: set state → veEmail đổi → React chạy hàm dọn dẹp (huy = true)
  //   → effect chạy lại nhưng thoát sớm vì `veEmail` đã có → promise cũ về đích, thấy
  //   huy === true nên KHÔNG set kết quả. Modal đứng mãi ở trạng thái đang tải.
  //   `user` cũng đổi tham chiếu hai lần (theoDoiPhien phát user tối thiểu rồi user đủ vai
  //   trò), nên kể cả bỏ veEmail khỏi deps thì cleanup vẫn bắn và vẫn hỏng.
  //
  // Cách sửa: cờ "đã chạy" và cờ "đã unmount" nằm ở ref, không phải ở deps. Effect chỉ
  //   phụ thuộc điều kiện KHỞI ĐỘNG (isLive, có user), không phụ thuộc kết quả của nó.
  const veDaChay = useRef(false);
  const veDaGo = useRef(false);
  useEffect(() => () => { veDaGo.current = true; }, []);
  useEffect(() => {
    if (!isLive || !user || !tokenEmail.current || veDaChay.current) return;
    veDaChay.current = true;
    setVeEmail({ dangTai: true });
    kiemVeThaoTac(tokenEmail.current).then(({ error, ve }) => {
      if (veDaGo.current) return;              // chỉ bỏ qua khi component đã bị gỡ
      // ve != null ⇒ DB đã trả lời (kể cả từ chối), luôn ưu tiên ngữ cảnh của nó.
      if (ve?.ok) setVeEmail({ ve });
      else if (ve) setVeEmail({ loi: ve.thong_bao || "Liên kết không dùng được.", ve });
      else setVeEmail({ loi: moTaLoi(error) });
    }).catch(() => {
      if (!veDaGo.current) setVeEmail({ loi: "Không kiểm tra được liên kết. Kiểm tra mạng rồi thử lại." });
    });
  }, [isLive, user]);
  const dongVe = () => { tokenEmail.current = null; setVeEmail(null); };
  const chayVe = async (lyDo) => {
    const { data, error } = await thaoTacSuCoTuEmail({ token: tokenEmail.current, lyDo });
    // Lỗi nghiệp vụ vẫn kèm data (goiRPC trả cả hai) — giữ lại để modal bày ngữ cảnh.
    if (error) return { ...(data || {}), ok: false, thong_bao: moTaLoi(error) };
    live.lamMoi({ nen: true });
    return data;
  };
  // Tab hiển thị theo vai trò; LIVE mà vai trò CHƯA xác định → chỉ tab xem cơ bản
  // (khai báo SAU isLive để tránh dùng biến trước khi khởi tạo — TDZ).
  const visibleTabs = useMemo(() => {
    const base = TABS.filter((t) => roleCanSeeTab(role, t.k));
    if (isLive && user && !role) return base.filter((t) => ["home", "tasks", "events", "recent"].includes(t.k));
    return base;
  }, [role, isLive, user]);

  // Đồng bộ phiên đăng nhập thật (magic link) khi ở chế độ live
  useEffect(() => {
    if (!isLive || !HAS_SUPABASE) return;
    let off = () => {};
    layPhienHienTai().then((u) => { if (u) setUser(u); });
    off = theoDoiPhien((u) => setUser(u));
    // Phiên hết hạn giữa chừng (RPC trả CHUA_DANG_NHAP dù UI đang hiện đã đăng nhập):
    // báo rõ + đăng xuất → AuthGate tự hiện màn đăng nhập lại. Chặn lặp bằng cờ 1 lần.
    // ĐA-TAB (mở nhiều nút email cùng lúc): supabase-js xoay refresh-token; một tab có thể
    // TẠM thấy CHUA_DANG_NHAP dù phiên vẫn còn. THỬ KHÔI PHỤC trước khi đăng xuất → tránh
    // đá người dùng ra oan. Chỉ khi khôi phục thất bại mới thực sự đăng xuất.
    let daBao = false, dangKhoiPhuc = false;
    const onHetHan = async () => {
      if (daBao || dangKhoiPhuc) return;
      dangKhoiPhuc = true;
      try {
        const u = await thuKhoiPhucPhien();
        if (u) { setUser(u); return; }   // phiên còn sống (tab khác vừa refresh) → giữ nguyên
      } finally { dangKhoiPhuc = false; }
      if (daBao) return; daBao = true;
      alert("Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại để tiếp tục thao tác.\n(Dữ liệu giám sát không bị ảnh hưởng.)");
      setUser(null); authDangXuat();
    };
    window.addEventListener("bms:phien-het-han", onHetHan);
    const offHetHan = () => window.removeEventListener("bms:phien-het-han", onHetHan);
    const offCu = off; off = () => { offCu && offCu(); offHetHan(); };
    return () => off();
  }, [isLive]);

  // Khi có dữ liệu sự cố LIVE → thay danh sách demo.
  // P0 (rò dữ liệu đổi tài khoản): SET CẢ KHI null. useLiveData đặt live.* = null ngay
  // lúc render khi đổi phiên (phienId đổi); nếu chỉ set khi truthy, App giữ nguyên bản
  // sao phòng/sự cố/nhật ký của khu tài khoản TRƯỚC và vẽ ra. Về [] ngay để không lộ.
  useEffect(() => { if (isLive) setIncidents(live.incidents || []); }, [isLive, live.incidents]);
  useEffect(() => { if (isLive) setConfigHistory(live.configHistory || []); }, [isLive, live.configHistory]);
  useEffect(() => { if (isLive) setRooms(live.rooms || []); }, [isLive, live.rooms]);
  useEffect(() => { if (isLive && live.nguong) { setCfg(live.nguong); setCfgNhap(null); setMoPhong(null); } }, [isLive, live.nguong]);
  // P0 — đổi tài khoản/đăng xuất: ĐÓNG mọi modal + xoá bản sao nhạy cảm NGAY. RLS không
  // dọn được dữ liệu ĐÃ nằm trong bộ nhớ trình duyệt (modal đang mở của khu cũ) → phải tự xoá.
  const emailTruoc = useRef(user?.email);
  useEffect(() => {
    if (emailTruoc.current === user?.email) return;
    emailTruoc.current = user?.email;
    setKpiModal(null); setRoomModal(null); setModal(null); setMoPhong(null);
    if (LIVE_MAC_DINH) { setRooms([]); setIncidents([]); setConfigHistory([]); setAudit([]); }
  }, [user?.email]);
  useEffect(() => { if (!isLive) return; let huy = false; (async () => { const ds = await layCanhBaoUuTien(); if (!huy && Array.isArray(ds) && ds.length) setAlertUuTien(ds); })(); return () => { huy = true; }; }, [isLive]);
  useEffect(() => { if (!isLive) return; let huy = false; (async () => { const h = await layCanhBaoHuong(); if (!huy && h) setAlertHuong(h); })(); return () => { huy = true; }; }, [isLive]);

  // #1 KHẮC PHỤC "phải F5 mới hiện dữ liệu" đã chuyển vào useLiveData:
  // hook tự nạp lại NGAY khi Supabase phát INITIAL_SESSION/SIGNED_IN (phiên sẵn sàng),
  // nên không còn phụ thuộc thời điểm của React ở đây nữa.

  // #5 — nếu vai trò không được phép xem tab đang mở (vd IPC đang ở Cài đặt khi đăng nhập) → đưa về Tổng quan
  useEffect(() => { if (role && !roleCanSeeTab(role, tab)) setTab("home"); }, [role, tab]);
  // Prefetch chunk biểu đồ (ECharts ~243KB gzip) → mở tab Xu hướng tức thì, không khựng.
  // TRƯỚC ĐÂY chạy NGAY lúc mount (kể cả màn đăng nhập / màn Tổng quan) ⇒ 243KB tải song
  // song CẠNH TRANH với lần tải dữ liệu đầu → vào trang chậm. Nay CHỜ: đã đăng nhập
  // (có vai trò) VÀ màn hình đầu đã có dữ liệu (live.capNhatLuc), rồi mới prefetch lúc rảnh.
  const daWarmCharts = useRef(false);
  useEffect(() => {
    if (daWarmCharts.current || !role || !live.capNhatLuc) return;
    daWarmCharts.current = true;
    let id, tm;
    const warm = () => { import("../components/charts").catch(() => {}); };
    if (typeof requestIdleCallback === "function") id = requestIdleCallback(warm, { timeout: 4000 });
    else tm = setTimeout(warm, 1200);
    return () => { if (id) cancelIdleCallback(id); if (tm) clearTimeout(tm); };
  }, [role, live.capNhatLuc]);

  // Giờ máy chủ UTC+7: trước đây dùng toISOString() (UTC) nên lệch -7h so với nhãn "UTC+7".
  // Định dạng theo đúng múi giờ Asia/Ho_Chi_Minh, không phụ thuộc múi giờ trình duyệt.
  const now = isLive ? vnNow() : "2026-05-29 14:08:22";

  // ===== Phân quyền XEM theo khu: user.khuVuc = mảng khu được xem (null = ADMIN/không giới hạn) =====
  const khuChoPhep = (isLive && user && Array.isArray(user.khuVuc)) ? user.khuVuc : null;
  // Khi bị giới hạn khu: phòng KHÔNG rõ khu → CHẶN (deny-by-default, tránh lọt dữ liệu khu lạ).
  const loKhu = (khu) => !khuChoPhep || (!!khu && khuChoPhep.includes(khu));
  const areaCuaPhong = useMemo(() => { const m = {}; rooms.forEach((r) => { m[r.id] = r.area; }); return m; }, [rooms]);
  const roomsXem = useMemo(() => (khuChoPhep ? rooms.filter((r) => loKhu(r.area)) : rooms), [rooms, khuChoPhep]); // eslint-disable-line react-hooks/exhaustive-deps
  // Khu ưu tiên lấy từ chính sự cố (view đã lọc khu_duoc_xem SERVER-side); chỉ rơi về
  // map phòng khi thiếu. KHÔNG loại sự cố chưa rõ khu — trước 15/07 sự cố về trước
  // danh sách phòng bị lọc SẠCH ⇒ tab Sự cố trống rất lâu với tài khoản giới hạn khu.
  const incidentsXem = useMemo(() => (khuChoPhep ? incidents.filter((i) => { const a = i.khu || areaCuaPhong[i.room]; return !a || loKhu(a); }) : incidents), [incidents, khuChoPhep, areaCuaPhong]); // eslint-disable-line react-hooks/exhaustive-deps
  // ⑤ Owner — ai đang giữ việc (suy từ trạng thái, server tính). 17/07: bỏ SLA hẹn giờ.
  const phuTrachTheoId = useMemo(() => {
    const m = {};
    (isLive && Array.isArray(live.suCoPhuTrach) ? live.suCoPhuTrach : []).forEach((r) => { m[r.ma_su_co] = r; });
    return m;
  }, [isLive, live.suCoPhuTrach]);

  const demoKpis = useMemo(() => ({ dat: roomsXem.filter((r) => { const c = roomCompliance(r); return !r.noData && c >= 80; }).length, khongDat: roomsXem.filter((r) => { const c = roomCompliance(r); return !r.noData && c < 80; }).length, thieuDL: roomsXem.filter((r) => r.noData).length, tong: roomsXem.length }), [roomsXem]);
  // Server đã tự lọc KPI theo quyền khu của phiên đăng nhập (khu_duoc_xem() trong
  // xem_tong_quan) → LIVE luôn dùng số server, kể cả tài khoản bị giới hạn khu.
  const kpis = isLive ? (live.kpis || { dat: 0, khongDat: 0, thieuDL: 0, tong: 0 }) : demoKpis;
  // Mảng 4: chỉ hiện skeleton KPI khi LIVE và chưa có số thật (tránh nháy "0").
  const kpiLoading = isLive && !live.kpis;
  // ═══ P0-1 — LIVE TUYỆT ĐỐI KHÔNG ĐƯỢC RƠI VỀ FIXTURE DEMO ═══
  // Trước 10/07/2026: `live.systemAlerts` null (đang tải HOẶC lỗi) ⇒ hiện SYSTEM_ALERTS
  // demo, trong đó có dòng "Workflow chạy lúc 13:05 — thành công". Nghĩa là khi workflow
  // thật CHẾT, người vận hành đọc được một cảnh báo giả nói nó đang chạy tốt.
  // `sopRows` còn tệ hơn: fallback cả khi DB trả về RỖNG HỢP LỆ ⇒ QA nhìn thấy hồ sơ
  // CAPA giả (DEV-2026-014) như hồ sơ thật. Đây là lỗi toàn vẹn dữ liệu, không phải UI.
  //
  // Bốn trạng thái rõ ràng, không trạng thái nào rơi về demo:
  //   null            → đang tải        (skeleton)
  //   []              → tải xong, rỗng  ("không có cảnh báo")
  //   live.loi        → lỗi             ("Không xác minh được trạng thái")
  const systemAlerts = isLive
    ? (live.systemAlerts ? live.systemAlerts.map((a) => ({ ...a, icon: ICON_CANH_BAO(a) })) : null)
    : SYSTEM_ALERTS;
  const sopRows = isLive ? live.sopRows : SOP;
  const duLieuLoi = isLive && !!live.loi;
  // "Sự cố Mức 1 & 2" — cả phòng trọng yếu (P1) và quan trọng (P2), khớp phạm vi email cảnh báo (canh_bao_muc_uu_tien = P1,P2)
  const suCoP12ds = incidentsXem.filter((i) => (i.priority === "P1" || i.priority === "P2") && i.status !== "Đã khắc phục");
  const p12Open = suCoP12ds.length;
  // #3 — Phân loại phòng để bấm vào ô KPI biết "phòng nào". Quy tắc khớp với view xem_tong_quan:
  //   thiếu DL = mất dữ liệu / chưa có % / dữ liệu quá cũ (trễ > ngưỡng giờ); còn lại đạt khi ≥80%.
  const FRESH_MIN = (isLive && live.sucKhoe?.nguongGio != null ? live.sucKhoe.nguongGio : 2) * 60;
  // 12/08 — MẤT NGUỒN: server (rpc_tinh_trang_nguon qua rpc_kiem_tra_suc_khoe_he_thong)
  // là nơi DUY NHẤT kết luận. Khi đỏ, các ô "Phòng đạt / không đạt" KHÔNG được hiện số:
  // "0 đạt" đọc như "đo được 0 phòng đạt", trong khi sự thật là KHÔNG ĐO ĐƯỢC GÌ.
  const matNguon = isLive && live.sucKhoe?.matDuLieu === true;
  const skTomTat = live.sucKhoe?.tomTat || null;
  const phanLoaiPhong = (r) => {
    const comp = roomCompliance(r);
    if (r.noData || comp == null || (r.agePhut != null && r.agePhut > FRESH_MIN)) return "thieu";
    return comp >= 80 ? "dat" : "khong";
  };
  const nhomPhong = useMemo(() => {
    const g = { dat: [], khong: [], thieu: [] };
    roomsXem.forEach((r) => g[phanLoaiPhong(r)].push(r));   // P0: roomsXem (đã lọc khu), KHÔNG dùng rooms → modal KPI không lộ phòng ngoài khu
    const sx = (a, b) => (roomCompliance(a) ?? -1) - (roomCompliance(b) ?? -1);
    g.dat.sort((a, b) => (roomCompliance(b) ?? 0) - (roomCompliance(a) ?? 0)); // đạt: cao→thấp
    g.khong.sort(sx); g.thieu.sort((a, b) => (a.id < b.id ? -1 : 1));          // không đạt: thấp→cao
    return g;
  }, [roomsXem, isLive, FRESH_MIN]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sự cố Mức 1 & 2 đang mở — để link từ ô KPI (P1 xếp trước P2, rồi theo lúc mở)
  const suCoP12 = [...suCoP12ds].sort((a, b) => (a.priority === b.priority ? String(a.start).localeCompare(String(b.start)) : a.priority === "P1" ? -1 : 1));
  // #9 — "Phòng trọng điểm" xếp theo NGUY CƠ để tập trung theo dõi:
  //   Hành động (3) → Cảnh báo (2) → Cần chú ý (1) → Kiểm soát tốt (0) → thiếu DL (cuối).
  //   Cùng mức cảnh báo thì phòng có % đạt thấp hơn lên trước.
  const sapTheoNguyCo = (a, b) => {
    const la = LEVEL_PRIORITY(roomLevel(a, cfg)), lb = LEVEL_PRIORITY(roomLevel(b, cfg));
    if (la !== lb) return lb - la;                                  // mức cao → lên đầu
    return (roomCompliance(a) ?? 999) - (roomCompliance(b) ?? 999); // cùng mức: % đạt thấp lên trước
  };
  // "Ưu tiên 1 & 2": lọc P1/P2 nhưng vẫn xếp theo nguy cơ
  const phongUuTien = useMemo(
    () => roomsXem.filter((r) => r.priority === "P1" || r.priority === "P2").sort(sapTheoNguyCo),
    [roomsXem, cfg] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // "Tất cả": mọi phòng (trong quyền xem), cũng xếp theo nguy cơ
  const phongTatCa = useMemo(
    () => [...roomsXem].sort(sapTheoNguyCo),
    [roomsXem, cfg] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const phongHienThi = xemTatCaPhong ? phongTatCa : phongUuTien;

  const logConfig = (change) => setConfigHistory((h) => [{ t: now.slice(11, 16) + " 29/5", who: user ? `${user.name} (${user.role})` : "(chưa đăng nhập)", change }, ...h]);
  const apMoi = () => live.lamMoi({ nen: true });
  const baoLoi = (error, fallback) => { if (error) alert(error.thong_bao || error.ma_loi || fallback || "Lỗi kết nối — thử lại."); return !error; };
  const addRoom = async (r) => {
    if (isLive) { const { error } = await themPhong({ p_ma_phong: r.id, p_ten_phong: r.name, p_khu_vuc: r.area, p_ahu: r.ahu, p_muc_uu_tien: r.priority, p_ghi_chu: r.note || null, p_thieu_du_lieu: !!r.noData, p_cam_bien: (r.sensors || []).map((s) => ({ loai: s.k, min: s.min, max: s.max })), p_actor: user?.email || null }); if (baoLoi(error, "Không thêm được phòng")) await apMoi(); return; }
    setRooms((rs) => [...rs, r]); logConfig(`Thêm phòng ${r.id} (${r.name}) · ${r.noData ? "no-data" : r.sensors.map((s) => s.k).join("/")}`);
  };
  const deleteRoom = async (id) => {
    if (isLive) { const { error } = await xoaPhong({ p_ma_phong: id, p_actor: user?.email || null }); if (baoLoi(error, "Không xóa được phòng")) await apMoi(); return; }
    setRooms((rs) => rs.filter((r) => r.id !== id)); logConfig(`Xóa phòng ${id}`);
  };
  // Lưu GỘP các thay đổi từ panel sửa phòng (bản nháp + nút Lưu): chạy tuần tự các RPC
  // cần thiết rồi làm mới MỘT lần — đây là dữ liệu gốc (mốc so sánh) nên sau khi lưu,
  // KPI/thẻ phòng/ngưỡng cảnh báo đều tính lại theo giá trị mới. Trả về true nếu lưu trọn vẹn.
  const saveRoomEdits = async (id, { patch = {}, capNhatGioiHan = [], themSensor = [], boSensor = [] }) => {
    if (isLive) {
      const actor = user?.email || null; const loi = [];
      const ghi = (nhan, error) => { if (error) loi.push(`${nhan}: ${error.thong_bao || error.ma_loi || "lỗi kết nối"}`); };
      if (Object.keys(patch).length) {
        const M = { name: "ten_phong", area: "khu_vuc", ahu: "ahu", priority: "muc_uu_tien", note: "ghi_chu" };
        const p_patch = {}; Object.keys(patch).forEach((k) => { if (M[k]) p_patch[M[k]] = patch[k] === "" ? null : patch[k]; });
        const { error } = await suaPhong({ p_ma_phong: id, p_patch, p_actor: actor }); ghi("Thông tin phòng", error);
      }
      for (const k of boSensor) { const { error } = await xoaCamBien({ p_ma_phong: id, p_loai_cam_bien: k, p_actor: actor }); ghi(`Bỏ cảm biến ${k}`, error); }
      for (const s of themSensor) { const { error } = await themCamBien({ p_ma_phong: id, p_loai_cam_bien: s.k, p_gioi_han_duoi: s.min, p_gioi_han_tren: s.max, p_actor: actor }); ghi(`Thêm cảm biến ${s.k}`, error); }
      for (const s of capNhatGioiHan) { const { error } = await suaGioiHan({ p_ma_phong: id, p_loai_cam_bien: s.k, p_gioi_han_duoi: s.min, p_gioi_han_tren: s.max, p_actor: actor }); ghi(`Giới hạn ${s.k}`, error); }
      await apMoi();
      if (loi.length) { alert(`Một số thay đổi của ${id} CHƯA lưu được:\n• ` + loi.join("\n• ")); return false; }
      return true;
    }
    setRooms((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      let sensors = (r.sensors || []).filter((s) => !boSensor.includes(s.k));
      sensors = sensors.map((s) => { const c = capNhatGioiHan.find((x) => x.k === s.k); return c ? { ...s, min: c.min, max: c.max } : s; });
      themSensor.forEach((t) => { if (!sensors.some((s) => s.k === t.k)) sensors = [...sensors, { k: t.k, min: t.min, max: t.max }]; });
      return { ...r, ...patch, sensors };
    }));
    logConfig(`Lưu phòng ${id}: ${[Object.keys(patch).length && "thông tin phòng", capNhatGioiHan.length && `giới hạn ${capNhatGioiHan.map((s) => s.k).join("/")}`, themSensor.length && `thêm ${themSensor.map((s) => s.k).join("/")}`, boSensor.length && `bỏ ${boSensor.join("/")}`].filter(Boolean).join(" · ")}`);
    return true;
  };
  const handleSaveAI = async ({ scopeType, scopeId, scopeName, sensor, days, text, level }) => {
    if (!isLive) return;
    const { error } = await luuPhanTichAi({ p_scope_type: scopeType, p_scope_id: scopeId, p_ten_scope: scopeName, p_sensor: sensor, p_so_ngay: days, p_noi_dung: text, p_muc_canh_bao: level, p_actor: user?.email || null });
    if (!error) live.lamMoi({ nen: true });
  };
  // ③ Không còn onMouseUp → ghi DB. Phải xem tác động rồi mới áp.
  const cfgHT = cfgNhap || cfg;
  const coThayDoi = !!cfgNhap && (cfgNhap.warn !== cfg.warn || cfgNhap.action !== cfg.action);
  const xemTacDong = async () => {
    if (!coThayDoi) return;
    setMoPhong({ dangTai: true });
    const { data, error } = await moPhongNguong({ warn: cfgNhap.warn, action: cfgNhap.action, soNgay: 7 });
    if (error) { setMoPhong({ loi: error.thong_bao || error.ma_loi || "Không mô phỏng được." }); return; }
    setMoPhong({ kq: data });
  };
  const saveCfg = async (next) => {
    if (isLive) {
      const { error } = await suaNguong({ p_nguong_canh_bao: next.warn, p_nguong_hanh_dong: next.action, p_actor: user?.email || null });
      if (baoLoi(error, "Không lưu được ngưỡng")) { setCfgNhap(null); setMoPhong(null); await apMoi(); }
    } else { logConfig(`Sửa ngưỡng cảnh báo: vượt ngưỡng ${next.warn} · gửi mail khi 10′ cuối ≥ ${next.action}`); setCfg(next); setCfgNhap(null); setMoPhong(null); }
  };
  // Bật/tắt 1 cấp ưu tiên trong phạm vi cảnh báo (phải giữ ≥1 cấp).
  const toggleUuTien = async (p) => {
    if (!canManage) return;
    const cur = alertUuTien.includes(p) ? alertUuTien.filter((x) => x !== p) : [...alertUuTien, p];
    if (!cur.length) return;
    const arr = ["P1", "P2", "P3"].filter((x) => cur.includes(x));
    setAlertUuTien(arr);
    if (isLive) { const r = await datCanhBaoUuTien(arr, user?.email); if (r && r.ok && r.gia_tri) setAlertUuTien(r.gia_tri.split(",")); }
    else logConfig(`Phạm vi cảnh báo theo ưu tiên: ${arr.join(", ")}`);
  };
  // Đổi hướng cảnh báo cho 1 chỉ tiêu × 1 loại ngưỡng.
  const doiHuong = async (chiTieu, loai, giaTri) => {
    if (!canManage) return;
    const next = { ...alertHuong, [chiTieu]: { ...(alertHuong[chiTieu] || {}), [loai]: giaTri } };
    setAlertHuong(next);
    if (isLive) { const r = await datCanhBaoHuong(next, user?.email); if (r && r.ok && r.gia_tri) setAlertHuong(r.gia_tri); }
    else logConfig(`Hướng cảnh báo ${chiTieu}/${loai === "su_co" ? "sự cố" : "cảnh báo sớm"}: ${giaTri}`);
  };

  const requireLogin = () => { if (!user) { setLoginOpen(true); return false; } return true; };
  // P0-2 — Thẻ phòng và modal KPI gọi openApproval(inc) KHÔNG kèm nút. Trước 10/07/2026
  // hàm rơi về firstActionFor() hard-code, và với ADMIN nó trả nút của IPC/Cơ điện mà DB
  // luôn từ chối. Ở LIVE, nút phải giải từ CÙNG một resolver: trạng thái × vai trò × mở/đóng.
  const openApproval = (inc, action) => {
    if (!requireLogin()) return;
    let act = action;
    if (!act) {
      if (isLive) {
        const ds = live.nutThaoTac;
        if (!Array.isArray(ds) || !ds.length || !inc.statusCode) {
          alert("Chưa tải được bộ quy tắc thao tác. Tải lại trang rồi thử lại.");
          return;
        }
        act = nutChoVaiTro(ds, inc.statusCode, role)[0] || null;
      } else {
        act = firstActionFor(inc.status, role);
      }
    }
    setModal({ inc, action: act });
  };
  const handleCommit = async (inc, action, reason) => {
    const who = `${user.name} (${user.role})`;
    if (isLive && inc.dbId) {
      const { error } = await thaoTacSuCo({ dbId: inc.dbId, actionCode: action.code, lyDo: reason, actorEmail: user.email });
      setModal(null);
      if (error) { alert(error.nghiep_vu ? (error.thong_bao || error.ma_loi) : "Lỗi kết nối — thử lại."); return; }
      await live.lamMoi({ nen: true });   // đồng bộ lại từ DB (đã có audit/trail thật)
      return;
    }
    // DEMO
    const nextStatus = action.dong ? "Đã khắc phục" : action.next;
    setIncidents((prev) => prev.map((i) => i.id === inc.id ? { ...i, status: nextStatus, trail: [...i.trail, { t: now.slice(11), who, act: `${action.label}: ${reason}` }] } : i));
    setAudit((a) => [{ t: now.slice(11, 16) + " 29/5", who, act: action.label, obj: `${inc.id} / ${inc.room}`, detail: reason }, ...a]); setModal(null);
  };
  // NGÕ CỤT đã vá (10/07/2026). Hai lỗi chồng nhau:
  //  1. dungCanhBao() gọi thiếu p_tat ⇒ PostgREST báo hàm không tồn tại ⇒ "Dừng CB"
  //     luôn hiện alert lỗi. lich_su_su_co có 0 dòng dung_canh_bao: chưa từng chạy.
  //  2. Kể cả chạy được, nhánh này chỉ gọi RPC khi CHƯA tắt ⇒ "Bật lại" là no-op.
  // Mà khi da_tat_canh_bao = true, sự cố biến mất khỏi view định tuyến email VÀ khỏi
  // WF6 (dead-man's-switch). Không mail, không leo thang, không ai được báo — và
  // không có đường quay lại. Một cú bấm là im lặng vĩnh viễn.
  // ═══ P0-5 — "DỪNG CẢNH BÁO" KHÔNG ĐƯỢC LÀ CÔNG TẮC VĨNH VIỄN ═══
  // da_tat_canh_bao (boolean, không hạn) làm sự cố biến mất khỏi WF8 VÀ khỏi WF6 —
  // chuông báo tử cũng mù. DB đã xoá RPC đó và chặn cứng cột bằng CHECK.
  // Nay: tạm hoãn CÓ HẠN, bắt buộc lý do, ghi ai hoãn và tới bao giờ, tự cảnh báo lại.
  // CRITICAL hoặc phòng P1 chỉ QA/Quản trị được hoãn — máy chủ tự kiểm, không tin giao diện.
  // ═══ CỤM ĐIỀU TRA (10/07/2026) ═══
  // 24 sự cố đang mở là 12 cụm. Cơ điện không sửa "một phòng", họ sửa một AHU; QA không
  // kết luận "một phiếu", họ kết luận một sai lệch có nguyên nhân gốc và CAPA. Máy chủ ghi
  // một dòng audit cho TỪNG sự cố thuộc cụm — không ai được đóng gộp mà mất dấu vết.
  const cumRows = useMemo(() => (isLive && Array.isArray(live.cumSuCo) ? live.cumSuCo : []), [isLive, live.cumSuCo]);
  // Lọc hai tầng: quyền khu của phiên (khuChoPhep) + bộ lọc Khu/AHU người dùng đang
  // chọn trên tab Sự cố — nếu không, lọc AHU02 mà bảng cụm vẫn bày 12 cụm là lạc nhịp.
  const cumHienThi = useMemo(() => cumRows
    .filter((c) => !khuChoPhep || loKhu(c.khu_vuc))
    .filter((c) => evtKhu === "ALL" || c.khu_vuc === evtKhu)
    .filter((c) => evtAhu === "ALL" || c.ahu === evtAhu), [cumRows, khuChoPhep, evtKhu, evtAhu]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══ Cụm điều tra & Mở lại — trạng thái modal/ngăn kéo ═══
  const [cumKetLuan, setCumKetLuan] = useState(null);   // cụm đang ghi kết luận (modal)
  const [cumChiTiet, setCumChiTiet] = useState(null);   // cụm đang mở ngăn kéo
  const [moLai, setMoLai] = useState(null);             // { row, act } — sự cố đóng đang mở lại
  const [dangGhiCum, setDangGhiCum] = useState(false);
  const [khungDongMo, setKhungDongMo] = useState(false);
  const suCoDongXem = useMemo(() => (isLive && Array.isArray(live.suCoDongGanDay) ? live.suCoDongGanDay : [])
    .filter((r) => !khuChoPhep || loKhu(r.khu_vuc))
    .filter((r) => evtKhu === "ALL" || r.khu_vuc === evtKhu)
    .filter((r) => evtAhu === "ALL" || r.ahu === evtAhu), [isLive, live.suCoDongGanDay, khuChoPhep, evtKhu, evtAhu]); // eslint-disable-line react-hooks/exhaustive-deps

  const ghiKetLuanCum = (cum) => { if (!requireLogin()) return; setCumKetLuan(cum); };
  const luuKetLuanCum = async ({ nguyenNhan, khacPhuc, phongNgua, ketLuan }) => {
    setDangGhiCum(true);
    const { error, data } = await ketLuanCum({ maCum: cumKetLuan.ma_cum, nguyenNhan, khacPhuc, phongNgua, ketLuan });
    setDangGhiCum(false);
    if (error) { alert(error.thong_bao || error.ma_loi || "Không ghi được kết luận"); return; }
    if (data && data.ok === false) { alert(data.thong_bao || data.loi); return; }
    setCumKetLuan(null); setCumChiTiet(null);
    await live.lamMoi({ nen: true });
  };
  const xacNhanMoLai = async (lyDo) => {
    setDangGhiCum(true);
    const { error, data } = await thaoTacSuCo({ dbId: moLai.row.ma_su_co, actionCode: moLai.act.code, lyDo, actorEmail: user.email });
    setDangGhiCum(false);
    if (error) { alert(error.thong_bao || error.ma_loi || "Không mở lại được"); return; }
    if (data && data.ok === false) { alert(data.thong_bao || data.loi); return; }
    setMoLai(null); setKhungDongMo(false);
    await live.lamMoi({ nen: true });
  };

  // Bản in hồ sơ cụm: RPC trả trọn bộ (đã lọc khu ở máy chủ), lib dựng HTML tự chứa.
  const inHoSoCum = async (cum) => {
    const { error, data } = await layHoSoCum(cum.ma_cum);
    if (error || !data || data.ok === false) { alert((data && (data.thong_bao || data.loi)) || error?.thong_bao || "Không tải được hồ sơ cụm"); return; }
    moHoSoCumBanIn(data);
  };

  // ═══ VIỆC CỦA TÔI — hiện trên MỌI tab (10/07/2026) ═══
  // Máy chủ đã tính ai phụ trách (vai_tro_phu_trach); banner chỉ bày đúng phần
  // của người đang đăng nhập. Không thêm truy vấn nào: ghép từ
  // suCoPhuTrach + incidents + cumRows đã nạp sẵn. View đã xếp P1 trước, cũ trước.
  const viecCuaToi = useMemo(() => {
    if (!isLive || !role) return [];
    const qh = Array.isArray(live.suCoPhuTrach) ? live.suCoPhuTrach : [];
    return qh.filter((q) => q.vai_tro_phu_trach === role)
      .map((q) => ({ q, inc: incidentsXem.find((i) => i.dbId === q.ma_su_co) }))
      .filter((x) => x.inc);
  }, [isLive, role, live.suCoPhuTrach, incidentsXem]);
  // 17/07: TẠM TẮT hàng chờ "kết luận điều tra cụm" (user: quá nhiều cụm tồn cũ làm
  // ngập Việc của bạn — sẽ xử lý riêng sau). Bật lại: bỏ `false &&`.
  const cumChoToi = useMemo(() => (false && (role === "QA" || role === "ADMIN") && isLive)
    ? cumRows.filter((c) => !c.da_co_ket_luan_qa && (!khuChoPhep || loKhu(c.khu_vuc)))
    : [], [role, isLive, cumRows, khuChoPhep]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSilence = async (id) => {
    if (!requireLogin()) return;
    const inc = incidents.find((i) => i.id === id);
    if (!isLive || !inc?.dbId) {
      setIncidents((prev) => prev.map((i) => i.id === id ? { ...i, silenced: !i.silenced } : i));
      return;
    }
    if (inc.silenced) {
      const { error, data } = await batLaiCanhBao({ dbId: inc.dbId, lyDo: "Bật lại từ bảng điều khiển", actorEmail: user.email });
      if (error) { alert(error.thong_bao || error.ma_loi || "Lỗi"); return; }
      if (data && data.ok === false) { alert(data.thong_bao || data.loi); return; }
      await live.lamMoi({ nen: true });
      return;
    }
    const lyDo = window.prompt("Lý do tạm hoãn cảnh báo (ít nhất 10 ký tự) — sẽ ghi vào hồ sơ:", "");
    if (lyDo == null) return;
    const phutStr = window.prompt("Tạm hoãn bao nhiêu phút? (15–240)", "60");
    if (phutStr == null) return;
    const phut = Number(phutStr);
    if (!Number.isFinite(phut) || phut < 15) { alert("Thời lượng phải từ 15 phút trở lên."); return; }
    const { error, data } = await tamDungCanhBao({ dbId: inc.dbId, phut, lyDo, actorEmail: user.email });
    if (error) { alert(error.thong_bao || error.ma_loi || "Lỗi"); return; }
    if (data && data.ok === false) { alert(data.thong_bao || data.loi); return; }
    if (data?.thong_bao) alert(data.thong_bao);
    await live.lamMoi({ nen: true });
  };
  const openRoomIncident = (room) => { const inc = incidents.find((i) => i.room === room.id && i.status !== "Đã khắc phục"); if (inc) openApproval(inc); else setRoomModal(room); };

  // ===== CỔNG ĐĂNG NHẬP: chỉ tài khoản đã đăng nhập mới dùng được web (đã loại bỏ demo) =====
  if (isLive && giaoThucLech) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: PAGE_BG }}>
        <div className="max-w-md text-center">
          <div className="mx-auto w-11 h-11 rounded-2xl bg-warning-soft ring-1 ring-warning-line flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-warning" strokeWidth={1.8} />
          </div>
          <h1 className="mt-4 text-lg font-semibold" style={{ color: "var(--text-default)" }}>Bản web không khớp cơ sở dữ liệu</h1>
          <p className="mt-2 text-[13px] text-muted leading-relaxed">
            Trang này chạy hợp đồng <b>{PHIEN_BAN_GIAO_THUC}</b>, còn cơ sở dữ liệu đã ở <b>{giaoThucLech}</b>.
            Một số nút sẽ không hoạt động. Tải lại trang để lấy bản mới nhất.
          </p>
          <button onClick={() => window.location.reload()}
            className="mt-5 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: "var(--primary-solid)" }}>
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  // Chặn TOÀN TRANG khi đang LIVE và chưa đăng nhập. Không còn lối "xem thử demo".
  const canChanDangNhap = isLive && !user;
  if (canChanDangNhap) {
    return <AuthGate />;
  }

  // ═══ P0-3 — KHÔNG MỞ DASHBOARD KHI CHƯA BIẾT VAI TRÒ VÀ KHU ═══
  // theoDoiPhien() phát NGAY một người dùng tối thiểu { role: null } để gỡ khoá Web Locks
  // của supabase-js, rồi mới tra vai trò. Trong khoảng đó khuChoPhep = null nghĩa là
  // KHÔNG lọc khu ở phía trình duyệt. Trên máy dùng chung, người vừa đăng nhập có thể
  // thấy dữ liệu còn lại của tài khoản trước. Nay chặn hẳn màn hình.
  if (isLive && user && !role) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: PAGE_BG }}>
        <div className="max-w-md text-center">
          <div className="mx-auto w-11 h-11 rounded-2xl bg-success-soft ring-1 ring-success-line flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-success" strokeWidth={1.8} />
          </div>
          <h1 className="mt-4 text-lg font-semibold" style={{ color: "var(--text-default)" }}>Đang xác minh quyền truy cập</h1>
          <p className="mt-2 text-[13px] text-muted leading-relaxed">
            {user.dangTaiVaiTro
              ? <>Đang tra vai trò và khu được xem của <b>{user.email}</b>. Bảng điều khiển chỉ mở sau khi xác minh xong.</>
              : <>Tài khoản <b>{user.email}</b> chưa được phân quyền, hoặc đã bị khoá. Liên hệ Quản trị để được gán vai trò và khu.</>}
          </p>
          {!user.dangTaiVaiTro && (
            <button onClick={() => { setUser(null); if (isLive) authDangXuat(); }}
              className="mt-5 rounded-xl bg-subtle px-4 py-2 text-sm font-medium text-body">Đăng xuất</button>
          )}
        </div>
      </div>
    );
  }

  // ═══ CHẾ ĐỘ THAO TÁC NHẸ (mở web từ nút trong email) ═══
  // Đã đăng nhập + có vai trò + mở từ email và CHƯA chủ động vào dashboard → chỉ dựng
  // màn thao tác nhẹ (soi phiếu + xác nhận + kết quả). useLiveData đã tắt (batDau=false) nên
  // KHÔNG có tải nặng nào chạy. Bấm nhiều nút email = nhiều tab nhẹ, hết lag & hết đá phiên.
  if (isLive && user && role && cheDoThaoTac) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: PAGE_BG }}>
        <div className="max-w-md w-full">
          <div className="rounded-2xl bg-surface ring-1 ring-line p-6 text-center" style={cardShadow}>
            <div className="flex items-center gap-3 justify-center">
              <div className="rounded-2xl bg-surface px-2 ring-1 ring-line flex items-center justify-center h-11 w-11 shrink-0"><CpcLogo className="h-8 w-8" /></div>
              <div className="text-left min-w-0">
                <h1 className="text-sm font-bold leading-tight" style={{ color: "var(--text-strong)" }}>Thao tác sự cố từ email</h1>
                <p className="text-[12px] text-muted truncate">{user.email}</p>
              </div>
            </div>
            <p className="mt-4 text-[13px] text-muted leading-relaxed">
              {veEmail
                ? "Đang mở liên kết thao tác từ email…"
                : "Đã xử lý xong liên kết. Bạn có thể mở bảng điều khiển để xem chi tiết, hoặc đóng tab này."}
            </p>
            <button onClick={() => setVaoDashboard(true)}
              className="mt-5 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: "var(--primary-solid)" }}>
              Mở bảng điều khiển
            </button>
            <p className="mt-3 text-[12px] text-muted leading-relaxed">
              Mẹo: mỗi nút trong email chỉ cần bấm MỘT lần. Trang này cố tình gọn nhẹ để bấm
              nhiều nút không làm chậm web hay rớt đăng nhập.
            </p>
          </div>
        </div>
        {veEmail && <ModalVeEmail trangThai={veEmail} onDong={dongVe} onChay={chayVe} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: PAGE_BG, color: "var(--text-default)", fontFamily: "'Inter','Montserrat',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute -top-40 -left-24 w-[28rem] h-[28rem] rounded-full bg-info-soft opacity-15 blur-3xl" /><div className="absolute top-32 right-0 w-96 h-96 rounded-full bg-success-soft opacity-10 blur-3xl" /><div className="absolute bottom-0 left-1/4 w-[30rem] h-[30rem] rounded-full bg-info-soft opacity-20 blur-3xl" /></div>

      <div className="relative max-w-[1400px] mx-auto px-6 py-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-2xl bg-surface px-2.5 ring-1 ring-line flex items-center justify-center h-[50px] w-[50px] shrink-0" style={cardShadow}><CpcLogo className="h-10 w-10" /></div>
            <div className="flex flex-col justify-center min-w-0"><h1 className="text-base sm:text-lg font-bold tracking-tight leading-tight truncate" style={{ color: "var(--text-strong)" }}>Hệ thống giám sát HVAC phòng sạch GMP</h1><p className="text-[12px] font-semibold tracking-wide mt-0.5" style={{ color: "var(--primary)" }}>V/Q team — QLCL</p></div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap justify-end ml-auto">
            {isLive && <SucKhoeWidget sk={live.sucKhoe} dangTai={live.dangTai} />}
            {user ? <div className="flex items-center gap-2.5 rounded-2xl bg-surface pl-2 pr-2 ring-1 ring-line h-[50px]" style={cardShadow}><div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-semibold" style={{ background: "var(--primary-solid)" }}>{user.name[0]}</div><div className="leading-tight"><p className="text-xs font-semibold" style={{ color: "var(--text-default)" }}>{user.name}</p><p className="text-[12px] font-medium" style={{ color: "var(--primary)" }}>{ROLE_VI[user.role] || user.role}</p></div><button onClick={() => setPwOpen(true)} className="ml-1 rounded-lg p-1.5 hover:bg-subtle text-muted" title="Đổi mật khẩu"><KeyRound className="w-4 h-4" strokeWidth={1.8} /></button><button onClick={() => { setUser(null); if (isLive) authDangXuat(); }} className="rounded-lg p-1.5 hover:bg-subtle text-muted" title="Đăng xuất"><LogOut className="w-4 h-4" strokeWidth={1.8} /></button></div>
              : <button onClick={() => setLoginOpen(true)} className="flex items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white h-[50px]" style={{ background: "var(--primary-solid)", ...cardShadow }}><LogIn className="w-4 h-4" strokeWidth={1.8} /> Đăng nhập</button>}
          </div>
        </header>

        {/* Mobile: tab TỰ XUỐNG DÒNG (không kéo ngang); desktop giữ 1 hàng cuộn. */}
        <nav className="mt-5"><div className="rounded-2xl bg-surface/80 backdrop-blur ring-1 ring-line p-1.5 flex gap-1 flex-wrap md:flex-nowrap md:overflow-x-auto" style={cardShadow}>{visibleTabs.map((t) => { const Icon = t.icon; const active = tab === t.k; return <button key={t.k} onClick={() => setTab(t.k)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition ${active ? "text-white" : "text-body hover:bg-subtle"}`} style={active ? { background: "var(--primary-solid)", boxShadow: "0 6px 16px -6px rgba(20,158,144,0.55)" } : {}}><Icon className="w-4 h-4" strokeWidth={1.8} /> {t.label}{t.k === "events" && <span className="ml-0.5 text-[12px] px-1.5 py-0.5 rounded-full font-bold" style={active ? { background: "rgba(255,255,255,0.25)" } : { background: "rgba(226,103,79,0.16)", color: "var(--danger)" }}>{p12Open}</span>}</button>; })}</div></nav>

        {/* G3: chip kỹ thuật hạ xuống 1 dòng meta — hero mới là anchor duy nhất */}
        <div className="mt-2 px-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] meta">
          <button onClick={doiBannerLive} className="hover:underline" title="Bấm để hiện/ẩn dòng mô tả nguồn dữ liệu">
            Trạng thái đồng bộ: {HAS_SUPABASE ? <b className="text-success">Dữ liệu trực tiếp</b> : <b className="text-warning">Chế độ thử nghiệm</b>}
          </button>
          <span>Toàn vẹn dữ liệu: {(kpis.thieuDL || 0) === 0 ? <b className="text-success">đầy đủ</b> : <b className="text-warning">{kpis.thieuDL} phòng thiếu DL</b>}</span>
          <span className="inline-flex items-center gap-1">Giờ máy chủ (UTC+7): <ServerClock live={isLive} /></span>
        </div>

        <main className="mt-6">
          {isLive && (!anBannerLive || live.loi) && (
            <div className="mb-4 flex items-start gap-2 rounded-2xl bg-success-soft ring-1 ring-success-line px-4 py-2.5 text-[12px] text-body">
              <Wifi className="w-4 h-4 mt-0.5 text-success shrink-0" strokeWidth={1.8} />
              <span className="flex-1">Đang đọc/ghi dữ liệu thật từ Supabase cho <b>tất cả các tab</b> (Tổng quan · Sự cố · Phòng · Xu hướng · Báo cáo · Nhật ký). <b>Xu hướng &amp; Rủi ro</b> tính trực tiếp từ dữ liệu theo giờ (luôn có sẵn); riêng <b>Báo cáo AI</b> tổng hợp theo ngày sẽ đầy đủ dần khi WF rollup chạy.{live.loi && <span className="text-danger"> · Lỗi tải: {live.loi.thong_bao || live.loi.message || "kết nối"}</span>}{live.capNhatLuc && !live.loi && <span className="text-muted"> · Cập nhật {live.capNhatLuc.toLocaleTimeString("vi-VN")}</span>}</span>
              {!live.loi && (
                <button onClick={doiBannerLive} title="Ẩn dòng này cho gọn — bấm ô 'Nguồn dữ liệu' trên đầu trang để hiện lại"
                  className="shrink-0 rounded-lg px-1.5 py-0.5 text-muted hover:bg-success-soft/60 hover:text-body text-[13px] leading-none">✕</button>
              )}
            </div>
          )}
          {/* 16/07 (user): TẠM ẨN banner "Việc của bạn" — chưa cần trong giai đoạn triển khai.
              Bật lại: đổi HIEN_VIEC_CUA_BAN = true (component + dữ liệu giữ nguyên). */}
          {HIEN_VIEC_CUA_BAN && isLive && user && role && <ViecCuaBan viecCuaToi={viecCuaToi} cumChoToi={cumChoToi} onXuLy={openApproval} onGhiKetLuan={ghiKetLuanCum} />}
          {tab === "home" && (
            <div className="space-y-5">
              <StatusAnchor p12Open={p12Open} kpis={kpis} matNguon={matNguon} isLive={isLive} capNhatLuc={live && live.capNhatLuc} khuChoPhep={khuChoPhep} onXemSuCo={() => setTab("events")} />
              {!user && <div className="inline-flex items-center gap-2 text-xs text-warning bg-warning-soft ring-1 ring-warning-line px-3 py-1.5 rounded-xl font-medium"><LogIn className="w-3.5 h-3.5" strokeWidth={1.8} /> Đăng nhập để thao tác theo phân quyền.</div>}
              {/* 12/08 — BĂNG MẤT NGUỒN ĐẦU TRANG. Sự cố 09:39 (FMS + n8n cùng câm) cho thấy
                  người trực mở trang ra là thấy ngay các ô KPI đầy số, phải cuộn xuống thẻ
                  chênh áp mới biết nguồn đã chết. Trạng thái nguồn phải nằm TRÊN mọi con số
                  mà nó chi phối, không phải nấp trong tooltip của đèn header. */}
              {matNguon && (
                <div className="rounded-2xl bg-danger-soft px-4 sm:px-5 py-3.5 ring-1 ring-danger-line">
                  <p className="text-[13px] font-bold text-danger flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 shrink-0" strokeWidth={2} /> MẤT NGUỒN SỐ LIỆU — các con số bên dưới KHÔNG phản ánh hiện tại
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-danger">
                    {skTomTat || "Nguồn dữ liệu không cập nhật."} Hệ <b>không kết luận đạt/không đạt</b> trên số đã cũ — mọi phòng chuyển sang ô “Thiếu dữ liệu”.
                    Kiểm FMS và n8n ngay: nguồn treo thì phải có người khởi động lại, hệ không tự khỏi.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between px-1"><SectionTitle icon={Clock} hint="khung giờ chốt gần nhất · cập nhật theo giờ">Tổng quan trạng thái — 1 giờ gần nhất</SectionTitle></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={CheckCircle2} label="Phòng đạt" value={matNguon ? "—" : kpis.dat} total={matNguon ? null : kpis.tong} sub={matNguon ? "mất nguồn — không kết luận" : "tuân thủ ≥ 80% (1h)"} accent={{ txt: "text-success", bg: "bg-success-soft", glow: "bg-success-soft" }} onClick={() => setKpiModal("dat")} loading={kpiLoading} />
                <KpiCard icon={AlertTriangle} label="Phòng không đạt" value={matNguon ? "—" : kpis.khongDat} total={matNguon ? null : kpis.tong} sub={matNguon ? "mất nguồn — không kết luận" : "tuân thủ < 80%"} accent={{ txt: "text-danger", bg: "bg-danger-soft", glow: "bg-danger-soft" }} onClick={() => setKpiModal("khong")} loading={kpiLoading} />
                <KpiCard icon={HelpCircle} label="Thiếu dữ liệu" value={kpis.thieuDL} total={kpis.tong} sub="không coi là đạt" accent={{ txt: "text-warning", bg: "bg-warning-soft", glow: "bg-warning-soft" }} onClick={() => setKpiModal("thieu")} loading={kpiLoading} />
                <KpiCard icon={Activity} label="Sự cố Nghiêm trọng mở" value={p12Open} sub="phòng trọng yếu & quan trọng" accent={{ txt: "text-info", bg: "bg-info-soft", glow: "bg-info-soft" }} onClick={() => setKpiModal("p1")} loading={kpiLoading} />
              </div>
              {/* Chú thích cách tính — tránh hiểu nhầm "phòng nhìn đẹp mà vẫn không đạt" */}
              <p className="text-[12px] text-muted px-1 leading-relaxed -mt-2">
                <b className="text-muted">Cách tính:</b> tuân thủ của phòng = 100% − %thời gian ngoài khoảng (OOS) của <b className="text-muted">cảm biến kém nhất</b> (DP/RH/T) trong <b className="text-muted">khung giờ chốt gần nhất</b> — chỉ cần một chỉ tiêu lệch là cả phòng bị tính không đạt, dù các chỉ tiêu khác vẫn đẹp. Phòng <b className="text-muted">đạt</b> khi tuân thủ ≥ 80% <b className="text-muted">và</b> dữ liệu còn tươi (chốt giờ cách hiện tại ≤ {Math.round(FRESH_MIN / 60)}h); phòng thiếu dữ liệu/dữ liệu quá cũ không được tính là đạt.{khuChoPhep ? <> Số liệu tính trong phạm vi được xem của tài khoản: <b className="text-muted">khu {khuChoPhep.join(", ")}</b>.</> : null}
              </p>
              <TheDungHinhTongQuan isLive={isLive} khuChoPhep={khuChoPhep} onXemChiTiet={roleCanSeeTab(role, "sensors") ? () => setTab("sensors") : null} />
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
                <div><div className="flex items-center justify-between mb-3 px-1 flex-wrap gap-2"><SectionTitle icon={CircleDot} hint={xemTatCaPhong ? "tất cả phòng" : "chỉ ưu tiên 1 & 2"}>Phòng trọng điểm cần theo dõi</SectionTitle><div className="flex items-center gap-2"><div className="flex rounded-xl ring-1 ring-line overflow-hidden text-[12px] font-medium"><button onClick={() => setXemTatCaPhong(false)} className={`px-2.5 py-1 ${!xemTatCaPhong ? "text-white" : "text-muted bg-surface hover:bg-subtle"}`} style={!xemTatCaPhong ? { backgroundColor: "var(--primary-solid)" } : {}}>Ưu tiên 1 &amp; 2</button><button onClick={() => setXemTatCaPhong(true)} className={`px-2.5 py-1 ${xemTatCaPhong ? "text-white" : "text-muted bg-surface hover:bg-subtle"}`} style={xemTatCaPhong ? { backgroundColor: "var(--primary-solid)" } : {}}>Tất cả</button></div><span className="text-[12px] text-muted">{phongHienThi.length}/{roomsXem.length} phòng</span></div></div>{phongHienThi.length === 0 ? <Card className="p-6 text-center text-[13px] text-muted">{xemTatCaPhong ? "Chưa có phòng nào." : "Không có phòng ưu tiên 1 hoặc 2 nào đang hoạt động."}</Card> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{phongHienThi.map((r) => <RoomCard key={r.id} room={r} cfg={cfg} onDetail={setRoomModal} onIncident={openRoomIncident} incident={incidentsXem.find((i) => i.room === r.id && i.status !== "Đã khắc phục") || null} />)}</div>}</div>
                <aside className="space-y-5">
                  {isLive ? (
                  <Card className="p-5" style={{ background: "var(--bg-subtle)" }}><div className="flex items-center justify-between"><SectionTitle icon={Sparkles}>Tóm tắt hệ thống</SectionTitle>{live.capNhatLuc && !live.loi && <span className="text-[12px] text-muted">Cập nhật {live.capNhatLuc.toLocaleTimeString("vi-VN")}</span>}</div><p className="mt-3 text-[13px] leading-relaxed text-body">{matNguon ? <><b className="text-danger">MẤT NGUỒN SỐ LIỆU.</b> {skTomTat || ""} Không kết luận đạt/không đạt cho {kpis.tong} phòng cho tới khi nguồn trở lại.{p12Open > 0 && <> Còn <b className="text-danger">{p12Open}</b> sự cố Nghiêm trọng đang mở.</>}</> : live.kpis ? <>Đang giám sát <b style={{ color: "var(--text-strong)" }}>{kpis.tong}</b> phòng: <span className="text-success font-semibold">{kpis.dat} đạt</span> · <span className="text-danger font-semibold">{kpis.khongDat} không đạt</span> · <span className="text-warning font-semibold">{kpis.thieuDL} thiếu DL</span>. {p12Open > 0 ? <><b className="text-danger">{p12Open}</b> sự cố Nghiêm trọng đang mở — ưu tiên xử lý.</> : "Không có sự cố Nghiêm trọng đang mở."}</> : (live.loi ? "Không tải được dữ liệu — kiểm tra kết nối/đăng nhập." : "Đang tải dữ liệu…")}</p><p className="mt-2 text-[12px] text-muted">Nhận định hỗ trợ chi tiết ở tab Báo cáo · Xu hướng & tuân thủ.</p></Card>
                  ) : (
                  <Card className="p-5" style={{ background: "var(--bg-subtle)" }}><div className="flex items-center justify-between"><SectionTitle icon={Sparkles}>Nhận định hỗ trợ</SectionTitle><span className="inline-flex items-center gap-1 text-[12px] font-semibold text-danger bg-danger-soft px-2 py-1 rounded-full"><TrendingDown className="w-3 h-3" strokeWidth={2} /> Δ 7 ngày −6%</span></div><p className="mt-3 text-[13px] leading-relaxed text-body"><span className="font-semibold" style={{ color: "var(--text-strong)" }}>AHU-K01</span> cần kiểm tra ưu tiên — C4.R7, C4.R1 đều kém, nghi lỗi quạt/filter.</p></Card>
                  )}
                  <Card className="p-5"><SectionTitle icon={Bell}>Cảnh báo hệ thống</SectionTitle><div className="space-y-2 mt-3">{duLieuLoi ? <div className="rounded-2xl bg-danger-soft ring-1 ring-danger-line px-3 py-3 text-[12px] text-danger"><b>Không xác minh được trạng thái hệ thống.</b><p className="text-[12px] text-danger/80 mt-1">Máy chủ không trả lời. Đây KHÔNG có nghĩa là hệ thống đang bình thường — hãy kiểm tra n8n và Supabase.</p></div> : systemAlerts === null ? <div className="h-20 rounded-2xl bg-subtle animate-pulse" />  : systemAlerts.length === 0 ? <p className="text-[12px] text-muted py-2">Không có cảnh báo hệ thống nào.</p>  : systemAlerts.map((a, i) => { const Icon = a.icon || ICON_CANH_BAO(a); return <div key={i} className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 ${STATUS[a.kind].bg} ring-1 ring-line/60`}><Icon className={`w-4 h-4 mt-0.5 shrink-0 ${STATUS[a.kind].txt}`} strokeWidth={1.8} /><div className="leading-tight"><p className="text-xs text-body font-medium">{a.text}</p><p className="text-[12px] text-muted mt-0.5">{a.sub}</p></div></div>; })}</div></Card>
                </aside>
              </div>
            </div>
          )}

          {/* ═══ TAB NHIỆM VỤ (17/07 — yêu cầu user: "ai cũng thấy") ═══
              Phiếu đang ở bộ phận nào, ai quá thời hạn (KiemSoatXuLy — mọi vai trò đều xem
              được) + danh sách việc đang chờ đúng vai trò của mình, bấm xử lý ngay. */}
          {tab === "tasks" && (
            <div className="space-y-5">
              <SectionTitle icon={ClipboardList} hint={user ? `vai trò: ${ROLE_VI[role] || "chưa phân quyền"}` : "đăng nhập để thao tác"}>Công việc cần xử lý</SectionTitle>
              {isLive && Array.isArray(live.suCoPhuTrach) && live.suCoPhuTrach.length === 0 && (
                <Card className="p-6 text-center"><CheckCircle2 className="mx-auto w-7 h-7" style={{ color: "var(--primary)" }} strokeWidth={1.8} /><p className="mt-2 text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>Không có phiếu nào đang mở</p><p className="mt-1 text-[12px] text-muted">Tất cả sự cố đã được xử lý hoặc hệ đã tự đóng.</p></Card>
              )}
              <KiemSoatXuLy rows={isLive ? (live.suCoPhuTrach || []) : []} />
              {isLive && user && role && (
                <Card className="p-4 sm:p-5">
                  <SectionTitle icon={User} hint="các phiếu đang chờ đúng vai trò của bạn bấm nút — bấm Xử lý để thao tác ngay">Việc của bạn — {ROLE_VI[role] || role}</SectionTitle>
                  {viecCuaToi.length === 0 && cumChoToi.length === 0 ? (
                    <p className="mt-3 text-[13px] text-muted">Không có phiếu nào đang chờ vai trò của bạn. 👍</p>
                  ) : (
                    <div className="mt-3 space-y-1.5">
                      {viecCuaToi.map(({ q, inc }) => (
                        <div key={q.ma_su_co} className="flex items-center justify-between gap-3 rounded-xl bg-subtle px-3 py-2">
                          <span className="min-w-0 text-[12.5px] text-body truncate">
                            <b style={{ color: "var(--text-strong)" }}>{inc.id}</b> · {inc.room} · {inc.sensor}
                            <span className={`ml-2 ${q.dang_cham ? "text-danger font-medium" : "text-muted"}`}>{q.dang_cham ? `im lặng ${fmtPhut(q.phut_im_lang)}/${fmtPhut(q.nguong_phut)}${q.da_bao_truc ? " · đã lên Trực" : ""}` : `mở ${q.gio_mo}h · trong nhịp`}</span>
                          </span>
                          <button onClick={() => openApproval(inc)} className="shrink-0 rounded-lg bg-surface px-3 py-1.5 text-[12px] font-semibold text-success ring-1 ring-success-line hover:bg-success-soft">Xử lý</button>
                        </div>
                      ))}
                      {cumChoToi.map((c) => (
                        <div key={c.ma_cum} className="flex items-center justify-between gap-3 rounded-xl bg-subtle px-3 py-2">
                          <span className="min-w-0 text-[12.5px] text-body truncate">
                            <b style={{ color: "var(--text-strong)" }}>{c.ma_hien_thi}</b> · {c.ahu || "?"} · {c.loai_cam_bien}
                            <span className="ml-2 text-warning">chưa có kết luận điều tra</span>
                          </span>
                          <button onClick={() => ghiKetLuanCum(c)} className="shrink-0 rounded-lg bg-surface px-3 py-1.5 text-[12px] font-semibold text-warning ring-1 ring-warning-line hover:bg-warning-soft">Ghi kết luận</button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
              <DanhGiaHieuQuaCanhBao isLive={isLive} />
              <HuongDanEmailNut />
              <Card className="p-4 sm:p-5">
                <SectionTitle icon={GitBranch} hint="mỗi bộ phận một làn · mũi tên mang màu người bấm nút · kéo ngang để xem hết">Sơ đồ vòng đời chi tiết — ai làm gì, lúc nào</SectionTitle>
                <div className="mt-3">
                  <React.Suspense fallback={<div className="rounded-2xl bg-subtle animate-pulse" style={{ height: 420 }} />}>
                    <SoDoVongDoi />
                  </React.Suspense>
                </div>
              </Card>
              {!isLive && <Card className="p-6 text-center text-[13px] text-muted">Tab Nhiệm vụ chỉ hoạt động ở chế độ LIVE (đọc dữ liệu thật).</Card>}
            </div>
          )}

          {tab === "events" && (() => {
            const metaPhong = {}; (rooms || []).forEach((r) => { metaPhong[r.id] = { area: r.area, ahu: r.ahu }; });
            const incKhu = (i) => i.khu || (metaPhong[i.room] || {}).area || "";
            const incAhu = (i) => (metaPhong[i.room] || {}).ahu || "";
            // Cặp khu|AHU (AHU01 có ở cả C1 lẫn C4 nên tên AHU trần là nhập nhằng);
            // đứng ở "Tất cả" vẫn chọn được AHU — chọn phát là áp luôn cả khu.
            const ahuPairs = [...new Set((roomsXem || []).filter((r) => (evtKhu === "ALL" || r.area === evtKhu) && r.ahu).map((r) => `${r.area}|${r.ahu}`))].sort();
            const incFiltered = incidentsXem.filter((i) => (evtKhu === "ALL" || incKhu(i) === evtKhu) && (evtAhu === "ALL" || incAhu(i) === evtAhu));
            // Gom theo AHU — khớp cách email của Cơ điện được gom (mỗi AHU một mail),
            // nên đối chiếu web ↔ email không lệch. Thứ tự NHÓM: AHU chứa phòng quan
            // trọng nhất (P1) đang gặp sự cố lên đầu, đồng hạng thì nhiều CRITICAL hơn
            // lên trước; trong nhóm: P1 → P2 → P3, rồi theo lúc bắt đầu.
            const uuTienSo = (p) => (p === "P1" ? 1 : p === "P2" ? 2 : 3);
            const cumAhu = (i) => `${incKhu(i) || "?"} / ${incAhu(i) || "Không rõ AHU"}`;
            const hangCum = {};
            incFiltered.forEach((i) => {
              const k = cumAhu(i); const h = hangCum[k] || (hangCum[k] = { min: 9, crit: 0 });
              h.min = Math.min(h.min, uuTienSo(i.priority));
              if (i.mucCanhBao === "CRITICAL") h.crit++;
            });
            const incSorted = [...incFiltered].sort((a, b) => {
              const ka = cumAhu(a), kb = cumAhu(b);
              if (ka !== kb) return hangCum[ka].min - hangCum[kb].min || hangCum[kb].crit - hangCum[ka].crit || ka.localeCompare(kb);
              return uuTienSo(a.priority) - uuTienSo(b.priority) || String(a.start).localeCompare(String(b.start));
            });
            const dsNut = isLive ? live.nutThaoTac : null;
            // luatSanSang = ĐÃ BIẾT bộ luật (mảng, kể cả rỗng). null = đang tải hoặc lỗi.
            const luatSanSang = Array.isArray(dsNut) && dsNut.length > 0;
            const luatHong = isLive && (dsNut === null || !!live.loiNut);
            const locChip = (v, label, on, click) => <button key={v} onClick={click} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition ring-1 ${on ? "text-white ring-transparent" : "text-body bg-surface ring-line hover:ring-success-line"}`} style={on ? { backgroundColor: "var(--primary-solid)" } : {}}>{label}</button>;
            // Nút hành động của 1 sự cố — DÙNG CHUNG cho bảng (desktop) và thẻ (mobile)
            // để 2 giao diện không bao giờ lệch luật.
            const tinhNut = (inc) => {
              const acts = luatSanSang ? nutKhopTrangThai(dsNut, inc.statusCode)
                         : isLive ? [] : (STATUS_ACTIONS[inc.status] || []);
              const terminal = luatSanSang || !isLive ? acts.length === 0 : false;
              const myActs = !user ? [] : luatSanSang ? nutChoVaiTro(dsNut, inc.statusCode, role)
                         : isLive ? [] : acts.filter((a) => a.roles.includes(role));
              const choAi = luatSanSang ? [...new Set(acts.map((a) => a.vai_tro))]
                         : isLive ? [] : rolesOfStatus(inc.status);
              return { acts, terminal, myActs, choAi };
            };
            // 12/08 — TUỔI SỐ LIỆU PHẢI ĐỨNG NGANG HÀNG VỚI MỨC CẢNH BÁO khi mất nguồn.
            // Phiếu SC-4177 hô CRITICAL bằng số đo lúc 08:00 (186 phút trước): chữ CRITICAL
            // to và đỏ, còn tuổi số liệu là chữ xám nhỏ cuối dòng ⇒ người trực đọc lướt
            // tưởng phòng ĐANG lệch ngay lúc này. Sự thật là KHÔNG BIẾT — có thể tệ hơn,
            // có thể đã về đạt. Mất nguồn thì nhãn hiện với MỌI tuổi, không chờ quá 75′.
            const nhanSoCu = (inc) => {
              const t = inc.tuoiDuLieuPhut;
              if (t == null || (!matNguon && t <= 75)) return null;
              const txt = t < 60 ? `${t} PHÚT` : `${(t / 60).toFixed(1)} GIỜ`;
              // G3: độ tươi là TRỤC RIÊNG, tách khỏi mức nghiêm trọng — badge màu "thiếu
              // dữ liệu" (không phải warning) + nói thẳng: hiện trạng chưa thể xác nhận.
              return <span title="Số đo cuối cùng lấy được. Nguồn đang mất nên KHÔNG khẳng định được tình trạng hiện tại của phòng — có thể đã nặng hơn, có thể đã về đạt." className="ml-1.5 align-middle inline-block rounded-md bg-missing-soft px-1.5 py-0.5 text-[12px] font-bold text-missing ring-1 ring-[var(--missing)] whitespace-nowrap">DỮ LIỆU CŨ · {txt}</span>;
            };
            return (
            <div className="space-y-5">
              <SectionTitle icon={AlertOctagon} hint={user ? `vai trò: ${ROLE_VI[role]}` : "đăng nhập để thao tác"}>Sự cố đang xử lý</SectionTitle>
              {/* Phiếu VẪN hiện khi mất nguồn là ĐÚNG — mất dữ liệu không xoá được sự kiện đã
                  xảy ra, đóng phiếu vì hết dữ liệu là làm mất hồ sơ GMP (bài học 14/07). Cái
                  phải nói rõ là: mức đang hiện dựa trên số CŨ, và khoảng mù này KHÔNG mở
                  được phiếu mới vì WF1 không chạy. */}
              {matNguon && (
                <div className="rounded-2xl bg-danger-soft px-4 sm:px-5 py-3.5 ring-1 ring-danger-line">
                  <p className="text-[13px] font-bold text-danger flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 shrink-0" strokeWidth={2} /> MẤT NGUỒN SỐ LIỆU — mức cảnh báo bên dưới dựa trên số đo CŨ
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-danger">
                    {skTomTat || "Nguồn dữ liệu không cập nhật."} Phiếu đang mở <b>vẫn giữ nguyên</b> (sự cố đã xảy ra là có thật, hệ không tự đóng khi thiếu dữ liệu),
                    nhưng <b>không khẳng định được phòng hiện giờ ra sao</b> — có thể đã nặng hơn, có thể đã về đạt.
                    Nguy hơn: trong lúc mất nguồn hệ <b>không mở được phiếu mới</b>, phòng lệch chuẩn lúc này sẽ không có ai báo.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-semibold text-muted uppercase tracking-wider mr-1">Lọc khu</span>
                {locChip("ALL", "Tất cả", evtKhu === "ALL", () => { setEvtKhu("ALL"); setEvtAhu("ALL"); })}
                {(khuChoPhep || DS_KHU).map((k) => locChip(k, `Khu ${k}`, evtKhu === k, () => { setEvtKhu(k); setEvtAhu("ALL"); }))}
                {ahuPairs.length > 0 && (
                  <select value={evtAhu === "ALL" ? "ALL" : `${evtKhu}|${evtAhu}`} onChange={(e) => { const v = e.target.value; if (v === "ALL") { setEvtAhu("ALL"); } else { const [k, a] = v.split("|"); setEvtKhu(k); setEvtAhu(a); } }} className="rounded-xl bg-surface ring-1 ring-line px-3 py-1.5 text-[12px] text-body outline-none ml-1">
                    <option value="ALL">AHU: tất cả</option>
                    {ahuPairs.map((p) => { const [k, a] = p.split("|"); return <option key={p} value={p}>{evtKhu === "ALL" ? `Khu ${k} · ${a}` : a}</option>; })}
                  </select>
                )}
                <span className="text-[12px] text-muted ml-auto tabular-nums">{incFiltered.length}/{incidentsXem.length} sự cố</span>
              </div>
              <Card className="p-2 sm:p-4">{isLive && live.dangTai && incidentsXem.length === 0 ? (
                /* ĐANG TẢI + chưa có gì: skeleton — không được hiện "Chưa có sự cố nào"
                   khi thật ra là đang chờ mạng (15/07: gây hiểu lầm hệ trống phiếu). */
                <div className="p-2 space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-subtle animate-pulse" />)}</div>
              ) : incFiltered.length === 0 ? (incidentsXem.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "#E6F4F1" }}><CheckCircle2 className="w-6 h-6" style={{ color: "var(--primary)" }} strokeWidth={1.8} /></div>
                  <p className="mt-3 text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>Chưa có sự cố nào đang mở</p>
                  <p className="mt-1.5 text-[12px] text-muted max-w-md mx-auto leading-relaxed">Sự cố được <b>tự động tạo</b> khi luồng n8n (WF1) phát hiện mức <b className="text-warning">Cảnh báo</b> hoặc <b className="text-danger">Hành động</b> từ dữ liệu theo giờ và ghi vào Supabase. Danh sách trống nghĩa là tất cả phòng đang trong ngưỡng — hoặc chưa có dữ liệu kích hoạt.</p>
                  {isLive && <p className="mt-3 text-[12px] text-muted max-w-md mx-auto">Nếu bạn chắc chắn đang có cảnh báo mà vẫn trống, kiểm tra: WF1 có đang chạy theo lịch · ngưỡng trong <b>Cài đặt</b> · và bạn đã <b>đăng nhập</b> đúng vai trò để xem.</p>}
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-[13px] text-muted">Không có sự cố khớp bộ lọc{evtKhu !== "ALL" ? ` · Khu ${evtKhu}` : ""}{evtAhu !== "ALL" ? ` · ${evtAhu}` : ""}. <button onClick={() => { setEvtKhu("ALL"); setEvtAhu("ALL"); }} className="text-success font-semibold underline">Bỏ lọc</button></div>
              )) : (<>
              {/* ═══ MOBILE (<md): thẻ dọc — KHÔNG kéo ngang ═══ */}
              <div className="md:hidden space-y-2 p-1">
                {incSorted.map((inc, idx) => {
                  const { terminal, myActs, choAi } = tinhNut(inc);
                  const q = phuTrachTheoId[inc.dbId];
                  const moCum = idx === 0 || cumAhu(incSorted[idx - 1]) !== cumAhu(inc);
                  return (
                    <React.Fragment key={inc.id}>
                      {moCum && <p className="pt-2 pb-0.5 px-1 text-[12px] font-semibold uppercase tracking-wider text-muted">{cumAhu(inc)}</p>}
                      <div className={`rounded-2xl ring-1 ring-line bg-surface p-3 ${inc.silenced ? "opacity-60" : ""}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate"><b style={{ color: "var(--text-strong)" }}>{inc.id}</b><span className="text-body"> · {inc.room}</span>{inc.cumHienThi && <span className="ml-1.5 rounded-lg bg-subtle px-1.5 py-0.5 text-[12px] font-medium text-muted tabular-nums">{inc.cumHienThi}</span>}</span>
                          <span className="shrink-0 flex items-center gap-1.5"><MucBadge p={inc.priority} /><span className="text-[12px] text-warning font-medium tabular-nums">{inc.duration}h</span></span>
                        </div>
                        <p className="mt-1 text-[12px] text-body">
                          {inc.sensor}{inc.huong && <span className={`ml-1 text-[12px] font-semibold px-1.5 py-0.5 rounded ${inc.huong === "CAO" ? "bg-danger-soft text-danger" : inc.huong === "THAP" ? "bg-info-soft text-info" : "bg-warning-soft text-warning"}`}>{inc.huong === "CAO" ? "↑ cao" : inc.huong === "THAP" ? "↓ thấp" : "↕ cả 2"}</span>}
                          {inc.mucCanhBao === "SUPPRESSED" && <span className="ml-1.5 rounded-lg bg-subtle px-1.5 py-0.5 text-[12px] font-medium text-muted">cảm biến đứng hình</span>}
                          {nhanSoCu(inc)}
                        </p>
                        {inc.giaTriGanNhat != null && <p className="text-[12px] text-muted mt-0.5">TB 5′ cuối <b className="text-body tabular-nums">{inc.giaTriGanNhat}{inc.donVi}</b>{inc.gioiHanDuoi != null && <> · yêu cầu <span className="tabular-nums">{inc.gioiHanDuoi}–{inc.gioiHanTren}</span></>}{(inc.mucGanNhat === "NORMAL" || inc.mucGanNhat === "WARNING") && <span className="text-success"> · đã về ngưỡng</span>}</p>}
                        {nhanSoCu(inc) && <p className="text-[12px] text-missing mt-0.5">Hiện trạng thực tế: <b>chưa thể xác nhận</b> — phiếu sự cố vẫn đang mở.</p>}
                        <p className="mt-1.5 text-[12px] flex items-center gap-1.5 flex-wrap">
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[inc.status]}`} /><span className="text-body font-medium">{inc.status}</span>
                          {q && <span className={`text-[12px] ${q.dang_cham ? "text-danger font-medium" : "text-muted"}`}>· {tenVaiTro(q.vai_tro_phu_trach, inc.room)}{q.dang_cham ? ` im lặng ${fmtPhut(q.phut_im_lang)}/${fmtPhut(q.nguong_phut)}${q.da_bao_truc ? " · đã báo Trực" : ""}` : " phụ trách"}</span>}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {terminal ? <span className="text-success text-[12px] font-medium py-1">Đã khắc phục</span>
                            : !user ? <button onClick={() => setLoginOpen(true)} className="text-[12px] font-medium rounded-xl px-3 py-1.5 ring-1 ring-line text-muted bg-surface">Đăng nhập để thao tác</button>
                            : myActs.length ? myActs.map((a) => <button key={a.code} onClick={() => openApproval(inc, a)} className={`text-[12px] font-medium rounded-xl px-3 py-1.5 ring-1 ring-black/5 ${a.color || ""}`} style={a.style || {}}>{a.label}</button>)
                            : <span className="text-[12px] text-muted py-1">Chờ {choAi.map((r) => tenVaiTro(r, inc.room)).join(" / ")}</span>}
                          {user && (role === "ADMIN" || role === "LOT" || role === "QA") && <button onClick={() => toggleSilence(inc.id)} className={`text-[12px] font-medium rounded-xl px-3 py-1.5 ring-1 ${inc.silenced ? "text-muted bg-subtle ring-line" : "text-danger bg-danger-soft ring-danger-line"}`}>{inc.silenced ? "Bật lại" : "Tạm hoãn"}</button>}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              {/* ═══ DESKTOP (md+): bảng đầy đủ như cũ ═══ */}
              <div className="hidden md:block overflow-x-auto"><table className="w-full min-w-[1024px] text-[13px]"><thead><tr className="text-muted text-left text-[12px] uppercase tracking-wider">{["Mã", "Cụm", "Phòng", "Mức", "Chỉ tiêu", "Bắt đầu", "Kéo dài", "Trạng thái", "Phụ trách", "Cảnh báo", "Hành động"].map((h) => <th key={h} className="py-2.5 px-3 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{incSorted.map((inc, idx) => {
                  // P0-2: ở LIVE, nếu chưa biết bộ luật thì KHOÁ nút — logic chung trong tinhNut.
                  const { terminal, myActs, choAi } = tinhNut(inc);
                  const moCum = idx === 0 || cumAhu(incSorted[idx - 1]) !== cumAhu(inc);
                  const soTrongCum = incSorted.filter((x) => cumAhu(x) === cumAhu(inc)).length;
                  return (
                  <React.Fragment key={inc.id}>
                  {moCum && (
                    <tr className="bg-subtle/70">
                      <td colSpan={11} className="py-1.5 px-3 text-[12px] font-semibold uppercase tracking-wider text-muted">
                        {cumAhu(inc)} <span className="text-muted font-normal normal-case tracking-normal">· {soTrongCum} sự cố</span>
                      </td>
                    </tr>)}
                  <tr className={`border-t border-line hover:bg-info-soft/40 transition ${inc.silenced ? "opacity-60" : ""}`}>
                    <td className="py-3 px-3 font-semibold" style={{ color: "var(--text-strong)" }}>{inc.id}</td>
                    <td className="py-3 px-3">{inc.cumHienThi
                      ? <span className="rounded-lg bg-subtle px-1.5 py-0.5 text-[12px] font-medium text-body tabular-nums">{inc.cumHienThi}</span>
                      : <span className="text-[12px] text-muted">—</span>}</td>
                    <td className="py-3 px-3">{inc.room}{inc.mucCanhBao === "SUPPRESSED" && <span title="Cảm biến không đo được — hệ ngừng chấm mức, chờ Thiết bị đo. Không gửi email." className="ml-1.5 align-middle inline-block rounded-lg bg-subtle px-1.5 py-0.5 text-[12px] font-medium text-muted">cảm biến đứng hình</span>}{(() => { const kh = [incKhu(inc), incAhu(inc)].filter(Boolean).join(" · "); return kh ? <span className="block text-[12px] text-muted">{kh}</span> : null; })()}</td>
                    <td className="py-3 px-3"><MucBadge p={inc.priority} stack /></td>
                    <td className="py-3 px-3 text-body">{inc.sensor}{inc.huong && <span className={`ml-1.5 text-[12px] font-semibold px-1.5 py-0.5 rounded ${inc.huong === "CAO" ? "bg-danger-soft text-danger" : inc.huong === "THAP" ? "bg-info-soft text-info" : "bg-warning-soft text-warning"}`}>{inc.huong === "CAO" ? "↑ cao" : inc.huong === "THAP" ? "↓ thấp" : "↕ cả 2"}</span>}
                      {nhanSoCu(inc)}
                      {inc.giaTriGanNhat != null && <div className="text-[12px] text-muted mt-0.5 leading-tight">TB 5′ cuối <b className="text-body tabular-nums">{inc.giaTriGanNhat}{inc.donVi}</b>{inc.cuaSo5p && <span className="tabular-nums"> ({inc.cuaSo5p}{inc.ngay5p ? ` · ${inc.ngay5p}` : ""})</span>}{inc.gioiHanDuoi != null && <> · yêu cầu <span className="tabular-nums">{inc.gioiHanDuoi}–{inc.gioiHanTren}</span></>}{(inc.mucGanNhat === "NORMAL" || inc.mucGanNhat === "WARNING") ? <span className="text-success"> · đã về ngưỡng</span> : inc.mucGanNhat && <span className="text-danger"> · {inc.mucGanNhat}</span>}{inc.thieuDiem && <span className="text-warning"> · FMS thiếu điểm</span>}{inc.tuoiDuLieuPhut > 75 && <span className="text-warning"> · số liệu {(inc.tuoiDuLieuPhut / 60).toFixed(1)}h trước</span>}</div>}</td>
                    <td className="py-3 px-3 text-muted tabular-nums text-[12px]">{inc.start.slice(11)}</td>
                    <td className="py-3 px-3 text-warning font-medium">{inc.duration}h</td>
                    <td className="py-3 px-3"><span className="inline-flex items-center gap-1.5 text-[12px] text-body font-medium"><span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[inc.status]}`} />{inc.status}</span></td>
                    <td className="py-3 px-3">{(() => { const q = phuTrachTheoId[inc.dbId]; if (!q) return <span className="text-[12px] text-muted">—</span>;
                      const cham = !!q.dang_cham;
                      return (<div className="leading-tight">
                        <span className={`text-[12px] font-semibold ${cham ? "text-danger" : "text-body"}`}>{tenVaiTro(q.vai_tro_phu_trach, inc.room) || "—"}</span>
                        <p className={`text-[12px] mt-0.5 ${cham ? "text-danger font-medium" : "text-muted"}`}>
                          {q.nguong_phut === 0 ? "bế tắc — Trực + QA được báo ngay"
                            : cham ? `im lặng ${fmtPhut(q.phut_im_lang)} / ngưỡng ${fmtPhut(q.nguong_phut)}`
                            : `trong nhịp · ${fmtPhut(q.phut_im_lang)}/${fmtPhut(q.nguong_phut)}`}
                        </p>
                        {cham && q.da_bao_truc && <p className="text-[12px] text-warning mt-0.5">đã báo Trực</p>}
                      </div>); })()}</td>
                    <td className="py-3 px-3">{user && (role === "ADMIN" || role === "LOT" || role === "QA") ? <button onClick={() => toggleSilence(inc.id)} className={`text-[12px] font-medium rounded-lg px-2.5 py-1.5 ring-1 transition flex items-center gap-1 ${inc.silenced ? "text-muted bg-subtle ring-line hover:bg-subtle" : "text-danger bg-danger-soft ring-danger-line hover:bg-danger-soft"}`}>{inc.silenced ? <><Bell className="w-3.5 h-3.5" strokeWidth={1.8} /> Bật lại</> : <><BellOff className="w-3.5 h-3.5" strokeWidth={1.8} /> Tạm hoãn</>}</button> : <span className="text-[12px] text-muted">{inc.silenced ? "đang tạm hoãn" : "—"}</span>}{inc.silenced && inc.tamDungDen && <div className="text-[12px] text-muted mt-1" title={inc.tamDungLyDo || ""}>tới {new Date(inc.tamDungDen).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})} · {inc.tamDungBoi || "?"}</div>}</td>
                    <td className="py-3 px-3">{terminal ? <span className="text-success text-[12px] font-medium">Đã khắc phục</span> : !user ? <button onClick={() => setLoginOpen(true)} className="text-[12px] font-medium rounded-xl px-3 py-1.5 ring-1 ring-line text-muted bg-surface hover:bg-subtle">Đăng nhập</button> : myActs.length ? <div className="flex flex-wrap gap-1.5">{myActs.map((a) => <button key={a.code} onClick={() => openApproval(inc, a)} className={`text-[12px] font-medium rounded-xl px-2.5 py-1.5 ring-1 ring-black/5 transition hover:brightness-95 ${a.color || ""}`} style={a.style || {}}>{a.label}</button>)}</div> : <span className="text-[12px] text-muted">Chờ {choAi.map((r) => tenVaiTro(r, inc.room)).join("/")}</span>}</td>
                  </tr>
                  </React.Fragment>
                ); })}</tbody></table></div></>)}</Card>
              <p className="text-[12px] text-muted text-center"><b>Dừng CB</b> tắt chuông (vẫn giữ trong danh sách & audit) — chỉ <b>Quản trị / Trực HSL</b> thao tác. IPC và Cơ điện chỉ bấm nút hành động tương ứng theo vai trò; phê duyệt ghi bằng tên người đăng nhập (không cần PIN).</p>
              {/* Cụm điều tra — mục RIÊNG, đặt SAU danh sách sự cố: sự cố là thứ vận hành
                  cần thấy trước; cụm là lớp điều tra/kết luận QA, tra cứu sau. */}
              {isLive && cumHienThi.length > 0 && (
                <Card className="p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>Cụm điều tra · {cumHienThi.length} cụm / {cumHienThi.reduce((n, c) => n + (c.su_co_dang_mo || 0), 0)} sự cố</h3>
                      <p className="mt-0.5 text-[12px] text-muted leading-relaxed max-w-2xl">Sự cố được gộp theo <b>AHU × loại cảm biến</b> — đơn vị mà Cơ điện can thiệp được và QA kết luận được. Cụm tự mở khi sự cố đầu tiên sinh ra, tự đóng khi sự cố cuối cùng đóng.</p>
                    </div>
                  </div>
                  {/* MOBILE: thẻ cụm dọc — không kéo ngang */}
                  <div className="md:hidden mt-3 space-y-2">
                    {cumHienThi.map((c) => {
                      const hh = c.chan_doan && c.chan_doan.startsWith("THIẾT BỊ ĐO");
                      const honHop = c.chan_doan && c.chan_doan.startsWith("HỖN HỢP");
                      const mauChanDoan = hh ? "text-body bg-subtle" : honHop ? "text-warning bg-warning-soft" : "text-danger bg-danger-soft";
                      return (
                        <div key={c.ma_cum} onClick={() => setCumChiTiet(c)} className="rounded-2xl ring-1 ring-line bg-surface p-3 cursor-pointer active:bg-info-soft/40">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold tabular-nums" style={{ color: "var(--text-strong)" }}>{c.ma_hien_thi}</span>
                            <span className="text-[12px] text-body">{c.ahu || "—"} · {c.loai_cam_bien} <span className="text-muted">· Khu {c.khu_vuc}</span></span>
                          </div>
                          <p className="mt-1 text-[12px] tabular-nums"><b className="text-body">{c.su_co_dang_mo}</b> sự cố mở{c.so_chua_tiep_nhan > 0 && <span className="text-danger"> · {c.so_chua_tiep_nhan} chưa tiếp nhận</span>} · mở {Math.round(c.gio_mo)}h</p>
                          <p className="mt-1.5"><span className={`inline-block rounded-lg px-2 py-1 text-[12px] leading-tight ${mauChanDoan}`}>{docTenVaiTro(c.chan_doan, c.khu_vuc)}</span></p>
                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px]">
                            {c.da_co_ket_luan_qa ? <span className="text-success">✓ Kết luận: {c.qa_boi}</span> : <span className="text-muted">chưa có kết luận</span>}
                            {(role === "QA" || role === "ADMIN") && <button onClick={(e) => { e.stopPropagation(); ghiKetLuanCum(c); }} className="rounded-lg bg-surface px-2.5 py-1 font-medium text-body ring-1 ring-line">{c.da_co_ket_luan_qa ? "Sửa" : "Ghi kết luận"}</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* DESKTOP: bảng như cũ */}
                  <div className="hidden md:block mt-3 overflow-x-auto">
                    <table className="w-full text-[12px] min-w-[860px]">
                      <thead><tr className="text-muted text-left text-[12px] uppercase tracking-wider">{["Cụm", "AHU · Chỉ tiêu", "Sự cố", "Chẩn đoán", "Phòng", "Mở", "Kết luận QA"].map((h) => <th key={h} className="py-2 px-3 font-semibold">{h}</th>)}</tr></thead>
                      <tbody>{cumHienThi.map((c) => {
                        const hh = c.chan_doan && c.chan_doan.startsWith("THIẾT BỊ ĐO");
                        const honHop = c.chan_doan && c.chan_doan.startsWith("HỖN HỢP");
                        const mauChanDoan = hh ? "text-body bg-subtle" : honHop ? "text-warning bg-warning-soft" : "text-danger bg-danger-soft";
                        return (
                          <tr key={c.ma_cum} onClick={() => setCumChiTiet(c)} className="border-t border-line align-top cursor-pointer hover:bg-info-soft/40">
                            <td className="py-2.5 px-3 font-semibold tabular-nums" style={{ color: "var(--text-strong)" }}>{c.ma_hien_thi}</td>
                            <td className="py-2.5 px-3"><span className="font-medium text-body">{c.ahu || "—"}</span><span className="text-muted"> · {c.loai_cam_bien}</span><div className="text-[12px] text-muted">Khu {c.khu_vuc}</div></td>
                            <td className="py-2.5 px-3 tabular-nums">
                              <span className="font-semibold text-body">{c.su_co_dang_mo}</span>
                              {c.so_chua_tiep_nhan > 0 && <span className="ml-1.5 text-[12px] text-danger">{c.so_chua_tiep_nhan} chưa tiếp nhận</span>}
                            </td>
                            <td className="py-2.5 px-3"><span className={`inline-block rounded-lg px-2 py-1 text-[12px] leading-tight ${mauChanDoan}`}>{docTenVaiTro(c.chan_doan, c.khu_vuc)}</span></td>
                            <td className="py-2.5 px-3 text-muted max-w-[190px]"><span className="line-clamp-2" title={c.cac_phong}>{c.cac_phong || "—"}</span></td>
                            <td className="py-2.5 px-3 tabular-nums text-muted">{Math.round(c.gio_mo)} h</td>
                            <td className="py-2.5 px-3">
                              {c.da_co_ket_luan_qa
                                ? <span className="text-[12px] text-success" title={`${c.nguyen_nhan_goc}\n\nKhắc phục: ${c.hanh_dong_khac_phuc}`}>✓ {c.qa_boi}</span>
                                : <span className="text-[12px] text-muted">chưa có</span>}
                              {(role === "QA" || role === "ADMIN") && (
                                <button onClick={(e) => { e.stopPropagation(); ghiKetLuanCum(c); }} className="ml-2 rounded-lg bg-surface px-2 py-1 text-[12px] font-medium text-body ring-1 ring-line hover:bg-subtle">{c.da_co_ket_luan_qa ? "Sửa" : "Ghi kết luận"}</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                </Card>
              )}
              {isLive && suCoDongXem.length > 0 && (
                <Card className="p-4">
                  <button onClick={() => setKhungDongMo(!khungDongMo)} className="w-full flex items-center justify-between gap-3 text-left">
                    <div>
                      <h3 className="text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>Đóng gần đây · {suCoDongXem.length} sự cố (7 ngày)</h3>
                      <p className="mt-0.5 text-[12px] text-muted leading-relaxed">QA/Quản trị mở lại được trong cửa sổ này — bắt buộc lý do, ghi vào audit. Sự cố mở lại nhập vào cụm điều tra đang mở của cùng (AHU × chỉ tiêu).</p>
                    </div>
                    <span className="shrink-0 text-[12px] text-muted">{khungDongMo ? "Thu gọn ▲" : "Mở ra ▼"}</span>
                  </button>
                  {khungDongMo && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[940px] text-[12px]">
                        <thead><tr className="text-muted text-left text-[12px] uppercase tracking-wider">{["Mã", "Cụm", "Phòng", "Chỉ tiêu", "Đóng lúc", "Cách đóng", "Bởi", "Lý do", ""].map((h, i) => <th key={i} className="py-2 px-3 font-semibold">{h}</th>)}</tr></thead>
                        <tbody>{suCoDongXem.map((r) => {
                          const act = (!user || !luatSanSang) ? null : nutChoVaiTro(dsNut, r.trang_thai, role, true)[0] || null;
                          return (
                            <tr key={r.ma_su_co} className="border-t border-line align-top">
                              <td className="py-2.5 px-3 font-semibold tabular-nums" style={{ color: "var(--text-strong)" }}>{r.ma_hien_thi}</td>
                              <td className="py-2.5 px-3">{r.cum_hien_thi ? <span className="rounded-lg bg-subtle px-1.5 py-0.5 text-[12px] font-medium text-body tabular-nums">{r.cum_hien_thi}</span> : <span className="text-muted">—</span>}</td>
                              <td className="py-2.5 px-3">{r.phong}<span className="block text-[12px] text-muted">{[r.khu_vuc, r.ahu].filter(Boolean).join(" · ")}</span></td>
                              <td className="py-2.5 px-3 text-body">{r.cam_bien_vi}</td>
                              <td className="py-2.5 px-3 tabular-nums text-muted">{r.dong_luc ? new Date(r.dong_luc).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                              <td className="py-2.5 px-3 text-body">{r.nhan_trang_thai || r.trang_thai}</td>
                              <td className="py-2.5 px-3 text-muted max-w-[130px]"><span className="block truncate" title={r.dong_boi || ""}>{r.dong_boi || "—"}</span></td>
                              <td className="py-2.5 px-3 text-muted max-w-[200px]"><span className="line-clamp-2" title={r.dong_ly_do || ""}>{r.dong_ly_do || "—"}</span></td>
                              <td className="py-2.5 px-3 text-right">{act && <button onClick={() => setMoLai({ row: r, act })} className="rounded-lg px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap" style={act.style}>{act.label}</button>}</td>
                            </tr>
                          );
                        })}</tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )}
              {cumChiTiet && <CumDrawer cum={cumChiTiet} dsSuCo={incidentsXem.filter((i) => i.maCum === cumChiTiet.ma_cum)} onDong={() => setCumChiTiet(null)} coQuyenKetLuan={role === "QA" || role === "ADMIN"} onKetLuan={() => ghiKetLuanCum(cumChiTiet)} onInHoSo={() => inHoSoCum(cumChiTiet)} />}
              {moLai && <ModalMoLai row={moLai.row} act={moLai.act} dangChay={dangGhiCum} onDong={() => setMoLai(null)} onLuu={xacNhanMoLai} />}
            </div>
            );
          })()}

          {(daMo.recent || tab === "recent") && <div style={{ display: tab === "recent" ? "" : "none" }}><React.Suspense fallback={<div className="rounded-2xl bg-subtle animate-pulse" style={{ height: 360 }} />}><ChenhApTheoAhu isLive={isLive} khuChoPhep={khuChoPhep} active={tab === "recent"} /></React.Suspense></div>}
          {tab === "sensors" && <CamBienPage isLive={isLive} />}
          {(daMo.trend || tab === "trend") && <div className="space-y-6" style={{ display: tab === "trend" ? "" : "none" }}><React.Suspense fallback={<div className="rounded-2xl bg-subtle animate-pulse" style={{ height: 360 }} />}><TrendPage onAI={setAi} isLive={isLive} liveRisk={isLive ? live.riskRows : null} liveRooms={isLive ? roomsXem : null} liveIncidents={isLive ? incidentsXem : null} khuChoPhep={khuChoPhep} onSaveAI={handleSaveAI} /></React.Suspense><PhanTichGmpCard mkt={isLive ? live.gmpMkt : null} spc={isLive ? live.gmpSpc : null} isLive={isLive} /></div>}
          {tab === "reports" && <React.Suspense fallback={<div className="rounded-2xl bg-subtle animate-pulse" style={{ height: 360 }} />}><ReportsPage ai={ai} aiRows={isLive ? live.aiRows : null} /></React.Suspense>}

          {tab === "audit" && (() => {
            const subTabs = [
              { k: "audit", label: "Nhật ký audit", icon: FileText },
              { k: "config", label: "Thay đổi cấu hình", icon: History },
              { k: "sop", label: "SOP & CAPA", icon: ShieldCheck },
            ];
            return (
            <div className="space-y-5">
              <SectionTitle icon={ScrollText} hint="ALCOA+">Nhật ký truy vết & SOP</SectionTitle>
              {/* Thanh tab con trên cùng — đỡ phải cuộn để chuyển mục */}
              <div className="flex flex-wrap gap-2 sticky top-0 z-10 bg-surface/80 backdrop-blur rounded-2xl ring-1 ring-line p-1.5">
                {subTabs.map((s) => { const Ic = s.icon; const on = auditTab === s.k; return (
                  <button key={s.k} onClick={() => setAuditTab(s.k)} className={`flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium transition ${on ? "text-white shadow-sm" : "text-body hover:bg-subtle"}`} style={on ? { backgroundColor: "var(--primary-solid)" } : {}}><Ic className="w-4 h-4" strokeWidth={1.8} /> {s.label}</button>
                ); })}
              </div>

              {auditTab === "audit" && (
              <React.Suspense fallback={<div className="rounded-2xl bg-subtle animate-pulse" style={{ height: 320 }} />}>
                <AuditLogPage isLive={isLive} demoRows={audit} />
              </React.Suspense>
              )}
              {auditTab === "config" && (
              <Card className="p-6"><SectionTitle icon={History} hint="cấu hình ngưỡng · phòng · cảm biến">Thay đổi cấu hình & dữ liệu gốc</SectionTitle><p className="text-[12px] text-muted mt-1.5">Các thay đổi cấu hình ghi tại Supabase (sửa ngưỡng cảnh báo, thêm/bớt phòng & cảm biến, chỉnh giới hạn) — kể cả khi sửa trực tiếp trên database, đều hiển thị tại đây.</p><div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-muted text-left text-[12px] uppercase tracking-wider">{["Thời gian", "Người thực hiện", "Thay đổi"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead><tbody>{configHistory.length === 0 ? <tr><td colSpan={3} className="py-6 text-center text-muted text-[12px]">Chưa có thay đổi cấu hình.</td></tr> : configHistory.map((c, i) => <tr key={i} className="border-t border-line"><td className="py-2.5 pr-4 text-muted tabular-nums">{c.t}</td><td className="py-2.5 pr-4 text-body">{c.who}</td><td className="py-2.5 pr-4 text-body">{c.change}</td></tr>)}</tbody></table></div></Card>
              )}
              {auditTab === "sop" && (
              <Card className="p-6"><SectionTitle icon={ShieldCheck} hint="phục vụ thanh tra">SOP & Deviation / CAPA</SectionTitle><div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-muted text-left text-[12px] uppercase tracking-wider">{["SOP", "Áp dụng cho", "Deviation", "CAPA"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead><tbody>{(sopRows || []).map((s, i) => <tr key={i} className="border-t border-line"><td className="py-2.5 pr-4 font-semibold" style={{ color: "var(--text-strong)" }}>{s.sop}</td><td className="py-2.5 pr-4 text-body">{s.apply}</td><td className="py-2.5 pr-4 text-body">{s.dev}</td><td className="py-2.5 pr-4 text-body">{s.capa}</td></tr>)}</tbody></table>{isLive && sopRows === null && <div className="h-10 rounded-xl bg-subtle animate-pulse mt-2" />}{isLive && Array.isArray(sopRows) && sopRows.length === 0 && <p className="text-[12px] text-muted mt-2">Chưa có hồ sơ SOP/CAPA nào trong cơ sở dữ liệu.</p>}</div></Card>
              )}
            </div>
            );
          })()}

          {tab === "recipients" && <React.Suspense fallback={<div className="rounded-2xl bg-subtle animate-pulse" style={{ height: 360 }} />}><CauHinhNguoiNhan isLive={isLive} canManage={canManage} laAdmin={user?.role === "ADMIN"} actor={user?.email} /></React.Suspense>}

          {tab === "settings" && (() => {
            const cfgSubTabs = [
              { k: "canhbao", label: "Nguyên tắc cảnh báo", icon: SlidersHorizontal },
              { k: "phong", label: "Phòng & cảm biến", icon: Building2 },
              { k: "phantuyen", label: "Tự phân tuyến", icon: ShieldCheck },
              { k: "sodo", label: "Sơ đồ xử lý", icon: GitBranch },
              ...(role === "ADMIN" ? [{ k: "taikhoan", label: "Tài khoản & quyền", icon: KeyRound }] : []),
              { k: "hethong", label: "Hệ thống", icon: Wifi },
            ];
            const pct = (v) => Math.max(0, Math.min(100, (Number(v) || 0) / 60 * 100));
            return (
            <div className="space-y-5">
              <SectionTitle icon={Cog}>Cài đặt</SectionTitle>
              <div className="flex flex-wrap gap-2 sticky top-0 z-10 bg-surface/80 backdrop-blur rounded-2xl ring-1 ring-line p-1.5">
                {cfgSubTabs.map((s) => { const Ic = s.icon; const on = cfgTab === s.k; return (
                  <button key={s.k} onClick={() => setCfgTab(s.k)} className={`flex-1 min-w-[150px] flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium transition ${on ? "text-white shadow-sm" : "text-body hover:bg-subtle"}`} style={on ? { backgroundColor: "var(--primary-solid)" } : {}}><Ic className="w-4 h-4" strokeWidth={1.8} /> {s.label}</button>
                ); })}
              </div>

              {cfgTab === "canhbao" && (
              <Card className="p-6">
                <SectionTitle icon={SlidersHorizontal} hint="3 mức: kiểm soát tốt → chú ý (theo dõi) → cảnh báo (gửi mail)">Nguyên tắc cảnh báo</SectionTitle>
                <p className="text-[12px] text-muted mt-2">Mỗi giờ hệ thống chấm mỗi phòng tối đa <b>60 điểm</b> (mỗi phút lỗi = 1 điểm). Vượt ngưỡng thì <b>10 phút cuối</b> quyết định: còn lệch ngay lúc này thì gửi mail, đã về dải thì chỉ theo dõi.</p>
                <div className="mt-5">
                  <div className="relative h-10 rounded-xl overflow-hidden ring-1 ring-line flex text-[12px] font-semibold text-white select-none">
                    <div style={{ width: pct(cfgHT.warn) + "%", background: "var(--primary-solid)" }} className="flex items-center justify-center min-w-0"><span className="truncate px-1">Kiểm soát tốt · tự đóng sự cố</span></div>
                    <div style={{ width: Math.max(0, 100 - pct(cfgHT.warn)) + "%", background: "#ef4444" }} className="flex items-center justify-center min-w-0"><span className="truncate px-1">Vượt ngưỡng</span></div>
                  </div>
                  <div className="flex justify-between text-[12px] text-muted mt-1 tabular-nums"><span>0</span><span>số điểm lỗi trong 1 giờ →</span><span>60</span></div>
                </div>
                <div className="rounded-2xl bg-subtle ring-1 ring-line p-4 mt-5">
                  <div className="flex items-center justify-between gap-2"><label className="text-[12px] font-semibold text-body">Vượt ngưỡng khi OOS 1 giờ &gt;</label><span className="text-[16px] font-bold tabular-nums text-danger">{cfgHT.warn}<span className="text-[12px] text-muted font-normal">/60</span></span></div>
                  <p className="text-[12px] text-muted mt-0.5">Từ hoặc dưới mức này, phòng coi như <b>kiểm soát tốt</b> và sự cố đang mở sẽ <b>tự đóng</b>.</p>
                  <input type="range" min="0" max="60" value={cfgHT.warn} disabled={!canManage} onChange={(e) => { setCfgNhap({ ...cfgHT, warn: Number(e.target.value) }); setMoPhong(null); }} className="w-full mt-3 accent-primarytk-solid disabled:opacity-50" />
                </div>
                <div className="rounded-2xl bg-danger-soft/60 ring-1 ring-danger-line p-4 mt-4 flex items-center justify-between flex-wrap gap-3">
                  <div><label className="text-[12px] font-semibold text-danger">Đã vượt ngưỡng — GỬI MAIL khi 10 phút cuối có ≥</label><p className="text-[12px] text-muted mt-0.5">Ít hơn mức này nghĩa là 10 phút cuối đã về dải: sự cố vẫn mở và vẫn hiện ở tab Sự cố, nhưng xếp <b>Chú ý — theo dõi</b> và <b>không gửi mail</b>, vì không có gì để xử lý ngay trong nhịp này.</p></div>
                  <div className="flex items-center gap-2"><input type="number" min="0" max="10" value={cfgHT.action} disabled={!canManage} onChange={(e) => { setCfgNhap({ ...cfgHT, action: Number(e.target.value) }); setMoPhong(null); }} className="w-20 rounded-xl bg-surface ring-1 ring-danger-line px-3 py-2 text-sm text-center font-bold disabled:bg-subtle" /><span className="text-sm text-muted">/10 điểm</span></div>
                </div>

                {/* ③ Không thể chỉnh nhầm bằng một cú kéo chuột. Xem tác động trên 7 ngày
                    dữ liệu THẬT rồi mới áp. Mô phỏng tính lại cả hai mức từ số liệu thô. */}
                {canManage && coThayDoi && (
                  <div className="rounded-2xl ring-1 ring-warning-line bg-warning-soft/60 p-4 mt-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-[12px] text-body">
                        Đang sửa: <b>OOS 1 giờ &gt; {cfgNhap.warn}</b> · <b>10′ cuối ≥ {cfgNhap.action}</b>
                        <span className="text-muted"> (đang áp dụng: {cfg.warn} / {cfg.action})</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setCfgNhap(null); setMoPhong(null); }}
                          className="rounded-xl bg-surface ring-1 ring-line px-3 py-1.5 text-[12px] font-medium text-body">Hủy</button>
                        <button onClick={xemTacDong}
                          className="rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white" style={{ backgroundColor: "var(--anchor)" }}>Xem tác động</button>
                        <button onClick={() => saveCfg(cfgNhap)} disabled={!moPhong?.kq}
                          className="rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white disabled:bg-subtle disabled:text-muted"
                          style={moPhong?.kq ? { backgroundColor: "var(--danger-solid)" } : {}}>Áp dụng</button>
                      </div>
                    </div>

                    {moPhong?.dangTai && <div className="h-16 rounded-xl bg-surface/70 animate-pulse mt-3" />}
                    {moPhong?.loi && <p className="text-[12px] text-danger mt-3">{moPhong.loi}</p>}
                    {moPhong?.kq && (
                      <div className="mt-3">
                        <p className="text-[12px] uppercase tracking-wider text-muted font-semibold">Chiếu lên {moPhong.kq.so_ngay} ngày dữ liệu thật · {moPhong.kq.tong_gio} giờ-cảm-biến</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                          {[["Giờ GỬI MAIL", moPhong.kq.hien_tai.gui_mail, moPhong.kq.de_xuat.gui_mail],
                            ["Giờ chỉ theo dõi", moPhong.kq.hien_tai.theo_doi, moPhong.kq.de_xuat.theo_doi],
                            ["Giờ bình thường", moPhong.kq.hien_tai.binh_thuong, moPhong.kq.de_xuat.binh_thuong]].map(([lbl, a, b]) => (
                            <div key={lbl} className="rounded-xl bg-surface ring-1 ring-line p-3">
                              <p className="text-[12px] uppercase tracking-wider text-muted font-semibold">{lbl}</p>
                              <p className="text-[15px] font-semibold tabular-nums mt-0.5" style={{ color: "var(--text-default)" }}>
                                {a} <span className="text-muted font-normal">→</span> {b}
                              </p>
                            </div>))}
                          <div className="rounded-xl bg-surface ring-1 ring-line p-3">
                            <p className="text-[12px] uppercase tracking-wider text-muted font-semibold">Phòng bị ảnh hưởng</p>
                            <p className="text-[15px] font-semibold tabular-nums mt-0.5" style={{ color: "var(--text-default)" }}>{moPhong.kq.phong_anh_huong}</p>
                          </div>
                        </div>
                        <p className="text-[12px] mt-3 leading-relaxed" style={{ color: moPhong.kq.gui_mail_bot > moPhong.kq.gui_mail_them ? "var(--warning)" : "var(--text-default)" }}>
                          {moPhong.kq.gui_mail_them > 0 && <>Sẽ <b>gửi mail thêm {moPhong.kq.gui_mail_them} giờ</b>{moPhong.kq.p1_gui_mail_them > 0 && <> (trong đó <b>{moPhong.kq.p1_gui_mail_them} giờ ở phòng P1</b>)</>}. </>}
                          {moPhong.kq.gui_mail_bot > 0 && <>Sẽ <b>bớt gửi mail {moPhong.kq.gui_mail_bot} giờ</b>{moPhong.kq.p1_gui_mail_bot > 0 && <> — trong đó <b>{moPhong.kq.p1_gui_mail_bot} giờ ở phòng P1</b>, nghĩa là những giờ đó sẽ không ai được báo</>}. </>}
                          {moPhong.kq.tu_dong_them > 0 && <>Hệ sẽ <b>tự đóng thêm {moPhong.kq.tu_dong_them} giờ</b>. </>}
                          {moPhong.kq.gui_mail_them === 0 && moPhong.kq.gui_mail_bot === 0 && moPhong.kq.tu_dong_them === 0 && moPhong.kq.tu_dong_bot === 0 && <>Không giờ nào đổi mức. Ngưỡng mới không thay đổi hành vi trên 7 ngày vừa qua.</>}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="rounded-2xl bg-subtle ring-1 ring-line p-4 mt-4">
                  <label className="text-[12px] font-semibold text-body">Cấp độ phòng được cảnh báo</label>
                  <p className="text-[12px] text-muted mt-0.5">Chỉ mở sự cố + gửi cảnh báo cho phòng thuộc cấp đã chọn. Phòng ngoài cấp <b>vẫn ghi dữ liệu OOS</b> (KPI/tuân thủ đủ), chỉ không tạo sự cố/leo thang.</p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {[["P1", "P1 · trọng yếu"], ["P2", "P2 · quan trọng"], ["P3", "P3 · thường"]].map(([p, lbl]) => { const on = alertUuTien.includes(p); return (
                      <button key={p} onClick={() => toggleUuTien(p)} disabled={!canManage} className={`px-3.5 py-2 rounded-xl text-[12px] font-medium ring-1 transition disabled:opacity-60 ${on ? "text-white ring-transparent" : "text-muted bg-surface ring-line hover:ring-success-line"}`} style={on ? { backgroundColor: "var(--primary-solid)" } : {}}>{on ? "✓ " : ""}{lbl}</button>
                    ); })}
                  </div>
                  <p className="text-[12px] text-muted mt-2">Đang cảnh báo: <b className="text-body">{alertUuTien.join(" · ") || "—"}</b>{alertUuTien.length === 3 ? " (tất cả phòng)" : ""}. Phải giữ ít nhất 1 cấp.</p>
                </div>
                <div className="rounded-2xl bg-subtle ring-1 ring-line p-4 mt-4">
                  <label className="text-[12px] font-semibold text-body">Hướng mở sự cố theo chỉ tiêu</label>
                  <p className="text-[12px] text-muted mt-0.5">Chọn <b>mở sự cố</b> khi vượt giới hạn <b>DƯỚI</b>, <b>TRÊN</b> hay <b>CẢ HAI</b> — theo từng chỉ tiêu. Vd: chênh áp (DP) thường chỉ nguy hiểm khi <b>thấp</b> (mất áp dương). Dữ liệu thô luôn ghi đủ; đổi lúc nào cũng được, áp dụng từ giờ chạy kế tiếp.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    {[["DP", "Chênh áp"], ["RH", "Độ ẩm"], ["T", "Nhiệt độ"]].map(([k, ten]) => (
                      <div key={k} className="rounded-xl bg-surface ring-1 ring-line p-3">
                        <div className="text-[12px] font-medium text-body mb-1.5">{ten} <span className="text-muted">({k})</span></div>
                        <select disabled={!canManage} value={(alertHuong[k] || {}).su_co || "CA_HAI"} onChange={(e) => doiHuong(k, "su_co", e.target.value)} className="w-full rounded-lg bg-subtle ring-1 ring-line px-2 py-1.5 text-[12px] disabled:bg-subtle"><option value="CA_HAI">Cả hai (dưới + trên)</option><option value="DUOI">Chỉ khi THẤP (dưới)</option><option value="TREN">Chỉ khi CAO (trên)</option></select>
                      </div>
                    ))}
                  </div>
                </div>
                {!canManage && <p className="text-[12px] text-warning mt-3">Cần quyền QA/Quản trị để chỉnh.</p>}
              </Card>
              )}

              {cfgTab === "phong" && (
              <div className="space-y-5"><SectionTitle icon={Building2}>Quản lý phòng & cảm biến</SectionTitle><RoomManager rooms={rooms} cfg={cfg} canManage={canManage} onAdd={addRoom} onDelete={deleteRoom} onSaveEdits={saveRoomEdits} /></div>
              )}

              {cfgTab === "phantuyen" && (
              <React.Suspense fallback={<div className="rounded-2xl bg-subtle animate-pulse" style={{ height: 360 }} />}><LuatPhanTuyenCard isLive={isLive} canManage={canManage} actor={user?.email} /></React.Suspense>
              )}

              {cfgTab === "taikhoan" && role === "ADMIN" && (
              <TaiKhoanCard isLive={isLive} actor={user?.email} />
              )}

              {cfgTab === "sodo" && (
              <Card className="p-6"><SectionTitle icon={GitBranch} hint="luồng tự động + bảng luật đang chạy">Sơ đồ xử lý sự cố toàn hệ thống</SectionTitle>
                <div className="mt-4"><React.Suspense fallback={<div className="rounded-2xl bg-subtle animate-pulse" style={{ height: 320 }} />}><SoDoLuatCard dsNut={isLive ? live.nutThaoTac : null} /></React.Suspense></div>
              </Card>
              )}
              {cfgTab === "hethong" && (
              <div className="space-y-5">
                <Card className="p-6"><SectionTitle icon={Wifi}>Kết nối dữ liệu</SectionTitle>
                  {(() => { const conn = !HAS_SUPABASE ? ["Chế độ thử nghiệm — dữ liệu mẫu", "text-warning bg-warning-soft"] : live.loi ? ["Lỗi kết nối", "text-danger bg-danger-soft"] : live.dangTai ? ["Đang đồng bộ…", "text-info bg-info-soft"] : ["Đã kết nối", "text-success bg-success-soft"]; return (
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center gap-3">
                        <span className={`text-[13px] px-2.5 py-1 rounded-full font-semibold ${conn[1]}`}>{conn[0]}</span>
                        <span className="text-[13px] text-muted">Cập nhật gần nhất: <b className="text-body tabular-nums">{live.capNhatLuc ? live.capNhatLuc.toLocaleString("vi-VN") : "—"}</b></span>
                      </div>
                      {isLive && live.loi && <p className="text-[12px] text-danger">Chi tiết lỗi: {live.loi.thong_bao || live.loi.message || "không xác định"}</p>}
                      <details className="rounded-2xl ring-1 ring-line px-4 py-3">
                        <summary className="cursor-pointer text-[13px] font-medium text-muted select-none">Thông tin kỹ thuật</summary>
                        <div className="mt-3 space-y-2 text-[13px]">
                          <div className="flex items-center justify-between gap-3"><span className="text-muted w-44">Nguồn dữ liệu</span><code className="text-xs text-body bg-subtle px-2 py-1 rounded-lg ring-1 ring-line flex-1">{isLive ? "LIVE — đọc/ghi Supabase" : "DEMO — dữ liệu mẫu"}</code></div>
                          <div className="flex items-center justify-between gap-3"><span className="text-muted w-44">Khóa môi trường</span><code className="text-xs text-body bg-subtle px-2 py-1 rounded-lg ring-1 ring-line flex-1">{HAS_SUPABASE ? "VITE_SUPABASE_URL · ANON_KEY" : "chưa thiết lập"}</code></div>
                        </div>
                      </details>
                    </div>
                  ); })()}</Card>
                <GiaoDienCard />
                <ChuoiHashCard isLive={isLive} />
                <DoiMatKhauCard user={user} isLive={isLive} />
              </div>
              )}
            </div>
            );
          })()}
        </main>

        <footer className="mt-8 text-center text-[12px] text-muted tracking-wide leading-relaxed"><span className="font-semibold" style={{ color: "var(--text-default)" }}>Hệ thống giám sát HVAC phòng sạch GMP</span> · V/Q team — QLCL</footer>
      </div>

      {modal && <ApprovalModal incident={modal.inc} action={modal.action} user={user} onClose={() => setModal(null)} onCommit={handleCommit} />}
      {/* Ghi kết luận cụm render ở GỐC (như ApprovalModal), KHÔNG trong tab Sự cố:
          banner "Việc của bạn" hiện trên mọi tab — trước đây bấm "Ghi kết luận" từ
          tab khác thì state đặt xong mà modal không render (nút như chết). */}
      {cumKetLuan && <ModalKetLuanCum cum={cumKetLuan} dangChay={dangGhiCum} onDong={() => setCumKetLuan(null)} onLuu={luuKetLuanCum} />}
      {roomModal && <RoomDetailModal room={roomModal} onClose={() => setRoomModal(null)} />}
      {kpiModal && <KpiListModal kind={kpiModal} groups={nhomPhong} incidents={suCoP12} cfg={cfg}
        onClose={() => setKpiModal(null)}
        onPickRoom={(r) => { setKpiModal(null); setRoomModal(r); }}
        onPickIncident={(i) => { setKpiModal(null); openApproval(i); }}
        onGotoIncidents={() => { setKpiModal(null); setTab("events"); }} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} isLive={isLive} />}
      {pwOpen && <DoiMatKhauModal user={user} isLive={isLive} onClose={() => setPwOpen(false)} />}
      {veEmail && <ModalVeEmail trangThai={veEmail} onDong={dongVe} onChay={chayVe} />}
    </div>
  );
}

