/**
 * Posture Adjustment and Acceleration Transformation Service
 * 
 * Source Device: M5StickC Plus2 (IMU: MPU6886)
 * Input Data Units:
 *   - Acceleration (accX, accY, accZ): g (gravitational acceleration units)
 *   - Angular Velocity (gyroX, gyroY, gyroZ): deg/s (degrees per second)
 * 
 * Algorithm Principles:
 *   1. Estimate gravity vector from raw acceleration using low-pass filtering
 *   2. Establish "vertical" reference direction based on gravity vector
 *   3. Use initial motion direction as "forward" reference direction
 *   4. Project acceleration onto three orthogonal axes for coordinate transformation
 * 
 * Output Data Units:
 *   - aForward, aVertical, aSide: Same units as input acceleration (g units)
 */

/**
 * Three-Dimensional Vector Class
 */
class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(v) {
    return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  subtract(v) {
    return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v) {
    return new Vector3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize() {
    const mag = this.magnitude();
    if (mag === 0) {
      return new Vector3(0, 0, 0);
    }
    return new Vector3(this.x / mag, this.y / mag, this.z / mag);
  }

  scale(s) {
    return new Vector3(this.x * s, this.y * s, this.z * s);
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }
}

/**
 * Core class for posture adjustment algorithm
 * Responsible for converting acceleration from device coordinate frame
 * to athlete-centered running coordinate frame using only acceleration
 * and angular velocity data (without explicit gravity vector)
 */
export class PostureAdjustment {
  constructor() {
    // Low-pass filter coefficient for gravity estimation
    // Smaller α incorporates more historical data (smoother), 
    // larger α emphasizes current measurements
    this.GRAVITY_FILTER_ALPHA = 0.02;
    
    // Filtered acceleration vector (utilized for gravity estimation)
    this.filteredAccel = null;
    
    // Reference direction for forward motion (initialized as undefined)
    this.forwardReference = null;
    
    // Auto-detected gravitational acceleration scale factor
    this.gravityScaleFactor = null;
    
    // Expected magnitude of gravitational acceleration (standard units)
    this.EXPECTED_GRAVITY_MAG = 1.0;

    // Threshold settings for jitter filtering and stationary reset
    this.ACCEL_THRESHOLD_G = 0.03;
    this.STATIONARY_WINDOW_MS = 200;
    this.ZERO_VELOCITY_RESET_THRESHOLD = 0.04;
    this.ZERO_VELOCITY_MAX_RESET = 0.25;
  }

  /**
   * Initialize reference coordinate frame and filtered acceleration
   * Establishes kinematic reference system using initial acceleration measurements
   * 
   * @param {Object} sensorData - Sensor data object {accX, accY, accZ, gyroX, gyroY, gyroZ}
   */
  initializeOrientation(sensorData) {
    // Construct acceleration vector
    const accel = new Vector3(sensorData.accX, sensorData.accY, sensorData.accZ);
    
    // Compute acceleration vector magnitude
    const accelMag = accel.magnitude();
    
    // Auto-detect scale factor
    if (!this.gravityScaleFactor && accelMag > 0) {
      // At rest, acceleration magnitude should equal gravity (1g)
      // If measured as 51.2, scale factor = 1.0 / 51.2 ≈ 0.0195
      this.gravityScaleFactor = this.EXPECTED_GRAVITY_MAG / accelMag;
      console.log(
        `[PostureAdjustment] Detected acceleration scale factor: ${this.gravityScaleFactor.toFixed(4)} ` +
        `(measured acceleration magnitude: ${accelMag.toFixed(2)}, expected: ${this.EXPECTED_GRAVITY_MAG})`
      );
    }
    
    // Normalize raw acceleration units to g if needed, and initialize filtered acceleration
    const scaledAccel = accel.scale(this.gravityScaleFactor || 1);
    this.filteredAccel = scaledAccel.clone();

    // Normalize acceleration vector and obtain vertical (up) reference direction
    // Acceleration vector points downward (includes gravitational component),
    // so upDir points in opposite direction (upward)
    const accelNorm = scaledAccel.normalize();
    const upDir = accelNorm.scale(-1);
    
    // Assume initial forward direction along global X-axis
    // In practical applications, this can be adjusted based on device
    // orientation or other reference frames
    let forwardDir = new Vector3(1, 0, 0);
    
    // Verify forwardDir is not parallel to upDir; adjust if necessary
    const crossProd = upDir.cross(forwardDir);
    if (crossProd.magnitude() < 0.1) {
      forwardDir = new Vector3(0, 1, 0);
    }
    
    // Compute right-hand vector
    const rightDir = upDir.cross(forwardDir).normalize();
    
    // Recalculate forward vector to ensure orthogonality
    forwardDir = rightDir.cross(upDir).normalize();
    
    this.forwardReference = forwardDir.clone();
  }

