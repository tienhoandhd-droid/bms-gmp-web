import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));

test("room detail keeps missing measurements as gaps and formats object-backed tooltip values", async (t) => {
  const server = await createServer({ root: WEB_ROOT, logLevel: "error", appType: "custom" });
  t.after(async () => { await server.close(); });
  const { RoomDetailMiniChart } = await server.ssrLoadModule("/src/components/charts.jsx");

  const chart = RoomDetailMiniChart({
    pts: [
      { label: "08:00", avg: 22.4, vmin: 22.1, vmax: 22.8 },
      { label: "09:00", avg: null, vmin: null, vmax: null },
      { label: "10:00", avg: 22.7, vmin: 22.3, vmax: 23.0 },
      { label: "11:00", avg: 25.2, vmin: 24.9, vmax: 25.4 },
    ],
    smin: 20,
    smax: 25,
    mean: 22.55,
    unit: "°C",
  });
  const option = chart.props.option;
  const average = option.series.find((series) => series.name === "TB giờ");

  assert.equal(average.smooth, false, "hourly measurements must use straight segments");
  assert.equal(average.connectNulls, false, "missing measurements must remain visible gaps");
  assert.equal(average.data[1].value, null);
  assert.equal(average.data[1].itemStyle?.color, undefined, "missing measurements cannot receive an out-of-limit color");
  assert.equal(average.data[3].symbol, "diamond", "out-of-limit measurements need a shape as well as warning color");

  const tooltip = option.tooltip.formatter([{
    seriesName: "TB giờ",
    data: average.data[0],
    dataIndex: 0,
    axisValue: "08:00",
  }]);
  assert.match(tooltip, /22\.40 °C/);
  assert.doesNotMatch(tooltip, /NaN/);
});

test('trend series use active theme colors instead of fixed dark strokes', async t => {
  const server=await createServer({root:WEB_ROOT,logLevel:'error',appType:'custom'});t.after(()=>server.close());
  const {ChartComplyTotal}=await server.ssrLoadModule('/src/components/charts.jsx');
  const saved={window:globalThis.window,document:globalThis.document,getComputedStyle:globalThis.getComputedStyle};
  try {
    globalThis.window={};globalThis.document={documentElement:{}};
    globalThis.getComputedStyle=()=>({getPropertyValue:name=>({'--primary':'#58C8BC','--danger':'#F08078'}[name]||'')});
    const element=ChartComplyTotal({data:[{label:'08:00',comp:70},{label:'09:00',comp:90}]});
    const option=element.props.children.props.option;
    assert.equal(option.series.find(s=>s.name==='Kỳ này').lineStyle.color,'#58C8BC');
  } finally {for(const [key,value] of Object.entries(saved)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
