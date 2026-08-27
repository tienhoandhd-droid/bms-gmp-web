// =============================================================================
// Edge Function: capnhat-phut-8h
// Web (tab "Sự cố gần đây") gọi mỗi 60s → hàm này ĐĂNG NHẬP FMS phía server,
// lấy điểm-phút MỚI của các phòng-sensor đang có sự cố (≤8h), ghi vào bảng
// du_lieu_phut_8h và tự xoá điểm >8h. Mật khẩu FMS nằm trong Secret của
// Edge Function (KHÔNG lộ ra web tĩnh); FMS không cho gọi trực tiếp từ trình
// duyệt (CORS) nên bắt buộc qua lớp server này.
//
// Secrets cần đặt (Supabase → Edge Functions → Manage secrets):
//   FMS_BASE_URL, FMS_USERNAME, FMS_PASSWORD, BMS_TOKEN
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY do Supabase tự cấp.)
// Xác thực: web gửi header  x-bms-token: <webhook_token_web>  (lấy qua RPC).
// =============================================================================

import {
  ROOM_CONCURRENCY,
  clampFromIso,
  dedupeRows,
  isRunFailure,
  mapWithConcurrency,
} from "./core.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-bms-token, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FMS_BASE = (Deno.env.get("FMS_BASE_URL") || "").replace(/\/+$/, "");
const FMS_USER = Deno.env.get("FMS_USERNAME") || "";
const FMS_PASS = Deno.env.get("FMS_PASSWORD") || "";
const BMS_TOKEN = (Deno.env.get("BMS_TOKEN") || "").trim();
const RUN_TIMEOUT_MS = 28_000;
const FINISH_TIMEOUT_MS = 5_000;

type SensorLimit = {
  lo: number | null;
  hi: number | null;
  from: string;
};

type RoomInfo = {
  from: string;
  sensors: Map<string, SensorLimit>;
};

type RunResult = {
  ok: boolean;
  status: string;
  so_phong: number;
  so_diem: number;
  so_loi_phong: number;
  error?: string;
};

class HttpError extends Error {
  httpStatus: number;

  constructor(message: string, httpStatus = 500) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

function normType(t: string | undefined): string | null {
  if (!t) return null;
  t = String(t).toUpperCase().trim();
  if (t === "AT" || t === "T" || t.startsWith("TEMP")) return "T";
  if (t === "H" || t === "RH" || t.startsWith("HUM")) return "RH";
  if (t === "DP" || t.includes("PRESS") || t.includes("DIFF")) return "DP";
  return null;
}

// "YYYY-MM-DD HH:MM:SS" (giờ VN, UTC+7) → ISO UTC, cắt về đầu phút
function vnToUtcMinuteIso(s: string): string | null {
  const m = String(s || "").match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const utcMs = Date.UTC(+y, +mo - 1, +d, +h, +mi, 0) - 7 * 3600 * 1000;
  return new Date(utcMs).toISOString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function boundedError(error: unknown): string {
  return errorMessage(error).slice(0, 1000);
}

async function sbRpc(fn: string, body: unknown, signal?: AbortSignal) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal,
  });
  if (!r.ok) throw new Error(`RPC ${fn} ${r.status}`);
  return r.json();
}

