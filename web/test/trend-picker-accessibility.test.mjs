import test from "node:test";
import assert from "node:assert/strict";
import puppeteer from "puppeteer";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));

test("trend scope picker exposes combobox semantics and supports keyboard selection", async (t) => {
  // Unit tests must also work on a fresh CI runner without a manually started preview.
  const server = process.env.BMS_BASE_URL ? null : await createServer({
    root: WEB_ROOT,
    logLevel: "error",
    server: { host: "127.0.0.1", strictPort: false },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(""),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(""),
    },
  });
  let browser;
  t.after(async () => { await browser?.close(); await server?.close(); });
  if (server) await server.listen();
  const baseUrl = process.env.BMS_BASE_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
  if (server) t.diagnostic(`Isolated demo server: ${baseUrl}`);
  browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/?tab=trend`, { waitUntil: "networkidle2" });

  const dateControls = await page.evaluate(() => ({
    fromLabel: document.querySelector('label[for="trend-date-from"]')?.textContent,
    toLabel: document.querySelector('label[for="trend-date-to"]')?.textContent,
    fromHeight: document.querySelector('#trend-date-from')?.getBoundingClientRect().height,
    toHeight: document.querySelector('#trend-date-to')?.getBoundingClientRect().height,
    status: document.querySelector('[role="status"]')?.textContent,
  }));
  assert.deepEqual(dateControls.fromLabel, "Từ");
  assert.deepEqual(dateControls.toLabel, "Đến");
  assert.ok(dateControls.fromHeight >= 44 && dateControls.toHeight >= 44, "date controls need 44px hit areas");
  assert.match(dateControls.status, /Đang xem \d+\/\d+ điểm/);
  await page.evaluate(() => [...document.querySelectorAll("button")]
    .find((button) => button.textContent.trim() === "Áp dụng")?.click());
  await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.includes("Đã áp dụng khoảng thời gian."));

  await page.evaluate(() => [...document.querySelectorAll("button")]
    .find((button) => button.textContent.trim() === "Khu vực")?.click());
  await page.waitForFunction(() => document.querySelector('[role="combobox"]'));

  const combobox = await page.$('[role="combobox"]');
  const before = await combobox.evaluate((input) => ({
    expanded: input.getAttribute("aria-expanded"),
    controls: input.getAttribute("aria-controls"),
  }));
  assert.equal(before.expanded, "false");
  assert.ok(before.controls, "combobox must control a listbox");

  await combobox.focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForSelector('[role="listbox"]');
  const opened = await combobox.evaluate((input) => ({
    expanded: input.getAttribute("aria-expanded"),
    active: input.getAttribute("aria-activedescendant"),
    activeRole: document.getElementById(input.getAttribute("aria-activedescendant"))?.getAttribute("role"),
  }));
  assert.equal(opened.expanded, "true");
  assert.equal(opened.activeRole, "option");
  assert.equal(await page.$eval('[role="listbox"]', (listbox) => listbox.id), before.controls);

  const prior = await combobox.evaluate((input) => input.value);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForFunction((value) => {
    const input = document.querySelector('[role="combobox"]');
    return input?.getAttribute("aria-expanded") === "false" && input.value !== value;
  }, {}, prior);
  assert.equal(await combobox.evaluate((input) => input.getAttribute("aria-expanded")), "false");

  await combobox.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  assert.equal(await combobox.evaluate((input) => input.getAttribute("aria-expanded")), "false");

  await combobox.focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.querySelector('[role="combobox"]')?.getAttribute("aria-expanded") === "true");
  await page.keyboard.press("Tab");
  assert.match(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""), /Đóng danh sách phạm vi/);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('[role="combobox"]')?.getAttribute("aria-expanded") === "false");

  await combobox.focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.querySelector('[role="combobox"]')?.getAttribute("aria-expanded") === "true");
  await page.keyboard.press("Tab");
  assert.equal(await combobox.evaluate((input) => input.getAttribute("aria-expanded")), "true");
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => document.querySelector('[role="combobox"]')?.getAttribute("aria-expanded") === "false");

  await combobox.focus();
  await page.keyboard.type("không-có-kết-quả-98273");
  await page.waitForFunction(() => document.querySelector('[role="listbox"]')?.querySelectorAll('[role="option"]').length === 0);
  await page.evaluate(() => {
    document.addEventListener("keydown", (event) => { window.__trendArrowDefaultPrevented = event.defaultPrevented; }, { once: true });
  });
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => window.__trendArrowDefaultPrevented), true);
  assert.equal(await combobox.evaluate((input) => input.getAttribute("aria-activedescendant")), null);
  await page.keyboard.press("Escape");

  await combobox.focus();
  await page.keyboard.press("ArrowDown");
  await page.mouse.click(8, 700);
  await page.waitForFunction(() => document.querySelector('[role="combobox"]')?.getAttribute("aria-expanded") === "false");
});
