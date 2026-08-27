export const BACKFILL_MS = 10 * 60 * 1000
export const ROOM_CONCURRENCY = 3

export function clampFromIso(fromIso, nowMs) {
  const fromMs = Date.parse(fromIso)
  const oldestMs = nowMs - BACKFILL_MS
  return new Date(Number.isFinite(fromMs) && fromMs >= oldestMs ? fromMs : oldestMs).toISOString()
}

export async function mapWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0
  const results = new Array(items.length)

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  )
  return results
}

export function isRunFailure(totalRooms, failedRooms) {
  return failedRooms >= Math.ceil(totalRooms * 0.20)
}

export function dedupeRows(rows) {
  const seen = new Set()
  return rows.filter((row) => {
    const key = `${row.ma_phong}|${row.loai_cam_bien}|${row.thoi_diem}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