export function createHandler(options: {
  runTimeoutMs?: number;
  finishTimeoutMs?: number;
} = {}) {
  const runTimeoutMs = options.runTimeoutMs ?? RUN_TIMEOUT_MS;
  const finishTimeoutMs = options.finishTimeoutMs ?? FINISH_TIMEOUT_MS;

  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    const json = (o: unknown, status = 200) =>
      new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

    // --- Xác thực token (chống gọi nặc danh, cùng token webhook web) ---
    const tok = (req.headers.get("x-bms-token") || "").trim();
    if (!BMS_TOKEN || !tok || tok !== BMS_TOKEN) {
      return json({
        ok: false,
        status: "REJECTED",
        so_phong: 0,
        so_diem: 0,
        so_loi_phong: 0,
        error: "KHONG_XAC_THUC",
      }, 403);
    }

    const runSignal = AbortSignal.any([
      req.signal,
      AbortSignal.timeout(runTimeoutMs),
    ]);

    try {
      // Claim phải hoàn tất trước RPC danh sách theo dõi và trước request FMS đầu tiên.
      const claim = await sbRpc("rpc_claim_capnhat_phut_8h", {}, runSignal);
    const claimStatus = String(claim?.status || "");
    if (claim?.ok === true && claimStatus.startsWith("SKIPPED_")) {
      return json({
        ok: true,
        status: claimStatus,
        so_phong: 0,
        so_diem: 0,
        so_loi_phong: 0,
      });
    }
    if (claim?.ok !== true || claimStatus !== "CLAIMED" || !claim?.token) {
      throw new Error(`claim không hợp lệ: ${claimStatus || "UNKNOWN"}`);
    }

    const claimToken = String(claim.token);
    let result: RunResult = {
      ok: false,
      status: "FAILED",
      so_phong: 0,
      so_diem: 0,
      so_loi_phong: 0,
    };
    let responseStatus = 500;
    let finishBody = {
      p_token: claimToken,
      p_ok: false,
      p_error: null as string | null,
      p_degraded: false,
    };
    let finishError: string | null = null;

    try {
      const nowMs = Date.now();

      // 1) Danh sách phòng-sensor cần theo dõi + giới hạn + mốc lấy tiếp
      const list: Array<{
        ma_phong: string;
        loai_cam_bien: string;
        gioi_han_duoi: number | null;
        gioi_han_tren: number | null;
        tu_thoi_diem: string;
      }> = await sbRpc("rpc_phong_sensor_theo_doi_8h", {}, runSignal);
      if (!Array.isArray(list)) throw new Error("RPC phòng-sensor không trả danh sách");

      if (!list.length) {
        result = {
          ok: true,
          status: "FINISHED",
          so_phong: 0,
          so_diem: 0,
          so_loi_phong: 0,
        };
        responseStatus = 200;
        finishBody = {
          p_token: claimToken,
          p_ok: true,
          p_error: null,
          p_degraded: false,
        };
      } else {
        // Gom theo phòng: giới hạn per sensor + mốc from sớm nhất của phòng
        const perRoom = new Map<string, RoomInfo>();
        for (const it of list) {
          let room = perRoom.get(it.ma_phong);
          if (!room) {
            room = { from: it.tu_thoi_diem, sensors: new Map() };
            perRoom.set(it.ma_phong, room);
          }
          if (it.tu_thoi_diem < room.from) room.from = it.tu_thoi_diem;
          room.sensors.set(it.loai_cam_bien, {
            lo: it.gioi_han_duoi,
            hi: it.gioi_han_tren,
            from: it.tu_thoi_diem,
          });
        }
        result.so_phong = perRoom.size;

        // 2) Đăng nhập FMS
        const lg = await fetch(`${FMS_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
          body: JSON.stringify({ username: FMS_USER, password: FMS_PASS }),
          signal: runSignal,
        });
        if (!lg.ok) throw new HttpError(`FMS login ${lg.status}`, 502);
        const token = (await lg.json())?.data?.access_token;
        if (!token) throw new HttpError("FMS không trả token", 502);
        const H = { Authorization: `Bearer ${token}`, "X-Requested-With": "XMLHttpRequest" };

        // 3) Map ma_phong (FMS field `id`) → _id kỹ thuật
        const rr = await fetch(`${FMS_BASE}/bms-room/rooms`, { headers: H, signal: runSignal });
        if (!rr.ok) throw new HttpError(`FMS rooms ${rr.status}`, 502);
        const rooms = (await rr.json())?.data || [];
        const idToTech = new Map<string, string>();
        for (const rm of rooms) {
          if (rm?.id) idToTech.set(String(rm.id), String(rm._id || rm.id));
        }

        // 4) Với mỗi phòng: lấy sensor-data cửa sổ [from..now], lọc sensor cần, dựng rows
        const nowVn = new Date(nowMs + 7 * 3600 * 1000);
        const toStr = nowVn.toISOString().slice(0, 19).replace("T", " ");
        const rows: Array<Record<string, unknown>> = [];
        const roomEntries = [...perRoom.entries()];
        const roomErrors: string[] = [];

        await mapWithConcurrency(
          roomEntries,
          ROOM_CONCURRENCY,
          async (entry: [string, RoomInfo]) => {
            const [maPhong, info] = entry;
            const roomRows: Array<Record<string, unknown>> = [];
            try {
              const tech = idToTech.get(maPhong);
              if (!tech) throw new Error("không tìm thấy ánh xạ phòng FMS");

              const fromIso = clampFromIso(info.from, nowMs);
              const fromVn = new Date(Date.parse(fromIso) + 7 * 3600 * 1000)
                .toISOString().slice(0, 19).replace("T", " ");
              const u = new URL(`${FMS_BASE}/bms-room/rooms/${tech}/sensors-data`);
              u.searchParams.set("fromDate", fromVn);
              u.searchParams.set("toDate", toStr);
              const resp = await fetch(u.toString(), { headers: H, signal: runSignal });
              if (!resp.ok) throw new Error(`sensor-data ${resp.status}`);

              const room = (await resp.json())?.data;
              const arr = Array.isArray(room?.sensors) ? room.sensors : [];
              for (const sensor of arr) {
                const type = normType(sensor?.type || sensor?.id);
                if (!type || !info.sensors.has(type)) continue;
                const lim = info.sensors.get(type)!;
                const sensorFromIso = clampFromIso(lim.from, nowMs);
                const params = Array.isArray(sensor?.params) ? sensor.params : [sensor];
                let best: any = null;
                for (const p of params) {
                  if (!best || (Array.isArray(p?.data) ? p.data.length : 0) >
                    (Array.isArray(best?.data) ? best.data.length : 0)) best = p;
                }
                for (const dp of (best?.data || [])) {
                  const iso = vnToUtcMinuteIso(dp?.dateAndTime);
                  if (!iso || iso <= sensorFromIso) continue; // chỉ điểm mới hơn mốc đã chuẩn hoá

                  const v = dp?.val ?? dp?.value;
                  if (v === null || v === undefined ||
                    (typeof v === "string" && v.trim() === "")) {
                    throw new Error("giá trị sensor không hợp lệ");
                  }
                  const val = Number(v);
                  if (!Number.isFinite(val)) throw new Error("giá trị sensor không hợp lệ");
                  const oos = (lim.lo != null && val < lim.lo) || (lim.hi != null && val > lim.hi);
                  roomRows.push({
                    ma_phong: maPhong,
                    loai_cam_bien: type,
                    thoi_diem: iso,
                    gia_tri: val,
                    gioi_han_duoi: lim.lo,
                    gioi_han_tren: lim.hi,
                    oos,
                  });
                }
              }
              for (const row of roomRows) rows.push(row);
            } catch (error) {
              roomErrors.push(`${maPhong}: ${boundedError(error)}`);
            }
          },
        );

        // 5) Upsert (dedupe theo PK) + dọn >8h
        let ghi = 0;
        if (rows.length) {
          const uniq = dedupeRows(rows);
          const up = await fetch(`${SB_URL}/rest/v1/du_lieu_phut_8h?on_conflict=ma_phong,loai_cam_bien,thoi_diem`, {
            method: "POST",
            headers: {
              apikey: SB_KEY,
              Authorization: `Bearer ${SB_KEY}`,
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates,return=minimal",
            },
            body: JSON.stringify(uniq),
            signal: runSignal,
          });
          if (!up.ok) throw new HttpError(`upsert ${up.status}`, 500);
          ghi = uniq.length;
        }
        await sbRpc("rpc_don_du_lieu_phut_8h", {}, runSignal).catch(() => {});

        const roomFailureCount = roomErrors.length;
        const runFailed = isRunFailure(perRoom.size, roomFailureCount);
        const degraded = !runFailed && roomFailureCount > 0;
        const runError = roomFailureCount > 0 ? boundedError(roomErrors.join("; ")) : null;
        result = {
          ok: !runFailed,
          status: runFailed ? "FAILED" : degraded ? "DEGRADED" : "FINISHED",
          so_phong: perRoom.size,
          so_diem: ghi,
          so_loi_phong: roomFailureCount,
          ...(runError ? { error: runError } : {}),
        };
        responseStatus = runFailed ? 502 : 200;
        finishBody = {
          p_token: claimToken,
          p_ok: !runFailed,
          p_error: runError,
          p_degraded: degraded,
        };
      }
    } catch (error) {
      const message = boundedError(error);
      result = {
        ...result,
        ok: false,
        status: "FAILED",
        error: message,
      };
      responseStatus = error instanceof HttpError ? error.httpStatus : 500;
      finishBody = {
        p_token: claimToken,
        p_ok: false,
        p_error: message,
        p_degraded: false,
      };
    } finally {
      try {
        const finish = await sbRpc(
          "rpc_finish_capnhat_phut_8h",
          finishBody,
          AbortSignal.timeout(finishTimeoutMs),
        );
        if (finish?.ok !== true) {
          throw new Error(`finish bị từ chối: ${String(finish?.status || "UNKNOWN")}`);
        }
      } catch (error) {
        finishError = boundedError(error);
      }
    }

    if (finishError) {
      return json({
        ...result,
        ok: false,
        status: "FINISH_FAILED",
        error: boundedError(`${result.error ? `${result.error}; ` : ""}finish: ${finishError}`),
      }, 500);
    }
    return json(result, responseStatus);
    } catch (error) {
      return json({
        ok: false,
        status: "FAILED",
        so_phong: 0,
        so_diem: 0,
        so_loi_phong: 0,
        error: boundedError(error),
      }, 500);
    }
  };
}

Deno.serve(createHandler());
