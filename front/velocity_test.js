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
console.log('first 20 rows');
for (let i = 0; i < 20; i++) {
  const r = velocities[i];
  console.log(i, r.time, r.millis, r.aForward.toFixed(4), r.aVertical.toFixed(4), r.aSide.toFixed(4), r.vForward.toFixed(4), r.vVertical.toFixed(4), r.vSide.toFixed(4));
}
console.log('summary');
const maxv = velocities.reduce((acc, row) => ({
  vForward: Math.max(acc.vForward, Math.abs(row.vForward)),
  vVertical: Math.max(acc.vVertical, Math.abs(row.vVertical)),
  vSide: Math.max(acc.vSide, Math.abs(row.vSide))
}), { vForward: 0, vVertical: 0, vSide: 0 });
console.log(maxv);