  /**
   * Update filtered acceleration estimate using low-pass filter
   * Filter serves as gravity reference by attenuating dynamic accelerations
   * 
   * @param {Vector3} accel - Current acceleration vector
   */
  updateGravityEstimate(accel) {
    // Low-pass filtering implementation:
    // filtered = α * current + (1-α) * previous
    // When α is small, filtering effectiveness is significant but response delay increases
    this.filteredAccel = this.filteredAccel.scale(1 - this.GRAVITY_FILTER_ALPHA)
      .add(accel.scale(this.GRAVITY_FILTER_ALPHA));
  }

  /**
   * Core algorithm: Convert sensor data to acceleration in running coordinate frame
   * 
   * Algorithm workflow:
   * 1. Utilize low-pass filtered acceleration as gravitational reference
   * 2. Estimate vertical direction (gravitation direction) from acceleration
   * 3. Project acceleration onto three reference orthogonal axes
   * 
   * @param {Object} sensorData - Sensor data object {accX, accY, accZ, gyroX, gyroY, gyroZ}
   * @param {Object} options - Conversion options {convertToMS2: false}
   * @returns {Object} Object containing aForward, aVertical, aSide acceleration components
   */
  getGravityVector(sensorData) {
    if (
      Number.isFinite(sensorData.gravityX) &&
      Number.isFinite(sensorData.gravityY) &&
      Number.isFinite(sensorData.gravityZ)
    ) {
      const gravity = new Vector3(sensorData.gravityX, sensorData.gravityY, sensorData.gravityZ);
      const mag = gravity.magnitude();
      if (mag > 0.8) {
        return gravity.scale(this.EXPECTED_GRAVITY_MAG / mag);
      }
    }
    return null;
  }

  convertAcceleration(sensorData, options = {}) {
    // Initialize reference frame on first invocation
    if (!this.forwardReference) {
      this.initializeOrientation(sensorData);
    }

    const rawAccel = new Vector3(sensorData.accX, sensorData.accY, sensorData.accZ);
    const gravityVector = this.getGravityVector(sensorData);
    let dynamicAccel;
    let upDir;

    if (gravityVector) {
      dynamicAccel = rawAccel.subtract(gravityVector);
      upDir = gravityVector.normalize().scale(-1);
    } else {
      // Fall back to filtered gravity estimation when explicit gravity data is unavailable.
      const accel = rawAccel.scale(this.gravityScaleFactor || 1);
      this.updateGravityEstimate(accel);
      const filteredAccelNorm = this.filteredAccel.normalize();
      upDir = filteredAccelNorm.scale(-1);
      dynamicAccel = accel;
    }

    const forwardDir = this.forwardReference.clone();
    const rightDir = upDir.cross(forwardDir).normalize();
    const adjustedForwardDir = rightDir.cross(upDir).normalize();

    let aForward = dynamicAccel.dot(adjustedForwardDir);
    let aVertical = dynamicAccel.dot(upDir);
    let aSide = dynamicAccel.dot(rightDir);

    if (!gravityVector) {
      aVertical += this.EXPECTED_GRAVITY_MAG;
    }

    const thresholdG = options.thresholdG ?? this.ACCEL_THRESHOLD_G;
    if (Math.abs(aForward) < thresholdG) aForward = 0;
    if (Math.abs(aVertical) < thresholdG) aVertical = 0;
    if (Math.abs(aSide) < thresholdG) aSide = 0;

    return {
      aForward: parseFloat(aForward.toFixed(4)),
      aVertical: parseFloat(aVertical.toFixed(4)),
      aSide: parseFloat(aSide.toFixed(4))
    };
  }

  /**
   * Batch convert multiple rows of sensor data
   * 
   * @param {Array} rows - Array of sensor data rows
   * @param {Object} options - Conversion options
   * @returns {Array} Transformed row array with added aForward, aVertical, aSide fields
   */
  convertRows(rows, options = {}) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return rows;
    }

    // Reset state (reinitialize for new dataset)
    this.forwardReference = null;
    this.filteredAccel = null;
    this.gravityScaleFactor = null;

    const convertedRows = [];
    for (const row of rows) {
      const sensorData = {
        accX: parseFloat(row.accX) || 0,
        accY: parseFloat(row.accY) || 0,
        accZ: parseFloat(row.accZ) || 0,
        gravityX: parseFloat(row.gravityX) || 0,
        gravityY: parseFloat(row.gravityY) || 0,
        gravityZ: parseFloat(row.gravityZ) || 0,
        gyroX: parseFloat(row.gyroX) || 0,
        gyroY: parseFloat(row.gyroY) || 0,
        gyroZ: parseFloat(row.gyroZ) || 0
      };

      const converted = this.convertAcceleration(sensorData, options);
      const newRow = {
        ...row,
        aForward: converted.aForward,
        aVertical: converted.aVertical,
        aSide: converted.aSide
      };
      convertedRows.push(newRow);
    }

