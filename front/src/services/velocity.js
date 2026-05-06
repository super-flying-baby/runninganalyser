const STANDARD_GRAVITY = 9.80665;

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMillis(row) {
  return toNumber(row.millis);
}

function isStationary(row, thresholdG) {
  return (
    Math.abs(toNumber(row.aForward)) < thresholdG &&
    Math.abs(toNumber(row.aVertical)) < thresholdG &&
    Math.abs(toNumber(row.aSide)) < thresholdG
  );
}

function buildStationaryFlags(rows, thresholdG, stationarityWindowMs) {
  const millis = rows.map(getMillis);
  const flags = new Array(rows.length).fill(false);

  for (let i = 0; i < rows.length; i += 1) {
    const centerTime = millis[i];
    if (!Number.isFinite(centerTime)) {
      continue;
    }

    let start = i;
    let end = i;
    while (start > 0 && centerTime - millis[start - 1] <= stationarityWindowMs / 2) {
      start -= 1;
    }
    while (
      end < rows.length - 1 &&
      millis[end + 1] - centerTime <= stationarityWindowMs / 2
    ) {
      end += 1;
    }

    let segmentStationary = true;
    for (let j = start; j <= end; j += 1) {
      if (!isStationary(rows[j], thresholdG)) {
        segmentStationary = false;
        break;
      }
    }

    flags[i] = segmentStationary;
  }

  return flags;
}

function computeVelocities(rows, options = {}) {
  const {
    thresholdG = 0.03,
    zeroVelocityThreshold = 0.15,
    stationarityWindowMs = 200,
    maxVelocityReset = 0.25
  } = options;

  if (!Array.isArray(rows) || rows.length === 0) {
    return rows;
  }

  const stationaryFlags = buildStationaryFlags(rows, thresholdG, stationarityWindowMs);

  let lastForward = 0;
  let lastVertical = 0;
  let lastSide = 0;
  let lastMillis = getMillis(rows[0]);
  if (!Number.isFinite(lastMillis)) {
    lastMillis = 0;
  }

  return rows.map((row, index) => {
    const currentMillis = getMillis(row);
    const dtSeconds =
      index === 0 || !Number.isFinite(currentMillis) || !Number.isFinite(lastMillis)
        ? 0.02
        : Math.max((currentMillis - lastMillis) / 1000, 0.001);
    lastMillis = Number.isFinite(currentMillis) ? currentMillis : lastMillis;

    const aForward = toNumber(row.aForward);
    const aVertical = toNumber(row.aVertical);
    const aSide = toNumber(row.aSide);

    const filteredAForward = Math.abs(aForward) < thresholdG ? 0 : aForward;
    const filteredAVertical = Math.abs(aVertical) < thresholdG ? 0 : aVertical;
    const filteredASide = Math.abs(aSide) < thresholdG ? 0 : aSide;

    const vForward = lastForward + filteredAForward * STANDARD_GRAVITY * dtSeconds;
    const vVertical = lastVertical + filteredAVertical * STANDARD_GRAVITY * dtSeconds;
    const vSide = lastSide + filteredASide * STANDARD_GRAVITY * dtSeconds;

    const shouldZero = stationaryFlags[index];

    let nextForward =
      shouldZero && Math.abs(vForward) <= maxVelocityReset && Math.abs(vForward) < zeroVelocityThreshold
        ? 0
        : vForward;
    let nextVertical =
      shouldZero && Math.abs(vVertical) <= maxVelocityReset && Math.abs(vVertical) < zeroVelocityThreshold
        ? 0
        : vVertical;
    let nextSide =
      shouldZero && Math.abs(vSide) <= maxVelocityReset && Math.abs(vSide) < zeroVelocityThreshold
        ? 0
        : vSide;

    if (Math.abs(nextForward) > 10) nextForward *= 0.99;
    if (Math.abs(nextVertical) > 10) nextVertical *= 0.99;
    if (Math.abs(nextSide) > 10) nextSide *= 0.99;

    lastForward = nextForward;
    lastVertical = nextVertical;
    lastSide = nextSide;

    return {
      ...row,
      vForward: Number(nextForward.toFixed(4)),
      vVertical: Number(nextVertical.toFixed(4)),
      vSide: Number(nextSide.toFixed(4))
    };
  });
}

export const VelocityIntegration = {
  computeVelocities
};
