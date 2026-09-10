import React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock3, FileText, Inbox, MailCheck, RefreshCw } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import {
  buildResponseComparison,
  formatResponseDateTime,
  formatResponsePeriod,
  formatResponseRate,
  latestCompletedResponseWeek,
  shiftResponseWeek,
} from "./responseRateModel";

const ROLE_LABELS = { IPC: "IPC", MEP: "Cơ điện", LOT: "Trực HSL", QA: "QA" };

function roleLabel(role) {
  return ROLE_LABELS[role] || role || "—";
}

function sampleLabel(row) {
  return row.denominator > 0 ? `${row.responded}/${row.denominator} phản hồi` : "Không có mẫu";
}

function formatPoints(value) {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${String(value).replace(".", ",")} điểm %`;
}

function RateBar({ current, previous }) {
  const currentWidth = current == null ? 0 : Math.max(0, Math.min(100, current));
  const previousWidth = previous == null ? null : Math.max(0, Math.min(100, previous));
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-subtle ring-1 ring-line" aria-label={`Tuần này ${formatResponseRate(current)}; tuần trước ${formatResponseRate(previous)}`}>
      {previousWidth != null && <span aria-hidden="true" className="absolute inset-y-0 z-10 w-0.5 bg-info-solid" style={{ left: `calc(${previousWidth}% - 1px)` }} />}
      <span aria-hidden="true" className="block h-full rounded-full bg-primarytk-solid" style={{ width: `${currentWidth}%` }} />
    </div>
  );
}

function RateCard({ item }) {
  const { current, previous } = item;
  return (
    <div className="min-w-0 rounded-2xl bg-subtle p-4 ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">{roleLabel(item.role)}</p>
        <span className="shrink-0 text-[12px] text-muted">Tuần này</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-strong">{formatResponseRate(current.rate_pct)}</p>
      <p className="mt-1 text-[12px] text-body tabular-nums">{sampleLabel(current)}</p>
      <div className="mt-3"><RateBar current={current.rate_pct} previous={previous.rate_pct} /></div>
      <p className="mt-2 text-[12px] text-muted">Vạch xanh: tuần trước {formatResponseRate(previous.rate_pct)} · {sampleLabel(previous)}</p>
    </div>
  );
}

function LoadingState() {
  return <Card className="p-5" role="status" aria-label="Đang tải báo cáo phản hồi"><div className="h-5 w-56 max-w-full animate-pulse rounded bg-subtle" /><div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-subtle" />)}</div></Card>;
}

export default function ResponseRateReport({ data, loading = false, error = null, onRetry, start, end, onChangePeriod, isLive = true }) {
  const currentPeriod = data?.periods?.[0] || { start, end, rows: [], details: [] };
  const previousPeriod = data?.periods?.[1] || { rows: [], details: [] };
  const activePeriod = { start: start || currentPeriod.start, end: end || currentPeriod.end };
  const comparison = buildResponseComparison(data);
  const details = Array.isArray(currentPeriod.details) ? currentPeriod.details : [];
  const shownDetails = details.slice(0, 50);
  const nextPeriod = activePeriod.start && activePeriod.end ? shiftResponseWeek(activePeriod, 1) : null;
  const latest = latestCompletedResponseWeek();
  const cannotGoNext = !nextPeriod || activePeriod.end >= latest.end;
  const hasLegacy = Boolean(currentPeriod.has_legacy || previousPeriod.has_legacy);
  const hasRows = comparison.some((item) => item.current.denominator > 0 || item.previous.denominator > 0);

  if (loading) return <LoadingState />;
  if (error) return <Card className="p-5"><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger-soft p-4 ring-1 ring-danger-line" role="alert"><div className="flex min-w-0 items-start gap-2.5"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" /><div><p className="text-sm font-semibold text-danger">Chưa tải được báo cáo phản hồi</p><p className="mt-1 text-[12px] text-body">{typeof error === "string" ? error : "Vui lòng thử lại."}</p></div></div>{onRetry && <button type="button" onClick={onRetry} className="min-h-11 shrink-0 rounded-lg bg-surface px-3 py-2 text-[12px] font-semibold text-body ring-1 ring-danger-line hover:bg-danger-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focusring"><RefreshCw className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />Thử lại</button>}</div></Card>;
  if (!isLive) return <Card className="p-5"><div className="rounded-xl bg-warning-soft p-4 ring-1 ring-warning-line" role="status"><p className="text-sm font-semibold text-warning">Nguồn báo cáo hiện chưa sẵn sàng</p><p className="mt-1 text-[12px] leading-relaxed text-body">Chưa thể xác nhận các lượt gửi và phản hồi cho kỳ này. Số liệu sẽ hiển thị khi nguồn hoạt động lại.</p></div></Card>;

  const movePeriod = (direction) => {
    if (!activePeriod.start || !activePeriod.end || !onChangePeriod) return;
    const period = shiftResponseWeek(activePeriod, direction);
    if (period.start !== activePeriod.start || period.end !== activePeriod.end) onChangePeriod(period);
  };

  return (
    <Card className="overflow-hidden p-4 sm:p-5 print:break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionTitle icon={MailCheck} hint="chỉ phiếu gửi thành công trong giờ áp dụng">Phản hồi phiếu qua email</SectionTitle>
          <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-muted">Phạm vi: các khu vực bạn được cấp quyền. Mỗi phiếu–bộ phận chỉ tính một lần; lần nhắc và người nhận trùng đã được loại.</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-subtle p-1 ring-1 ring-line print:hidden" aria-label="Chọn kỳ báo cáo">
          <button type="button" onClick={() => movePeriod(-1)} aria-label="Xem tuần trước" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-body hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focusring"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
          <div className="min-w-[156px] px-1 text-center"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Kỳ đang xem</p><p className="mt-0.5 whitespace-nowrap text-[12px] font-semibold tabular-nums text-strong">{formatResponsePeriod(currentPeriod)}</p></div>
          <button type="button" onClick={() => movePeriod(1)} disabled={cannotGoNext} aria-label="Xem tuần kế tiếp" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-body hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focusring"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      </div>

      {hasRows || details.length ? <>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{comparison.map((item) => <RateCard key={item.role} item={item} />)}</div>

      <div className="mt-5 rounded-xl bg-info-soft p-3.5 ring-1 ring-info-line"><div className="flex gap-2.5"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" /><p className="text-[12px] leading-relaxed text-body">{hasLegacy && <span data-legacy-note="true">Kỳ so sánh có dữ liệu từ sổ gửi cũ; độ phủ của phần lịch sử này có thể chưa đầy đủ. </span>}Chỉ các lượt gửi và phản hồi xác minh được mới thuộc mẫu tính. Số phiếu của từng bộ phận được hiển thị kèm tỷ lệ để tránh suy diễn từ mẫu nhỏ.</p></div></div>

      <section className="mt-5" aria-labelledby="so-sanh-tuan-truoc">
        <h3 id="so-sanh-tuan-truoc" className="mb-2 text-[13px] font-semibold text-strong">So sánh với tuần trước</h3>
      <p className="text-[12px] text-muted sm:hidden">Vuốt ngang để xem đủ hai tuần và chênh lệch.</p>
      <div tabIndex={0} role="region" aria-label="Bảng so sánh phản hồi hai tuần, có thể cuộn ngang" className="overflow-x-auto rounded-xl ring-1 ring-line">
        <table className="w-full min-w-[620px] border-collapse text-left text-[12px]">
          <caption className="sr-only">So sánh tỷ lệ phản hồi giữa kỳ đang xem và tuần trước</caption>
          <thead className="bg-subtle text-muted"><tr><th scope="col" className="px-3 py-3 font-semibold">Bộ phận</th><th scope="col" className="px-3 py-3 font-semibold">Tuần này<span className="mt-0.5 block font-normal tabular-nums">{formatResponsePeriod(currentPeriod)}</span></th><th scope="col" className="px-3 py-3 font-semibold">Tuần trước<span className="mt-0.5 block font-normal tabular-nums">{formatResponsePeriod(previousPeriod)}</span></th><th scope="col" className="px-3 py-3 font-semibold">Chênh lệch</th></tr></thead>
          <tbody>{comparison.map((item) => <tr key={item.role} className="border-t border-line"><th scope="row" className="px-3 py-3 font-semibold text-strong">{roleLabel(item.role)}</th><td className="px-3 py-3 tabular-nums text-body">{item.current.denominator > 0 ? <>{formatResponseRate(item.current.rate_pct)} <span className="text-muted">· {sampleLabel(item.current)}</span></> : "Không có mẫu"}</td><td className="px-3 py-3 tabular-nums text-body">{item.previous.denominator > 0 ? <>{formatResponseRate(item.previous.rate_pct)} <span className="text-muted">· {sampleLabel(item.previous)}</span></> : "Không có mẫu"}</td><td className="px-3 py-3 font-semibold tabular-nums text-body">{formatPoints(item.delta_pct_points)}</td></tr>)}</tbody>
        </table>
      </div>
      </section>

      <details className="mt-5 rounded-xl bg-subtle p-3.5 ring-1 ring-line">
        <summary className="cursor-pointer text-[13px] font-semibold text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focusring">Chi tiết phiếu đã tính {details.length ? `(${Math.min(details.length, 50)}/${details.length})` : ""}</summary>
        {shownDetails.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[12px]"><thead className="text-muted"><tr><th className="pb-2 pr-3 font-semibold">Phiếu</th><th className="pb-2 pr-3 font-semibold">Bộ phận</th><th className="pb-2 pr-3 font-semibold">Phòng</th><th className="pb-2 pr-3 font-semibold">Gửi lần đầu</th><th className="pb-2 font-semibold">Phản hồi</th></tr></thead><tbody>{shownDetails.map((detail, index) => <tr key={`${detail.incident_id || "detail"}-${detail.role || ""}-${index}`} className="border-t border-line"><td className="py-2.5 pr-3 font-semibold text-strong">{detail.incident_id || "—"}</td><td className="py-2.5 pr-3 text-body">{roleLabel(detail.role)}</td><td className="py-2.5 pr-3 text-body">{detail.ma_phong || "—"}</td><td className="py-2.5 pr-3 tabular-nums text-body">{formatResponseDateTime(detail.first_sent)}</td><td className="py-2.5 tabular-nums text-body">{formatResponseDateTime(detail.response_at)}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-[12px] text-muted">Không có dòng chi tiết cho kỳ này.</p>}
        {details.length > shownDetails.length && <p className="mt-3 text-[12px] text-muted">Đang hiển thị 50/{details.length} dòng chi tiết.</p>}
      </details>
      </> : <div className="mt-5 rounded-xl bg-subtle p-6 text-center"><Inbox className="mx-auto h-8 w-8 text-muted" strokeWidth={1.6} aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-strong">Chưa có lượt gửi hợp lệ trong kỳ này</p><p className="mx-auto mt-1 max-w-xl text-[12px] leading-relaxed text-muted">Báo cáo chỉ tính phiếu đã gửi thành công trong giờ áp dụng. Không có lượt gửi hợp lệ không đồng nghĩa các bộ phận không phản hồi.</p></div>}
      <p className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] text-muted"><CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Kỳ báo cáo Thứ năm đến hết Thứ tư. <Clock3 className="ml-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />Ngoài giờ áp dụng không được tính.</p>
      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted"><FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Tỷ lệ phản ánh thao tác ghi nhận trên BMS, không phản ánh toàn bộ công việc của bộ phận.</p>
    </Card>
  );
}