    const biasCorrectedRows = this.removeStationaryBias(convertedRows, options);
    return this.applyStationaryZeroUpdate(biasCorrectedRows, options);
  }

  /**
   * Determine whether a converted row is effectively stationary.
   * This uses threshold filtering on the transformed forward/vertical/side axes.
   * @param {Object} row
   * @param {number} thresholdG
   * @returns {boolean}
   */
  isRowStationary(row, thresholdG) {
    return (
      Math.abs(row.aForward) < thresholdG &&
      Math.abs(row.aVertical) < thresholdG &&
      Math.abs(row.aSide) < thresholdG
    );
  }

  /**
   * Build a stationarity mask across the converted dataset.
   * A row is marked stationary only if its surrounding window is also quiet.
   * This helps avoid false positives from isolated low-amplitude motion.
   * @param {Array} rows
   * @param {number} thresholdG
   * @param {number} windowMs
   * @returns {boolean[]}
   */
  buildStationaryMask(rows, thresholdG, windowMs) {
    const timestamps = rows.map((row) => {
      const ms = parseFloat(row.millis);
      return Number.isFinite(ms) ? ms : 0;
    });

    return rows.map((row, idx) => {
      if (!this.isRowStationary(row, thresholdG)) {
        return false;
      }

      const time = timestamps[idx];
      const halfWindow = windowMs / 2;
      let start = idx;
      let end = idx;

      while (start > 0 && time - timestamps[start - 1] <= halfWindow) {
        start -= 1;
      }
      while (end < rows.length - 1 && timestamps[end + 1] - time <= halfWindow) {
        end += 1;
      }

      for (let j = start; j <= end; j += 1) {
        if (!this.isRowStationary(rows[j], thresholdG)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Apply zero-velocity update to acceleration results.
   * For segments classified as stationary, force low-level acceleration values to 0.
   * This improves subsequent velocity integration and reduces drift from jitter.
   * @param {Array} rows
   * @param {Object} options
   * @returns {Array}
   */
  removeStationaryBias(rows, options = {}) {
    let count = 0;
    let sumForward = 0;
    let sumVertical = 0;
    let sumSide = 0;

    rows.forEach((row) => {
      count += 1;
      sumForward += row.aForward;
      sumVertical += row.aVertical;
      sumSide += row.aSide;
    });

    if (count === 0) {
      console.log('[PostureAdjustment] No data to compute bias from');
      return rows;
    }

    const biasForward = sumForward / count;
    const biasVertical = sumVertical / count;
    const biasSide = sumSide / count;

    console.log(
      `[PostureAdjustment] Bias correction (global mean) - Forward: ${biasForward.toFixed(4)}, Vertical: ${biasVertical.toFixed(4)}, Side: ${biasSide.toFixed(4)}`
    );

    return rows.map((row) => ({
      ...row,
      aForward: parseFloat((row.aForward - biasForward).toFixed(4)),
      aVertical: parseFloat((row.aVertical - biasVertical).toFixed(4)),
      aSide: parseFloat((row.aSide - biasSide).toFixed(4))
    }));
  }

  applyStationaryZeroUpdate(rows, options = {}) {
    const thresholdG = options.thresholdG ?? this.ACCEL_THRESHOLD_G;
    const windowMs = options.stationarityWindowMs ?? this.STATIONARY_WINDOW_MS;
    const maxReset = options.zeroVelocityMaxReset ?? this.ZERO_VELOCITY_MAX_RESET;
    const zeroVelocityThreshold = options.zeroVelocityThreshold ?? this.ZERO_VELOCITY_RESET_THRESHOLD;

    const stationaryMask = this.buildStationaryMask(rows, thresholdG, windowMs);

    return rows.map((row, index) => {
      if (!stationaryMask[index]) {
        return row;
      }

      const zeroed = {
        ...row,
        aForward: Math.abs(row.aForward) <= maxReset && Math.abs(row.aForward) < zeroVelocityThreshold ? 0 : row.aForward,
        aVertical: Math.abs(row.aVertical) <= maxReset && Math.abs(row.aVertical) < zeroVelocityThreshold ? 0 : row.aVertical,
        aSide: Math.abs(row.aSide) <= maxReset && Math.abs(row.aSide) < zeroVelocityThreshold ? 0 : row.aSide
      };

      return zeroed;
    });
  }

  /**
   * Retrieve auto-detected gravity acceleration scale factor
   * Utility method for diagnostic and unit-of-measurement verification
   * @returns {number|null} Scale factor, or null if not yet detected
   */
  getGravityScaleFactor() {
    return this.gravityScaleFactor;
  }
}

// Export singleton instance
export const postureAdjustment = new PostureAdjustment();
