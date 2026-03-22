# RunMeter

RunMeter is a Vue 3 + Vuetify frontend for motion analysis with M5StickC Plus2.

## Features

- Connect to the device over USB with the Web Serial API
- Read CSV files recursively from the device storage
- Select a CSV file from the device
- Load CSV data into the web app
- Automatically download the selected CSV to the local machine after loading
- Display motion data in a paginated table

## Development

```bash
npm install
npm run dev
```

Open the app at:

```text
http://localhost:5173
```

## Workflow

1. Click `Sync`.
2. Select the M5StickC Plus2 USB serial device.
3. Choose a CSV file from the dialog.
4. The app loads the CSV into the table and immediately triggers a browser download.

## CSV Columns

1. Time
2. Milliseconds
3. Acceleration X
4. Acceleration Y
5. Acceleration Z
6. Gravity X
7. Gravity Y
8. Gravity Z
9. Angular Velocity X
10. Angular Velocity Y
11. Angular Velocity Z

## Browser Requirements

- Latest Chrome or Edge
- Web Serial API support
- User permission for USB device access

## Notes

- The current implementation assumes the device firmware supports MicroPython raw REPL file access.
- In a pure frontend app, local saving is handled by the browser download flow rather than direct arbitrary filesystem writes.

## CLI Fallback

The repository still includes the command-line downloader [download_m5_csv.py](download_m5_csv.py) as a fallback option.
