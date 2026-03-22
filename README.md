# RunMeter: A Wearable Sensor-Based Running Performance Analysis System

> **Disclaimer**: This project was primarily developed with AI assistance. Major development conversations and implementation details are comprehensively documented in the [ai_history/](./ai_history/) directory for reference and future development.

## Executive Summary

RunMeter is an integrated inertial measurement unit (IMU) data acquisition, processing, and analysis system utilizing the M5StickC Plus2 wearable platform. The system captures multi-axis accelerometric and angular velocity data from athletes during running, applying advanced coordinate transformation algorithms to convert device-frame sensor measurements into athlete-frame acceleration components. This enables quantitative biomechanical analysis of running kinematics through three orthogonal acceleration axes: fore-aft, vertical, and lateral.

## System Architecture

### 📱 Hardware Layer (`hardware/`)

**Device Platform**: M5StickC Plus2 (Compact Wearable Controller)

**Sensor Capabilities**:
- Integrated MPU6886 six-degree-of-freedom (6-DOF) IMU sensor
- Accelerometric data acquisition: ±8g maximum measurement range
- Angular velocity data acquisition: ±2000°/s measurement range
- USB serial interface for data persistence and transmission

**Component Descriptions**:
- `micropython.py` - Device firmware implementation (MicroPython runtime, UIFlow-compatible)
- `run_meter.m5f2` - M5Stack device configuration manifest
- Device programming interface: [UIFlow2](https://uiflow2.m5stack.com/) visual programming environment

### 💻 Frontend Application Layer (`front/`)

**Technology Stack**: Vue 3 + Vite Build System + Vuetify Material Design Framework

**Core Functional Modules**:
- ✅ **Device Synchronization** - Real-time data acquisition via USB Web Serial API protocol
- ✅ **Local Data Import** - Direct file-based CSV ingestion from local filesystem
- ✅ **Posture Adjustment Algorithm** - Advanced coordinate transformation and kinematic computation
- ✅ **Interactive Data Visualization** - Responsive tabular interface with pagination controls

**Principal Source Files**:
- `src/App.vue` - Primary application component (UI orchestration and state management)
- `src/services/PostureAdjustment.js` - **Core Algorithm Module**: Posture estimation and acceleration transformation
- `src/services/micropythonSerial.js` - USB serial communication service layer

### 🧮 Core Algorithm Implementation (`PostureAdjustment.js`)

**Input Data Specification**:
```
Timestamp (s) | Milliseconds | Acc-X | Acc-Y | Acc-Z | Gyro-X | Gyro-Y | Gyro-Z
(Units: acceleration in g; angular velocity in °/s)
```

**Output Acceleration Components** (Athlete-Referenced Coordinate System):
```
A-Forward  (Fore-aft acceleration in running direction)
A-Vertical (Vertical acceleration perpendicular to ground)
A-Side     (Lateral acceleration, negligible ≈ 0)
```

**Algorithm Characteristics** ✨:
1. **Low-Pass Filtering** - Gravity vector estimation from raw acceleration data via recursive filtering
2. **Automatic Scale Detection** - Runtime calibration to accommodate non-standard sensor unit conventions
3. **Coordinate Frame Transformation** - Dynamic establishment of athlete-centric kinematic reference frame
4. **Vector Projection** - Orthogonal decomposition of acceleration into three principal axes

## Operational Workflow

### Quick Start Guide

```bash
# Install dependencies
cd front
npm install

# Initiate development server
npm run dev
```

Navigate to `http://localhost:5173/` in web browser.

### Data Processing Pipeline

1. **Device Connectivity** - Click "Sync Device" to establish USB connection with M5StickC Plus2
   - **Alternative**: Click "Load" to select local CSV file from filesystem

2. **Data Loading** - Automatic retrieval of all CSV datasets from connected device
   - **Alternative**: Manual selection and import from local storage

3. **Algorithm Execution** - Click "Convert" to execute posture adjustment transformation
   - Automatic derivation of A-Forward, A-Vertical, A-Side acceleration components

4. **Result Analysis** - Examination of transformed kinematic data
   - Quantitative assessment of fore-aft, vertical, and lateral acceleration profiles

## Data Flow Architecture

```
M5StickC Plus2 Wearable Sensor
       ↓ (USB Serial Interface)
Raw IMU Data (accX, accY, accZ, gyroX, gyroY, gyroZ in CSV format)
       ↓
Web-Based Frontend Application
       ↓
PostureAdjustment Signal Processing Algorithm
       ↓
Transformed Acceleration Metrics (A-forward, A-vertical, A-side)
       ↓
Interactive Tabular Visualization
```

## Project Directory Structure

```
runmeter/
├── front/                          # Frontend Web Application Module
│   ├── src/
│   │   ├── App.vue                # Primary application component
│   │   ├── main.js                # Application entry point
│   │   ├── styles.css             # Global stylesheet
│   │   └── services/
│   │       ├── PostureAdjustment.js   # ✨ Core algorithm implementation
│   │       └── micropythonSerial.js  # USB communication service
│   ├── package.json
│   └── vite.config.js
│
├── hardware/                       # Embedded Systems & Firmware Layer
│   ├── micropython.py             # Device firmware source code
│   ├── run_meter.m5f2             # Device configuration file
│   └── README.md                  # Hardware documentation
│
├── download_m5_csv.py             # Data extraction utility (Python script)
├── csv_backup/                    # Data archival directory
│
├── ai_history/                    # 📋 Development Conversation Archive
│   ├── 20260322.md               # Session development record
│   └── ...
│
└── README.md                      # This documentation file
```

## Technology Stack

### Hardware & Embedded Systems
- **Device Platform**: M5StickC Plus2
- **Sensor Hardware**: MPU6886 (6-axis inertial measurement unit)
- **Firmware Runtime**: MicroPython (UIFlow 2 compatible)

### Web Application Frontend
- **JavaScript Framework**: Vue 3.x
- **Build Infrastructure**: Vite
- **Component Library**: Vuetify Material Design System
- **Data Processing**: PapaParse CSV parser
- **Hardware Communication**: Web Serial API (browser standard)

### Signal Processing & Mathematics
- **Numerical Computation**: JavaScript vector and matrix operations
- **Temporal Filtering**: Recursive low-pass filtering
- **Coordinate Geometry**: Three-dimensional affine transformations

## Functional Features

✨ **Automatic Sensor Calibration** - Runtime detection and compensation of data unit scaling
🔄 **Real-Time Device Synchronization** - Direct USB wearable data acquisition
📁 **Flexible Data Sources** - Dual-mode input (device-connected or local file import)
🔧 **Robust Signal Conditioning** - Low-pass filtering for stable orientation estimation
📊 **Data Visualization Interface** - Paginated tabular display with interactive controls

## AI-Assisted Development Methodology

**Percentage of Code Developed with AI Assistance: ~95%**

The following modules were substantially implemented through AI-driven development:

1. ✅ **PostureAdjustment.js** - Complete algorithm implementation (vector mathematics, coordinate transformation, filtering)
2. ✅ **App.vue** - Primary frontend component architecture and user interface design
3. ✅ **UI/UX Integration** - Vuetify component integration and responsive design

**Development History Documentation**:

All major development sessions and algorithmic decisions are comprehensively recorded in the `ai_history/` directory following the `yyyymmdd.md` naming convention:
- 📖 **Development Process Audit** - Complete record of iterative algorithm refinement
- 🔍 **Implementation Rationale** - Detailed technical justification for design decisions
- 🚀 **Continuing Development Reference** - Foundation for future feature enhancements and optimizations

## Future Research Directions & Enhancements

- [ ] Real-time acceleration visualization (chart-based rendering)
- [ ] Multi-format data export (CSV, JSON, HDF5 compatibility)
- [ ] Batch file processing for multiple trial datasets
- [ ] Advanced filtering algorithms (Kalman filtering, complementary filters)
- [ ] Responsive mobile interface optimization
- [ ] Comparative kinematic analysis and statistical reporting
- [ ] Pedal force estimation from accelerometric signals
- [ ] Ground contact detection algorithm

## License

MIT License

## Correspondence & Support

For technical inquiries, implementation details, or development suggestions, please consult the development conversation archive in the `ai_history/` directory, or submit detailed specifications for new feature implementation requests.
