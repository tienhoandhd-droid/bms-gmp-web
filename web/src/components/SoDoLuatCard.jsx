import React, { useMemo, useState } from "react";
import {
  Activity, ArrowRight, BellRing, CheckCircle2, ChevronRight, CircleDot,
  ClipboardList, Copy, Database, GitBranch, Info, LockKeyhole, RotateCcw,
  ShieldCheck, SlidersHorizontal, Wrench,
} from "lucide-react";
import { phanTichLuat, sinhMermaid, tenTT, VAI_TRO_TEN } from "../lib/soDoLuat";

// Báo cáo (10): vai trò dùng badge NEUTRAL — màu dành cho bất thường, không cho danh tính.
// Phân biệt vai trò bằng nhãn/vị trí, không bằng cầu vồng.
const NEU = { net: "var(--border-strong)", nen: "var(--bg-subtle)", chu: "var(--text-default)" };
const VAI = {
  IPC:    { ...NEU, ten: "IPC" },
  MEP:    { ...NEU, ten: "Cơ điện" },
  LOT:    { ...NEU, ten: "Trực HSL" },
  QA:     { ...NEU, ten: "QA" },
  IT:     { ...NEU, ten: "IT" },
  ADMIN:  { ...NEU, ten: "Quản trị" },
  SYSTEM: { net: "var(--primary)", nen: "var(--primary-soft)", chu: "var(--primary-hover)", ten: "Hệ thống" },
};
const mv = (v) => VAI[v] || VAI.SYSTEM;
const VAI_THU_TU = ["SYSTEM", "IPC", "MEP", "LOT", "QA", "IT", "ADMIN"];

function sapVaiTro(ds) {
  const co = [...new Set(ds.map((r) => r.vai_tro))];
  return [...VAI_THU_TU.filter((v) => co.includes(v)), ...co.filter((v) => !VAI_THU_TU.includes(v)).sort()];
}

const TRANG_THAI = {
  CHUA_XU_LY: {
    owner: "IPC", moTa: "Sự cố mới được hệ thống mở; IPC kiểm tra hiện trường và quyết định bước tiếp theo.",
  },
  MO_LAI: {
    owner: "IPC", moTa: "Sự cố đã đóng được QA hoặc Quản trị mở lại; quay về pha IPC xử lý.",
  },
  DA_BAO_CO_DIEN: {
    owner: "MEP", moTa: "Việc đã được giao cho Cơ điện và đang chờ Cơ điện xác nhận tiếp nhận.",
  },
  CO_DIEN_DANG_XU_LY: {
    owner: "MEP", moTa: "Cơ điện đã nhận việc và đang can thiệp tại thiết bị hoặc hệ thống HVAC.",
  },
  CO_DIEN_CHO_XU_LY: {
    owner: "MEP", moTa: "Việc tạm chờ nguồn lực hoặc thời điểm phù hợp; Cơ điện nhận lại để tiếp tục.",
  },
  CO_DIEN_KHONG_XU_LY_DUOC: {
    owner: "LOT", moTa: "Cơ điện báo không thể xử lý; Trực HSL nhận ngay, QA được CC và IPC/Cơ điện vẫn có đường thoát.",
  },
  DA_KHAC_PHUC: {
    owner: "QA", ketThuc: true, moTa: "Đã xác nhận khắc phục và đóng hồ sơ sự cố.",
  },
  IPC_BINH_THUONG: {
    owner: "IPC", ketThuc: true, moTa: "IPC kiểm tra và xác nhận hiện trường bình thường; đóng riêng để phân biệt cảnh báo giả.",
  },
  DONG_TU_DONG: {
    owner: "SYSTEM", ketThuc: true, moTa: "Hệ thống tự đóng khi đủ 2 giờ sạch liên tiếp (dữ liệu về bình thường).",
  },
  DONG_NGOAI_PHAM_VI: {
    owner: "ADMIN", ketThuc: true, moTa: "Quản trị đóng có lý do vì sự cố nằm ngoài phạm vi giám sát áp dụng.",
  },
};

