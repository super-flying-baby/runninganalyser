import fs from 'fs';
import Papa from 'papaparse';
import { PostureAdjustment } from './src/services/PostureAdjustment.js';
import { VelocityIntegration } from './src/services/velocity.js';

const csvPath = '../csv_backup/flash/rec_3_21_23 (1).csv';
const csvText = fs.readFileSync(csvPath, 'utf8');
const parsed = Papa.parse(csvText, { skipEmptyLines: true, dynamicTyping: true });
const rows = parsed.data.slice(1).map(r => ({
  time: r[0],
  millis: r[1],
  accX: r[2],
  accY: r[3],
  accZ: r[4],
  gyroX: r[8],
  gyroY: r[9],
  gyroZ: r[10]
}));
const pa = new PostureAdjustment();
const converted = pa.convertRows(rows, { thresholdG: 0.03, stationarityWindowMs: 200, zeroVelocityThreshold: 0.15, zeroVelocityMaxReset: 0.25 });
const velocities = VelocityIntegration.computeVelocities(converted, { thresholdG: 0.03, stationarityWindowMs: 200, zeroVelocityThreshold: 0.15, maxVelocityReset: 0.25 });

function stats(field) {
  let count = 0;
  let sum = 0;
  let sumsq = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const row of converted) {
    const v = row[field];
    if (typeof v !== 'number' || Number.isNaN(v)) continue;
    count += 1;
    sum += v;
    sumsq += v * v;
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  return { field, count, mean: sum / count, std: Math.sqrt(sumsq / count - (sum / count) ** 2), min, max };
}

for (const f of ['aForward', 'aVertical', 'aSide']) {
  console.log(stats(f));
}
console.log('---- velocities ----');
for (const f of ['vForward', 'vVertical', 'vSide']) {
  console.log({ field: f, min: Math.min(...velocities.map(r => r[f])), max: Math.max(...velocities.map(r => r[f])), mean: velocities.reduce((acc, r) => acc + r[f], 0) / velocities.length });
}

console.log('first few converted rows:');
for (let i = 0; i < 15; i++) {
  const r = converted[i];
  console.log(i, r.millis, r.aForward.toFixed(4), r.aVertical.toFixed(4), r.aSide.toFixed(4));
}
console.log('first few velocities:');
for (let i = 0; i < 15; i++) {
  const r = velocities[i];
  console.log(i, r.millis, r.vForward.toFixed(4), r.vVertical.toFixed(4), r.vSide.toFixed(4));
}
console.log('last 20 velocities:');
const startIdx = Math.max(0, velocities.length - 20);
for (let i = startIdx; i < velocities.length; i++) {
  const r = velocities[i];
  console.log(i, r.millis, r.vForward.toFixed(4), r.vVertical.toFixed(4), r.vSide.toFixed(4));
}
