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
    
    // Initialize filtered acceleration from current measurement
    this.filteredAccel = accel.clone();
    
    // Normalize acceleration vector and obtain vertical (up) reference direction
    // Acceleration vector points downward (includes gravitational component),
    // so upDir points in opposite direction (upward)
    const accelNorm = accel.normalize();
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
  }

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
  convertAcceleration(sensorData, options = {}) {
    // Initialize reference frame on first invocation
    if (!this.forwardReference) {
      this.initializeOrientation(sensorData);
    }

    // Retrieve acceleration vector
    const accel = new Vector3(sensorData.accX, sensorData.accY, sensorData.accZ);
    
    // Update gravity estimate using low-pass filtering
    this.updateGravityEstimate(accel);
    
    // Utilize filtered acceleration as gravitational reference
    const filteredAccelNorm = this.filteredAccel.normalize();
    const upDir = filteredAccelNorm.scale(-1);
    
    // Obtain reference forward and right-hand direction vectors
    // Note: This implementation assumes the forward reference direction
    // remains relatively fixed throughout the dataset. For rotational
    // tracking, integrate angular velocity to update these vectors dynamically
    const forwardDir = this.forwardReference.clone();
    const rightDir = upDir.cross(forwardDir).normalize();
    
    // Adjust forward direction to ensure orthogonality
    const adjustedForwardDir = rightDir.cross(upDir).normalize();
    
    // Project acceleration onto three reference axes
    let aForward = accel.dot(adjustedForwardDir);
    let aVertical = accel.dot(upDir);
    let aSide = accel.dot(rightDir);

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
      // Convert string values to numeric
      const sensorData = {
        accX: parseFloat(row.accX) || 0,
        accY: parseFloat(row.accY) || 0,
        accZ: parseFloat(row.accZ) || 0,
        gyroX: parseFloat(row.gyroX) || 0,
        gyroY: parseFloat(row.gyroY) || 0,
        gyroZ: parseFloat(row.gyroZ) || 0
      };

      // Apply acceleration transformation
      const converted = this.convertAcceleration(sensorData, options);

      // Construct new row with transformed kinematic data
      const newRow = {
        ...row,
        aForward: converted.aForward,
        aVertical: converted.aVertical,
        aSide: converted.aSide
      };

      convertedRows.push(newRow);
    }

    return convertedRows;
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
