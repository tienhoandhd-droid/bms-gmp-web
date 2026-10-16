import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import puppeteer from "puppeteer";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "node_modules/.cache/bms-dialog-test");
let baseUrl;

async function taoTrangKiemThu() {
  mkdirSync(OUT, { recursive: true });
  await esbuild.build({
    stdin: {
      resolveDir: ROOT,
      loader: "jsx",
      sourcefile: "dialog-harness.jsx",
      contents: `
        import React, { useState } from "react";
        import { createRoot } from "react-dom/client";
        import { ApprovalModal } from "./src/features/incidents/IncidentsParts.jsx";
        import { ModalVeEmail } from "./src/features/reports/EmailParts.jsx";
        import { ModalKetLuanCum } from "./src/features/sensors/CamBienPage.jsx";

        let resolvePending;
        window.calls = 0;
        window.closes = 0;
        window.resolvePending = (value = { ok: true, thong_bao: "Đã lưu" }) => resolvePending?.(value);
        const pending = () => new Promise((resolve) => { resolvePending = resolve; });
        const incident = { id: "SC-1", room: "C1.R1", sensor: "DP", trail: [] };
        const action = { label: "Duyệt phiếu", next: "Đã duyệt" };
        const user = { name: "QA", role: "QA" };
        const ve = { bat_buoc_ly_do: false, vai_tro_can: "MEP", nhan: "Nhận việc", ma_hien_thi: "SC-1", ma_phong: "C1.R1", khu_vuc: "C1", loai_cam_bien: "DP", muc_canh_bao: "P1", trang_thai_hien_tai: "Mở", trang_thai_sau: "Đang xử lý" };
        const cum = { ma_hien_thi: "CUM-1", ahu: "AHU-1", loai_cam_bien: "DP", su_co_dang_mo: 1, nguyen_nhan_goc: "nguyên nhân hợp lệ", hanh_dong_khac_phuc: "khắc phục hợp lệ" };

        function Harness({ kind }) {
          const [open, setOpen] = useState(false);
          const close = () => { window.closes += 1; setOpen(false); };
          const run = () => { window.calls += 1; return pending(); };
          return <><button id="trigger" onClick={() => setOpen(true)}>Mở hộp thoại</button>{open && (kind === "approval"
            ? <ApprovalModal incident={incident} action={action} user={user} onClose={close} onCommit={run} />
            : kind === "email"
              ? <ModalVeEmail trangThai={{ ve }} onDong={close} onChay={run} />
              : <ClusterHarness close={close} />)}</>;
        }
        function ClusterHarness({ close }) {
          const [running, setRunning] = useState(false);
          const save = async () => {
            window.calls += 1;
            setRunning(true);
            await pending();
            setRunning(false);
            close();
          };
          return <ModalKetLuanCum cum={cum} dangChay={running} onDong={close} onLuu={save} />;
        }
        window.mount = (kind) => createRoot(document.getElementById("root")).render(<Harness kind={kind} />);
      `,
    },
    outfile: resolve(OUT, "bundle.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    define: { "import.meta.env": "{}" },
    logLevel: "silent",
  });
}

function moServer() {
  const html = "<!doctype html><html><body><div id=\"root\"></div><script src=\"/bundle.js\"></script></body></html>";
  return new Promise((resolveServer) => {
    const server = http.createServer((req, res) => {
      res.setHeader("content-type", req.url === "/bundle.js" ? "text/javascript" : "text/html");
      res.end(req.url === "/bundle.js" ? readFileSync(resolve(OUT, "bundle.js")) : html);
    }).listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolveServer(server);
    });
  });
}

async function moModal(page, kind) {
  await page.goto(baseUrl);
  await page.waitForFunction(() => typeof window.mount === "function");
  await page.evaluate((k) => window.mount(k), kind);
  await page.click("#trigger");
  await page.waitForSelector('[role="dialog"]');
}

const bamBackdrop = (page) => page.evaluate(() => {
  const backdrop = document.querySelector('[role="dialog"]').parentElement;
  backdrop.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
});

test("hộp thoại khóa đóng và submit lặp trong khi tác vụ đang chạy", async (t) => {
  await taoTrangKiemThu();
  const server = await moServer();
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  t.after(async () => { await browser.close(); await new Promise((resolveClose) => server.close(resolveClose)); });
  const page = await browser.newPage();

  await t.test("ApprovalModal chỉ commit một lần, Esc/backdrop/nút đóng đều bị khóa khi pending", async () => {
    await moModal(page, "approval");
    await page.type("textarea", "lý do hợp lệ");
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Xác nhận & lưu"));
      button.click(); button.click();
    });
    await page.keyboard.press("Escape");
    await bamBackdrop(page);
    const state = await page.evaluate(() => ({ calls: window.calls, closes: window.closes, disabled: [...document.querySelectorAll("button")].filter((b) => /Hủy|Đóng hộp thoại/.test(b.textContent + b.getAttribute("aria-label"))).every((b) => b.disabled), open: !!document.querySelector('[role="dialog"]') }));
    assert.deepEqual(state, { calls: 1, closes: 0, disabled: true, open: true });
  });

  await t.test("ModalVeEmail trap focus và khóa Esc/backdrop/Huỷ khi pending", async () => {
    await moModal(page, "email");
    const focusBanDau = await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement));
    assert.equal(focusBanDau, true, "focus đi vào hộp thoại khi mở");
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Xác nhận").focus());
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), "Huỷ", "Tab từ phần tử cuối quay về phần tử đầu");
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Xác nhận").click());
    await page.keyboard.press("Escape");
    await bamBackdrop(page);
    const state = await page.evaluate(() => ({ calls: window.calls, closes: window.closes, cancelDisabled: [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Huỷ")?.disabled, open: !!document.querySelector('[role="dialog"]') }));
    assert.deepEqual(state, { calls: 1, closes: 0, cancelDisabled: true, open: true });
    await page.evaluate(() => window.resolvePending());
    await page.waitForFunction(() => document.body.innerText.includes("Đã ghi nhận"));
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Xong").click());
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    assert.equal(await page.evaluate(() => document.activeElement.id), "trigger", "focus trở về nút mở sau khi đóng");
  });

  await t.test("ModalKetLuanCum chỉ lưu một lần và khóa mọi đường đóng tới khi Promise của cha hoàn tất", async () => {
    await moModal(page, "cluster");
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Lưu kết luận");
      button.click(); button.click();
    });
    await page.keyboard.press("Escape");
    await bamBackdrop(page);
    const state = await page.evaluate(() => ({ calls: window.calls, closes: window.closes, cancelDisabled: [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Huỷ")?.disabled, open: !!document.querySelector('[role="dialog"]') }));
    assert.deepEqual(state, { calls: 1, closes: 0, cancelDisabled: true, open: true });
    await page.evaluate(() => window.resolvePending());
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    assert.equal(await page.evaluate(() => document.activeElement.id), "trigger", "focus trở về trigger sau khi lưu xong");
  });
});