const GIAI_DOAN = [
  {
    so: "01", ten: "IPC tiếp nhận", moTa: "Bắt đầu hoặc mở lại", mau: "var(--primary)",
    states: ["CHUA_XU_LY", "MO_LAI"],
  },
  {
    so: "02", ten: "Bàn giao Cơ điện", moTa: "Chờ xác nhận nhận việc", mau: "var(--primary)",
    states: ["DA_BAO_CO_DIEN"],
  },
  {
    so: "03", ten: "Cơ điện xử lý", moTa: "Xử lý chính và các nhánh ngoại lệ", mau: "var(--primary)",
    states: ["CO_DIEN_DANG_XU_LY", "CO_DIEN_CHO_XU_LY", "CO_DIEN_KHONG_XU_LY_DUOC"],
  },
  {
    so: "04", ten: "Kết thúc", moTa: "Bốn kết quả đóng được phân biệt", mau: "var(--primary)",
    states: ["DA_KHAC_PHUC", "IPC_BINH_THUONG", "DONG_TU_DONG", "DONG_NGOAI_PHAM_VI"],
  },
];

const CANONICAL = new Set(GIAI_DOAN.flatMap((g) => g.states));

function VaiTroBadge({ vaiTro, small = false }) {
  const m = mv(vaiTro);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full font-bold ${small ? "px-2 py-0.5 text-[12px]" : "px-2.5 py-1 text-[12px]"}`}
      style={{ background: m.nen, color: m.chu }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.net }} />
      {VAI_TRO_TEN[vaiTro] || m.ten || vaiTro}
    </span>
  );
}

function DieuKien({ rule, compact = false }) {
  const tags = [];
  if (rule.giu) tags.push({ t: "Giữ trạng thái", c: "bg-subtle text-body" });
  if (rule.dong) tags.push({ t: "Đóng sự cố", c: "bg-success-soft text-success" });
  if (rule.moLai) tags.push({ t: "Mở lại", c: "bg-info-soft text-info" });
  if (rule.batBuocLyDo) tags.push({ t: "Bắt buộc lý do", c: "bg-danger-soft text-danger" });
  if (rule.apDungKhi === "DONG") tags.push({ t: "Chỉ khi đã đóng", c: "bg-subtle text-body" });
  if (rule.apDungKhi === "CA_HAI") tags.push({ t: "Mở hoặc đã đóng", c: "bg-subtle text-body" });
  if (!tags.length) return null;
  return (
    <div className={`flex flex-wrap ${compact ? "gap-1" : "gap-1.5"}`}>
      {tags.map((x) => <span key={x.t} className={`rounded-md font-semibold ${compact ? "px-1.5 py-0.5 text-[12px]" : "px-2 py-0.5 text-[12px]"} ${x.c}`}>{x.t}</span>)}
    </div>
  );
}

function DongLuat({ rule, compact = false }) {
  const m = mv(rule.vai_tro);
  return (
    <div className={`rounded-xl border border-line bg-surface ${compact ? "p-2.5" : "p-3"}`}>
      <div className="flex items-start gap-2">
        <VaiTroBadge vaiTro={rule.vai_tro} small />
        <div className="min-w-0 flex-1">
          <p className={`${compact ? "text-[12px]" : "text-[12px]"} font-semibold leading-snug text-strong`}>{rule.nhan}</p>
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px] leading-tight" style={{ color: m.chu }}>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="font-semibold">{rule.giu ? "Không đổi trạng thái" : tenTT(rule.den)}</span>
          </div>
          <div className="mt-1.5"><DieuKien rule={rule} compact /></div>
        </div>
      </div>
    </div>
  );
}

function TheTrangThai({ ma, canh, taiCho, vai }) {
  const meta = TRANG_THAI[ma] || { owner: "SYSTEM", moTa: "Trạng thái được đọc trực tiếp từ bảng luật hiện hành." };
  const owner = mv(meta.owner);
  const canhLoc = canh.filter((r) => vai === "ALL" || r.vai_tro === vai);
  const taiChoLoc = taiCho.filter((r) => vai === "ALL" || r.vai_tro === vai);
  const coLuatPhuHop = canhLoc.length > 0 || taiChoLoc.length > 0;

  return (
    <article className={`overflow-hidden rounded-2xl border bg-surface shadow-[0_8px_24px_rgba(15,23,42,0.045)] transition ${vai !== "ALL" && !coLuatPhuHop ? "opacity-45" : ""}`}
      style={{ borderColor: `${owner.net}44` }}>
      <div className="border-b border-line px-3.5 py-3" style={{ background: "var(--bg-subtle)" }}>
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: owner.net }}>
            {meta.ketThuc ? <CheckCircle2 className="h-4 w-4" /> : <CircleDot className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-[13px] font-bold leading-tight text-strong">{tenTT(ma)}</h4>
            <code className="mt-1 block break-all text-[12px] font-semibold tracking-wide text-muted">{ma}</code>
          </div>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">{meta.moTa}</p>
      </div>

      <div className="space-y-2 p-3">
        {canhLoc.map((r) => <DongLuat key={r.id} rule={r} compact />)}
        {taiChoLoc.length > 0 && (
          <div className="rounded-xl border border-dashed border-line bg-subtle/70 p-2.5">
            <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Thao tác không đổi trạng thái</p>
            <div className="space-y-1.5">
              {taiChoLoc.map((r) => (
                <div key={r.id} className="flex items-start gap-2 text-[12px] leading-snug text-body">
                  <VaiTroBadge vaiTro={r.vai_tro} small />
                  <span className="pt-0.5">{r.nhan}{r.batBuocLyDo ? " · bắt buộc lý do" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {!canhLoc.length && !taiChoLoc.length && (
          <p className="py-1 text-[12px] leading-relaxed text-muted">
            {meta.ketThuc ? "Điểm kết thúc. QA hoặc Quản trị có thể mở lại theo luật ở phần bên dưới." : (vai === "ALL" ? "Không có hành động trực tiếp tại trạng thái này." : "Vai trò đang lọc không thao tác tại trạng thái này.")}
          </p>
        )}
      </div>
    </article>
  );
}

function NhomLuatToanCuc({ title, icon: Icon, description, rules }) {
  if (!rules.length) return null;
  const grouped = sapVaiTro(rules)
    .map((v) => [v, rules.filter((r) => r.vai_tro === v)])
    .filter(([, ds]) => ds.length);
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: "var(--anchor)" }}><Icon className="h-4 w-4" /></div>
        <div>
          <h3 className="text-[13px] font-bold text-strong">{title}</h3>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {grouped.map(([v, ds]) => (
          <div key={v} className="rounded-xl bg-subtle p-3">
            <VaiTroBadge vaiTro={v} />
            <div className="mt-2 space-y-2">{ds.map((r) => <DongLuat key={r.id} rule={r} compact />)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DieuKienBang({ rule }) {
  const apDung = rule.apDungKhi === "DONG" ? "Sự cố đã đóng" : rule.apDungKhi === "CA_HAI" ? "Mở hoặc đã đóng" : "Sự cố đang mở";
  return (
    <div className="min-w-[150px]">
      <p className="text-[12px] font-medium text-body">{apDung}</p>
      <div className="mt-1"><DieuKien rule={rule} compact /></div>
    </div>
  );
}

export default function SoDoLuatCard({ dsNut }) {
  const [vai, setVai] = useState("ALL");
  const [daCopy, setDaCopy] = useState(false);
  const parsed = useMemo(() => phanTichLuat(dsNut), [dsNut]);
  const { tatCa, canhTuanTu, canhBatKy, taiCho, moLai } = parsed;

  const vaiCo = useMemo(() => sapVaiTro(tatCa), [tatCa]);
  const canhTheoTu = useMemo(() => {
    const m = {};
    for (const r of canhTuanTu) (m[r.tu] ||= []).push(r);
    return m;
  }, [canhTuanTu]);
  const taiChoTheoTu = useMemo(() => {
    const m = {};
    for (const r of taiCho.filter((x) => x.tu !== "*")) (m[r.tu] ||= []).push(r);
    return m;
  }, [taiCho]);

  const trangThaiTrongLuat = useMemo(() => {
    const s = new Set();
    for (const r of tatCa) {
      if (r.tu && r.tu !== "*") s.add(r.tu);
      if (r.den && r.den !== "__GIU__") s.add(r.den);
    }
    return s;
  }, [tatCa]);
  const trangThaiKhac = [...trangThaiTrongLuat].filter((x) => !CANONICAL.has(x));
  const tatCaLoc = tatCa.filter((r) => vai === "ALL" || r.vai_tro === vai);
  const batKyLoc = canhBatKy.filter((r) => vai === "ALL" || r.vai_tro === vai);
  const moLaiLoc = moLai.filter((r) => vai === "ALL" || r.vai_tro === vai);
  const taiChoToanCucLoc = taiCho.filter((r) => r.tu === "*" && (vai === "ALL" || r.vai_tro === vai));

  if (!tatCa.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong bg-subtle px-5 py-10 text-center">
        <Database className="mx-auto h-7 w-7 text-muted" />
        <p className="mt-3 text-[13px] font-semibold text-body">Chưa nạp được bảng luật xử lý</p>
        <p className="mt-1 text-[12px] text-muted">Cần đăng nhập ở chế độ LIVE để đọc nguồn <code>xem_nut_thao_tac</code>.</p>
      </div>
    );
  }

  const copyMermaid = async () => {
    try {
      await navigator.clipboard.writeText(sinhMermaid(dsNut));
      setDaCopy(true);
      setTimeout(() => setDaCopy(false), 1800);
    } catch {
      window.alert("Trình duyệt chặn quyền sao chép.");
    }
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl bg-[#102a43] text-white shadow-[0_18px_45px_rgba(15,42,67,0.16)]">
        <div className="relative px-5 py-5 sm:px-6">
          <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-info/10" />
          <div className="absolute -bottom-20 right-28 h-44 w-44 rounded-full bg-success/10" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-sky-200">
                <GitBranch className="h-3.5 w-3.5" /> Bản đồ vận hành sự cố
              </div>
              <h2 className="mt-2 text-lg font-bold tracking-tight sm:text-xl">Một luồng chính, các nhánh ngoại lệ tách riêng</h2>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                Đọc theo số thứ tự 01 → 04. Mỗi hành động giữ nguyên vai trò, trạng thái đích và điều kiện đúng như bảng luật đang chạy; không còn gộp thành “+N” hoặc thu nhỏ chữ để vừa khung.
              </p>
            </div>
            <button onClick={copyMermaid} className="relative inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[12px] font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15">
              <Copy className="h-3.5 w-3.5" /> {daCopy ? "Đã sao chép" : "Sao chép Mermaid"}
            </button>
          </div>
          <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [tatCa.length, "luật đang bật"],
              [trangThaiTrongLuat.size, "trạng thái trong luật"],
              [canhTuanTu.length + canhBatKy.length + moLai.length, "bước chuyển"],
              [taiCho.length, "thao tác giữ nguyên"],
            ].map(([n, label]) => (
              <div key={label} className="rounded-xl bg-surface/[0.07] px-3 py-2 ring-1 ring-white/10">
                <div className="text-lg font-bold tabular-nums">{n}</div>
                <div className="text-[12px] uppercase tracking-wider text-muted">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-subtle/70 p-4">
        <div className="flex items-start gap-2.5">
          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <div>
            <h3 className="text-[13px] font-bold text-strong">Từ dữ liệu cảm biến đến một sự cố</h3>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted">Đây là phần tự động của hệ thống; các bước này không xuất hiện trong bảng nút của người dùng.</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2.5 lg:grid-cols-4">
          <div className="relative rounded-xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2"><Database className="h-4 w-4 text-info" /><b className="text-[12px] text-body">1. Dữ liệu FMS</b></div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">DP · RH · Nhiệt độ được lấy theo phút cho từng phòng và cảm biến đang kích hoạt.</p>
            <ChevronRight className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-subtle text-muted lg:block" />
          </div>
          <div className="relative rounded-xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-violet-600" /><b className="text-[12px] text-body">2. WF1 đánh giá</b></div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">Chuẩn hoá cửa sổ giờ, tính số điểm ngoài ngưỡng và 10 phút cuối theo cấu hình hiện hành.</p>
            <ChevronRight className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-subtle text-muted lg:block" />
          </div>
          <div className="relative rounded-xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2"><CircleDot className="h-4 w-4 text-danger" /><b className="text-[12px] text-body">3. Phân mức</b></div>
            <div className="mt-2 space-y-1 text-[9.8px] leading-snug">
              <p><b className="text-success">Bình thường:</b> OOS ngắn, hoặc 10′ cuối đã về dải — không mở phiếu; sự cố mở đủ 2 giờ sạch thì tự đóng.</p>
              <p><b className="text-danger">Nghiêm trọng:</b> OOS cả giờ &amp; 10′ cuối vẫn vượt ngưỡng — mở phiếu + đưa vào nhịp email WF8.</p>
            </div>
            <ChevronRight className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-subtle text-muted lg:block" />
          </div>
          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-danger" /><b className="text-[12px] text-body">4. Mở và điều phối</b></div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">Sự cố mới vào <b>Chưa xử lý</b>. WF8 nhắc đúng vai trò; WF6 giám sát nếu dữ liệu hoặc nhịp nhắc bị đình trệ.</p>
          </div>
        </div>
        <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-info-soft px-3 py-2 text-[12px] leading-relaxed text-info">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Khi công tắc <b>Phân công tự động</b> bật và điều kiện khớp, hệ thống có thể chuyển <b>Chưa xử lý → Đã báo Cơ điện</b>; nếu không, IPC thực hiện bước bàn giao.</span>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-bold text-strong">Lọc hành động theo vai trò</h3>
            <p className="mt-0.5 text-[12px] text-muted">Các trạng thái vẫn giữ nguyên vị trí để không mất bối cảnh luồng.</p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc sơ đồ theo vai trò">
            {["ALL", ...vaiCo].map((v) => {
              const on = vai === v;
              const m = v === "ALL" ? { net: "#102a43", nen: "#eef2f6", chu: "#334155" } : mv(v);
              const count = v === "ALL" ? tatCa.length : tatCa.filter((r) => r.vai_tro === v).length;
              return (
                <button key={v} type="button" aria-pressed={on} onClick={() => setVai(v)}
                  className="rounded-full px-3 py-1.5 text-[12px] font-bold transition ring-1 ring-inset"
                  style={on ? { background: m.net, color: "#fff", boxShadow: `inset 0 0 0 1px ${m.net}` } : { background: m.nen, color: m.chu, boxShadow: "inset 0 0 0 1px #e2e8f0" }}>
                  {v === "ALL" ? "Tất cả" : (VAI_TRO_TEN[v] || v)} · {count}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section aria-label="Luồng trạng thái xử lý sự cố" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {GIAI_DOAN.map((g, index) => (
          <div key={g.so} className="min-w-0">
            <div className="relative mb-3 rounded-2xl px-3.5 py-3 text-white" style={{ background: g.mau }}>
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-black tabular-nums opacity-55">{g.so}</span>
                <div><h3 className="text-[12.5px] font-bold">{g.ten}</h3><p className="text-[12px] text-white/75">{g.moTa}</p></div>
              </div>
              {index < GIAI_DOAN.length - 1 && <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 rounded-full bg-surface p-0.5 text-muted shadow ring-1 ring-line xl:block" />}
            </div>
            <div className="space-y-3">
              {g.states.map((ma) => <TheTrangThai key={ma} ma={ma} canh={canhTheoTu[ma] || []} taiCho={taiChoTheoTu[ma] || []} vai={vai} />)}
            </div>
          </div>
        ))}
      </section>

      {trangThaiKhac.length > 0 && (
        <section className="rounded-2xl border border-warning-line bg-warning-soft/50 p-4">
          <h3 className="text-[12px] font-bold text-warning">Trạng thái khác vừa xuất hiện trong bảng luật</h3>
          <p className="mt-1 text-[12px] text-warning/80">Sơ đồ vẫn hiển thị để không bỏ mất luồng mới; cần cập nhật mô tả nghiệp vụ nếu đây là thay đổi có chủ đích.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {trangThaiKhac.map((ma) => <TheTrangThai key={ma} ma={ma} canh={canhTheoTu[ma] || []} taiCho={taiChoTheoTu[ma] || []} vai={vai} />)}
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <NhomLuatToanCuc title="Có thể đóng từ mọi trạng thái đang mở" icon={LockKeyhole}
          description="Để riêng khỏi trục 01 → 04 vì các quyền này có thể kết thúc sự cố ở nhiều pha khác nhau."
          rules={batKyLoc} />
        <NhomLuatToanCuc title="Mở lại sự cố đã đóng" icon={RotateCcw}
          description="Chỉ áp dụng cho hồ sơ đã đóng; sau khi mở lại, luồng quay về pha IPC tiếp nhận."
          rules={moLaiLoc} />
        <NhomLuatToanCuc title="Thao tác toàn cục không đổi trạng thái" icon={ClipboardList}
          description="Ghi nhận, nhắc hoặc tạm hoãn nhưng không làm sự cố nhảy sang trạng thái khác."
          rules={taiChoToanCucLoc} />
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-danger-line bg-danger-soft/60 p-4">
          <div className="flex items-center gap-2 text-danger"><BellRing className="h-4 w-4" /><b className="text-[12px]">Trực HSL và nhịp nhắc</b></div>
          <p className="mt-2 text-[12px] leading-relaxed text-danger/70">Chỉ nhắc IPC/Cơ điện ở trạng thái họ thực sự nhận mail. Tạm hoãn 4 giờ phải có lý do; sự cố CRITICAL hoặc phòng P1 chỉ QA/Quản trị được hoãn.</p>
        </div>
        <div className="rounded-2xl border border-success-line bg-success-soft/60 p-4">
          <div className="flex items-center gap-2 text-success"><ShieldCheck className="h-4 w-4" /><b className="text-[12px]">QA kiểm soát hồ sơ</b></div>
          <p className="mt-2 text-[12px] leading-relaxed text-success/70">Khi Cơ điện báo không thể xử lý, QA được CC. QA đóng hoặc mở lại trên web theo bảng luật và phải ghi lý do khi xác nhận khắc phục.</p>
        </div>
        <div className="rounded-2xl border border-line bg-subtle/60 p-4">
          <div className="flex items-center gap-2 text-violet-800"><Wrench className="h-4 w-4" /><b className="text-[12px]">Cơ chế tự bảo vệ</b></div>
          <p className="mt-2 text-[12px] leading-relaxed text-violet-900/70">Sensor về bình thường đủ 2 giờ liên tiếp thì hệ thống tự đóng ở mọi pha. WF6 theo dõi nếu dữ liệu hoặc cảnh báo bị đứng để báo IT/QA.</p>
        </div>
      </section>

      <details className="group overflow-hidden rounded-2xl border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 hover:bg-subtle">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="h-4 w-4 text-muted" />
            <div><p className="text-[12px] font-bold text-body">Bảng luật đầy đủ · {tatCaLoc.length} dòng</p><p className="text-[12px] text-muted">Dùng để đối chiếu từng hành động với nguồn dữ liệu đang chạy</p></div>
          </div>
          <span className="rounded-lg bg-subtle px-2 py-1 text-[12px] font-semibold text-muted group-open:bg-anchorink group-open:text-white">Mở bảng</span>
        </summary>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-subtle text-[12px] uppercase tracking-wider text-muted">
              <tr>{["Vai trò", "Áp dụng từ", "Hành động", "Kết quả", "Điều kiện", "Thứ tự", "Nhóm nút"].map((h) => <th key={h} className="px-3 py-2.5 font-bold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {tatCaLoc.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-3 py-3"><VaiTroBadge vaiTro={r.vai_tro} small /></td>
                  <td className="px-3 py-3"><p className="text-[12px] font-semibold text-body">{r.tu === "*" ? "Mọi trạng thái" : tenTT(r.tu)}</p><code className="text-[12px] text-muted">{r.tu}</code></td>
                  <td className="px-3 py-3"><p className="text-[12px] font-semibold text-body">{r.nhan}</p><code className="text-[12px] text-muted">{r.hanh_dong}</code></td>
                  <td className="px-3 py-3"><div className="flex items-center gap-1.5 text-[12px] font-semibold text-body"><ArrowRight className="h-3 w-3 text-muted" />{r.giu ? "Giữ nguyên" : tenTT(r.den)}</div><code className="text-[12px] text-muted">{r.den}</code></td>
                  <td className="px-3 py-3"><DieuKienBang rule={r} /></td>
                  <td className="px-3 py-3 text-[12px] font-semibold tabular-nums text-muted">{r.thuTu}</td>
                  <td className="px-3 py-3"><code className="rounded bg-subtle px-1.5 py-1 text-[12px] text-muted">{r.bo_nut || "—"}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
