// Presentation of hourly snapshots. Server flags remain authoritative.
const finite = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
export function normalizeHourlyPoints(points = []) {
  return points.map(p => ({ label: p.label, avg: finite(p.avg), vmin: finite(p.vmin), vmax: finite(p.vmax) }));
}
export function chooseSensor(sensors = []) {
  const available = sensors.filter(s => normalizeHourlyPoints(s.stats?.hourly8).some(p => p.avg != null));
  return [...available].sort((a,b) => (b.stats?.oos1h ?? -1) - (a.stats?.oos1h ?? -1))[0]?.k ?? sensors[0]?.k ?? null;
}
export function missingSnapshot(room, { sourceInterrupted = false, freshnessMinutes = 120 } = {}) {
  const previous = room.window ? `Kỳ cuối nhận được: ${room.window}${room.lastSeen ? ` · chốt ${room.lastSeen}` : ''}.` : 'Chưa nhận được khung giờ hoàn chỉnh.';
  if (sourceInterrupted) return { label: 'Nguồn dữ liệu gián đoạn', detail: `${previous} Tạm dừng đánh giá phòng.` };
  if (room.agePhut != null && room.agePhut > freshnessMinutes) return { label: 'Số liệu đã quá cũ', detail: `${previous} Đã vượt thời gian chờ cập nhật.` };
  if (room.duLieuCu) return { label: 'Chưa có số liệu kỳ mới', detail: `${previous} Chưa đủ dữ liệu để đánh giá kỳ mới.` };
  if (room.noData) return { label: 'Chưa có số liệu', detail: previous };
  return null;
}

export function hourlyMean(points = []) {
  const values = normalizeHourlyPoints(points).map(p => p.avg).filter(v => v != null);
  return values.length ? Number((values.reduce((sum,v) => sum + v, 0) / values.length).toFixed(1)) : null;
}
