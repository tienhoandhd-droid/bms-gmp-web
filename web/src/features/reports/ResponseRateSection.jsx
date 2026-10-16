import React, { useEffect, useState } from 'react';
import { goiRPC } from '../../lib/bmsClient';
import ResponseRateReport from './ResponseRateReport';
import { latestCompletedWeek } from './responseRateModel';

export default function ResponseRateSection({ isLive }) {
  const [period, setPeriod] = useState(() => latestCompletedWeek());
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);
  const key = `${period.start}:${period.end}`;
  useEffect(() => {
    if (!isLive) return undefined;
    const controller = new AbortController();
    let cancelled = false;
    setResult(null);
    goiRPC('rpc_bao_cao_phan_hoi_mail', { p_tu: period.start, p_den: period.end },
      { signal: controller.signal, timeoutMs: 30000, soLanThu: 1 })
      .then(({ data, error }) => {
        if (cancelled) return;
        const valid = Array.isArray(data?.periods) && data.periods.length === 2
          && data.periods[0].start === period.start && data.periods[0].end === period.end;
        setResult({ key, data: !error && valid ? data : null,
          error: error || !valid ? 'Chưa tải được báo cáo phản hồi của kỳ này. Vui lòng thử lại.' : null });
      }).catch(() => {
        if (!cancelled) setResult({ key, data: null, error: 'Không kết nối được dữ liệu báo cáo. Vui lòng thử lại.' });
      });
    return () => { cancelled = true; controller.abort(); };
  }, [isLive, period.start, period.end, retry, key]);
  const current = result?.key === key ? result : null;
  return <ResponseRateReport isLive={isLive} start={period.start} end={period.end}
    data={isLive ? current?.data : null} loading={isLive && !current}
    error={current?.error} onRetry={() => setRetry(n => n + 1)}
    onChangePeriod={setPeriod} />;
}
