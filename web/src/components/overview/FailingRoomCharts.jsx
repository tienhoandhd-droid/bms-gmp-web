import React, { useId, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import Chart from '../ui/Chart';
import { Card, SectionTitle } from '../ui/Card';
import { SENSOR_META } from '../../lib/uiConst';
import { sensorStats, roomCompliance } from '../../lib/moPhong';
import { chooseSensor, normalizeHourlyPoints } from '../../lib/overviewSnapshot';

const PAGE_SIZE = 4;
function RoomChart({ room, onDetail }) {
  const fieldId = useId();
  const sensors = (room.sensors || []).map(s => ({ ...s, stats: sensorStats(room.id, s, room._isLive) }));
  const [chosen, setChosen] = useState(null);
  const sensor = sensors.find(s => s.k === chosen) || sensors.find(s => s.k === chooseSensor(sensors));
  const points = normalizeHourlyPoints(sensor?.stats.hourly8);
  const hasData = points.some(p => p.avg != null);
  const meta = SENSOR_META[sensor?.k] || { label: 'Chỉ tiêu', unit: '' };
  const compliance = roomCompliance(room);
  const limit = sensor ? [sensor.min != null ? `≥ ${sensor.min}` : null, sensor.max != null ? `≤ ${sensor.max}` : null].filter(Boolean).join(' · ') : '';
  return <Card className="bms-overview-chart" data-room-chart={room.id}>
    <div className="bms-chart-heading">
      <div className="min-w-0"><h3>{room.id} · {room.name}</h3><p>{room.ahu || room.area}{room.window ? ` · kỳ ${room.window}` : ' · 8 giờ gần nhất'}</p></div>
      <div className="bms-chart-verdict"><strong>{compliance == null ? '—' : `${compliance}%`}</strong><span>tỷ lệ đạt 1h</span></div>
    </div>
    <div className="bms-chart-toolbar">
      <div><label htmlFor={fieldId}>Chỉ tiêu</label><select id={fieldId} aria-label={`Chỉ tiêu phòng ${room.id}`} value={sensor?.k || ''} onChange={e => setChosen(e.target.value)} disabled={!sensors.length}>{sensors.map(s => <option key={s.k} value={s.k}>{SENSOR_META[s.k]?.label || s.k}</option>)}{!sensors.length && <option value="">Chưa có chỉ tiêu</option>}</select></div>
      <p>{limit ? <>Giới hạn <strong>{limit} {meta.unit}</strong></> : 'Chưa cấu hình giới hạn'}</p>
    </div>
    <figure aria-label={`${meta.label} phòng ${room.id}, trung bình từng giờ`}>
      {room._historyState === "loading" ? <div className="bms-chart-empty bg-subtle animate-pulse" role="status">Đang tải chuỗi số liệu…</div> : room._historyState === "error" ? <div className="bms-chart-empty" role="status">Chưa tải được chuỗi số liệu. Hãy tải lại trang để thử lại.</div> : hasData ? <Chart type="roomDetail" h={182} pts={points} smin={sensor.min} smax={sensor.max} mean={null} unit={meta.unit} /> : <div className="bms-chart-empty" role="status">Chưa có chuỗi số liệu theo giờ để vẽ biểu đồ.</div>}
      <figcaption><span className="bms-chart-line-key" aria-hidden="true" /> Trung bình giờ ({meta.unit || '—'}){points.some(p => p.vmin != null && p.vmax != null) && <><span className="bms-chart-band-key" aria-hidden="true" /> Min–Max</>}<span className="bms-chart-limit-key" aria-hidden="true" /> Giới hạn<span className="bms-chart-alert-key" aria-hidden="true">◆</span> Ngoài giới hạn</figcaption>
    </figure>
    <div className="bms-chart-actions">
      <details><summary>Bảng số liệu</summary><div className="bms-chart-table"><table><caption className="sr-only">{meta.label} phòng {room.id} theo giờ, đơn vị {meta.unit}</caption><thead><tr><th scope="col">Giờ</th><th scope="col">Trung bình</th><th scope="col">Min</th><th scope="col">Max</th><th scope="col">Đánh giá TB</th></tr></thead><tbody>{points.map((p,i) => <tr key={`${p.label}-${i}`}><th scope="row">{p.label}</th><td>{p.avg ?? '—'}</td><td>{p.vmin ?? '—'}</td><td>{p.vmax ?? '—'}</td><td>{p.avg == null ? 'Thiếu số liệu' : (sensor.min != null && p.avg < sensor.min) || (sensor.max != null && p.avg > sensor.max) ? 'Ngoài giới hạn' : limit ? 'Trong giới hạn' : 'Chưa có giới hạn'}</td></tr>)}{!points.length && <tr><td colSpan={5}>{room._historyState === "loading" ? "Đang tải chuỗi số liệu…" : room._historyState === "error" ? "Chưa tải được chuỗi số liệu" : "Chưa có số liệu"}</td></tr>}</tbody></table></div></details>
      <button type="button" onClick={() => onDetail(room)} aria-label={`Xem chi tiết biểu đồ phòng ${room.id}`}>Chi tiết phòng <ArrowRight aria-hidden="true" size={15} /></button>
    </div>
  </Card>;
}

export default function FailingRoomCharts({ rooms = [], loading = false, sourceInterrupted = false, error = null, onDetail }) {
  const [offset, setOffset] = useState(0);
  const count = rooms.length;
  const page = Math.min(offset, Math.max(0, Math.ceil(count / PAGE_SIZE) - 1));
  const visible = rooms.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const headingId = useId();
  return <section className="bms-failing-charts" aria-labelledby={headingId}>
    <div className="bms-chart-section-heading"><div id={headingId}><SectionTitle hint="Trung bình từng giờ · 8 giờ gần nhất">Biểu đồ phòng không đạt</SectionTitle></div><span className="bms-chart-count">{loading ? 'Đang tải' : `${count} phòng`}</span></div>
    {error ? <Card className="bms-chart-empty" role="alert">Chưa tải được dữ liệu để xác minh biểu đồ phòng. Hãy tải lại trang hoặc kiểm tra kết nối.</Card>
      : sourceInterrupted ? <Card className="bms-chart-empty">Nguồn dữ liệu đang gián đoạn. Chưa thể xác định phòng không đạt trong kỳ hiện tại.</Card>
      : loading ? <div className="bms-overview-chart-grid" role="status" aria-label="Đang tải biểu đồ phòng"><div className="bms-chart-skeleton animate-pulse" /><div className="bms-chart-skeleton animate-pulse" /></div>
      : count === 0 ? <Card className="bms-chart-empty">Không có phòng không đạt trong số phòng đủ dữ liệu của kỳ chốt gần nhất.</Card>
      : <><div className="bms-overview-chart-grid">{visible.map(room => <RoomChart key={room.id} room={room} onDetail={onDetail} />)}</div>
        <div className="bms-chart-pagination"><p role="status">Đang xem {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, count)} / {count} phòng không đạt</p>{count > PAGE_SIZE && <div><button type="button" disabled={page === 0} onClick={() => setOffset(page - 1)} aria-label="Nhóm phòng trước"><ChevronLeft size={16} aria-hidden="true" />Trước</button><button type="button" disabled={(page + 1) * PAGE_SIZE >= count} onClick={() => setOffset(page + 1)} aria-label="Nhóm phòng tiếp">Tiếp<ChevronRight size={16} aria-hidden="true" /></button></div>}</div></>}
  </section>;
}
