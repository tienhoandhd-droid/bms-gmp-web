import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHourlyPoints, hourlyMean, chooseSensor, missingSnapshot } from '../src/lib/overviewSnapshot.js';

test('hourly chart preserves unknown values and zero without inventing measurements', () => {
  const points=normalizeHourlyPoints([{label:'08:00',avg:null},{label:'09:00',avg:'0',vmin:'-1',vmax:'2'},{label:'10:00',avg:'bad'},{label:'11:00',avg:5}]);
  assert.deepEqual(points.map(p=>p.avg),[null,0,null,5]);
  assert.equal(points[1].vmin,-1); assert.equal(points[1].vmax,2);
});
test('default sensor prioritizes highest hourly OOS among available history', () => {
  assert.equal(chooseSensor([{k:'DP',stats:{oos1h:2,hourly8:[{avg:2}]}},{k:'RH',stats:{oos1h:40,hourly8:[{avg:80}]}},{k:'T',stats:{oos1h:50,hourly8:[]}}]),'RH');
  assert.equal(chooseSensor([]),null);
});
test('snapshot copy distinguishes interrupted source, overdue period and missing sensor', () => {
  const r={duLieuCu:true,window:'08:00–09:00',lastSeen:'09/09 09:00',agePhut:40};
  assert.match(missingSnapshot(r).label,/kỳ mới/);
  assert.match(missingSnapshot(r).detail,/08:00–09:00/);
  assert.match(missingSnapshot({...r,agePhut:180}).label,/quá cũ/);
  assert.match(missingSnapshot(r,{sourceInterrupted:true}).label,/gián đoạn/);
  assert.match(missingSnapshot({noData:true}).label,/Chưa có số liệu/);
  assert.equal(missingSnapshot({noData:false,duLieuCu:false}),null);
});

test("mean excludes missing hours instead of counting them as zero", () => {
  assert.equal(hourlyMean([{avg:20},{avg:null},{avg:24}]),22);
  assert.equal(hourlyMean([{avg:null}]),null);
});
