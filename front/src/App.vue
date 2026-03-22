<template>
  <v-app>
    <v-main class="rm-shell">
      <v-container class="rm-page py-8">
        <v-row class="fade-up" align="center" justify="space-between">
          <v-col cols="12" md="8">
            <h1 class="rm-title text-h3 font-weight-bold mb-2">RUNMETER ANALYZER</h1>
            <p class="text-body-1 mb-0">
              Connect to M5StickC Plus2 over USB, read CSV files from the device,
              and review motion data directly in the browser.
            </p>
          </v-col>
          <v-col cols="12" md="4" class="text-md-right">
            <v-chip :color="connected ? 'success' : 'error'" class="font-weight-bold">
              {{ connected ? "Device Connected" : "Device Disconnected" }}
            </v-chip>
          </v-col>
        </v-row>

        <v-card class="mt-6 pa-4 fade-up" rounded="xl" elevation="4">
          <v-row dense>
            <v-col cols="12" md="3">
              <v-btn
                block
                size="large"
                color="primary"
                @click="onSync"
                :loading="syncing"
                :disabled="downloading || converting"
              >
                {{ connected ? "Sync Device" : "Sync" }}
              </v-btn>
            </v-col>
            <v-col cols="12" md="2">
              <v-btn
                block
                size="large"
                color="info"
                @click="triggerFileInput"
                :loading="uploading"
                :disabled="uploading || converting"
              >
                Load
              </v-btn>
              <input
                ref="fileInput"
                type="file"
                accept=".csv"
                style="display: none"
                @change="onLocalFileSelected"
              />
            </v-col>
            <v-col cols="12" md="2">
              <v-btn
                block
                size="large"
                color="accent"
                @click="onConvert"
                :loading="converting"
                :disabled="rows.length === 0 || downloading || uploading"
              >
                Convert
              </v-btn>
            </v-col>
            <v-col cols="12" md="5" class="d-flex align-center">
              <span class="text-body-2">{{ statusText }}</span>
            </v-col>
          </v-row>
        </v-card>

        <v-card class="mt-6 pa-4 fade-up" rounded="xl" elevation="2">
          <div class="d-flex justify-space-between align-center mb-3">
            <h2 class="text-h6 mb-0">CSV Data</h2>
            <v-select
              v-model="itemsPerPage"
              :items="[10, 20, 50, 100]"
              density="compact"
              label="Rows per page"
              style="max-width: 130px"
              hide-details
            />
          </div>

          <v-table density="comfortable" fixed-header height="520">
            <thead>
              <tr>
                <th>Time</th>
                <th>Milliseconds</th>
                <th>A-Forward</th>
                <th>A-Vertical</th>
                <th>A-Side</th>
                <th>Acc-X</th>
                <th>Acc-Y</th>
                <th>Acc-Z</th>
                <th>Gyro-X</th>
                <th>Gyro-Y</th>
                <th>Gyro-Z</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in pagedRows" :key="`${currentPage}-${i}`">
                <td>{{ row.time }}</td>
                <td>{{ row.millis }}</td>
                <td>{{ row.aForward ?? "-" }}</td>
                <td>{{ row.aVertical ?? "-" }}</td>
                <td>{{ row.aSide ?? "-" }}</td>
                <td>{{ row.accX }}</td>
                <td>{{ row.accY }}</td>
                <td>{{ row.accZ }}</td>
                <td>{{ row.gyroX }}</td>
                <td>{{ row.gyroY }}</td>
                <td>{{ row.gyroZ }}</td>
              </tr>
              <tr v-if="pagedRows.length === 0">
                <td colspan="11" class="text-center text-medium-emphasis py-6">
                  No data loaded yet. Click Sync to connect and load a CSV file.
                </td>
              </tr>
            </tbody>
          </v-table>

          <div class="d-flex justify-end pt-4">
            <v-pagination v-model="currentPage" :length="pageCount" :total-visible="7" />
          </div>
        </v-card>
      </v-container>

      <v-dialog v-model="fileDialog" max-width="720">
        <v-card rounded="xl">
          <v-card-title class="text-h6">Select a CSV File from the Device</v-card-title>
          <v-card-text>
            <v-list lines="one" max-height="360" class="overflow-y-auto">
              <v-list-item
                v-for="file in files"
                :key="file"
                :active="selectedFile === file"
                @click="selectedFile = file"
                rounded="lg"
              >
                <v-list-item-title>{{ file }}</v-list-item-title>
              </v-list-item>
            </v-list>
            <div v-if="files.length === 0" class="text-medium-emphasis py-3">
              No CSV files were found on the device.
            </div>
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="fileDialog = false">Cancel</v-btn>
            <v-btn
              color="primary"
              @click="downloadSelectedFile"
              :disabled="!selectedFile"
              :loading="downloading"
            >
              Load and Save
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3200">
        {{ snackbar.text }}
      </v-snackbar>
    </v-main>
  </v-app>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import Papa from "papaparse";
import { MicroPythonSerial } from "./services/micropythonSerial";
import { PostureAdjustment } from "./services/PostureAdjustment";

const serial = new MicroPythonSerial();
const postureAdjustment = new PostureAdjustment();

const connected = ref(false);
const syncing = ref(false);
const downloading = ref(false);
const converting = ref(false);
const uploading = ref(false);
const fileDialog = ref(false);
const files = ref([]);
const selectedFile = ref("");
const rows = ref([]);
const statusText = ref("Waiting to connect to the device");

const itemsPerPage = ref(20);
const currentPage = ref(1);
const fileInput = ref(null);

const snackbar = ref({ show: false, text: "", color: "primary" });

const csvHeaderLine = [
  "Time",
  "Milliseconds",
  "Acceleration X",
  "Acceleration Y",
  "Acceleration Z",
  "Angular Velocity X",
  "Angular Velocity Y",
  "Angular Velocity Z"
].join(",");

function toast(text, color = "primary") {
  snackbar.value = { show: true, text, color };
}

const pageCount = computed(() => {
  if (rows.value.length === 0) {
    return 1;
  }
  return Math.ceil(rows.value.length / itemsPerPage.value);
});

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return rows.value.slice(start, end);
});

watch([itemsPerPage, rows], () => {
  currentPage.value = 1;
});

function triggerBrowserDownload(path, content) {
  const filename = path.split("/").pop() || "data.csv";
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function hasCsvHeader(csvText) {
  const firstLine = csvText.split(/\r?\n/, 1)[0]?.trim().toLowerCase() || "";
  return firstLine.includes("time") || firstLine.includes("timestamp");
}

function ensureCsvHeader(csvText) {
  const normalized = csvText.replace(/^\uFEFF/, "");
  if (hasCsvHeader(normalized)) {
    return normalized;
  }
  return `${csvHeaderLine}\n${normalized}`;
}

async function onSync() {
  syncing.value = true;
  try {
    if (!connected.value) {
      statusText.value = "Requesting USB device...";
      await serial.connect();
      connected.value = true;
      toast("Device connected", "success");
    }

    statusText.value = "Reading CSV files from the device...";
    const csvFiles = await serial.listCsvFiles("/");
    files.value = csvFiles;
    selectedFile.value = csvFiles[0] || "";

    if (csvFiles.length === 0) {
      fileDialog.value = false;
      statusText.value = "No CSV files found on the device";
      toast(statusText.value, "error");
      return;
    }

    if (csvFiles.length === 1) {
      statusText.value = "1 CSV file found. Loading automatically...";
      await downloadSelectedFile();
      return;
    }

    fileDialog.value = true;
    statusText.value = `Found ${csvFiles.length} CSV file(s)`;
  } catch (err) {
    statusText.value = err.message || "Sync failed";
    toast(statusText.value, "error");
  } finally {
    syncing.value = false;
  }
}

function mapRow(record) {
  const safe = (idx) => record[idx] ?? "";
  return {
    time: safe(0),
    millis: safe(1),
    accX: safe(2),
    accY: safe(3),
    accZ: safe(4),
    gyroX: safe(5),
    gyroY: safe(6),
    gyroZ: safe(7)
  };
}

function parseCsv(csvText) {
  const parsed = Papa.parse(csvText, {
    skipEmptyLines: true,
    dynamicTyping: true
  });

  const records = parsed.data;
  if (!Array.isArray(records)) {
    return [];
  }

  const first = records[0] || [];
  const firstCol = String(first[0] || "").toLowerCase();
  const looksLikeHeader =
    firstCol.includes("time") ||
    firstCol.includes("timestamp");
  const body = looksLikeHeader ? records.slice(1) : records;

  return body
    .filter((r) => Array.isArray(r) && r.length > 1)
    .map(mapRow);
}

async function downloadSelectedFile() {
  if (!selectedFile.value) {
    return;
  }

  downloading.value = true;
  try {
    statusText.value = `Downloading ${selectedFile.value}...`;
    const csvText = await serial.readFile(selectedFile.value);
    const csvWithHeader = ensureCsvHeader(csvText);
    rows.value = parseCsv(csvWithHeader);
    triggerBrowserDownload(selectedFile.value, csvWithHeader);
    currentPage.value = 1;
    fileDialog.value = false;
    statusText.value = `Loaded ${rows.value.length} record(s) and saved locally`;
    toast("CSV loaded and downloaded", "success");
  } catch (err) {
    statusText.value = err.message || "Download failed";
    toast(statusText.value, "error");
  } finally {
    downloading.value = false;
  }
}

function onConvert() {
  if (rows.value.length === 0) {
    toast("No data to convert. Please load a CSV file first.", "warning");
    return;
  }

  converting.value = true;
  try {
    statusText.value = `Converting ${rows.value.length} records with posture adjustment...`;
    rows.value = postureAdjustment.convertRows(rows.value);
    currentPage.value = 1;
    
    const scaleFactor = postureAdjustment.getGravityScaleFactor();
    let message = `Converted ${rows.value.length} record(s) successfully`;
    if (scaleFactor && scaleFactor !== 1) {
      message += ` (Gravity scale factor: ${scaleFactor.toFixed(4)})`;
    }
    statusText.value = message;
    toast("Acceleration conversion completed", "success");
  } catch (err) {
    statusText.value = err.message || "Conversion failed";
    toast(statusText.value, "error");
  } finally {
    converting.value = false;
  }
}

function triggerFileInput() {
  // Trigger the hidden file input element
  if (fileInput.value) {
    fileInput.value.click();
  }
}

function onLocalFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  uploading.value = true;
  try {
    statusText.value = `Reading local file: ${file.name}...`;
    
    // Utilize FileReader API to read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result;
        if (typeof csvText !== "string") {
          throw new Error("Failed to read file as text");
        }

        // Apply existing CSV processing logic
        const csvWithHeader = ensureCsvHeader(csvText);
        rows.value = parseCsv(csvWithHeader);
        currentPage.value = 1;
        statusText.value = `Loaded ${rows.value.length} record(s) from ${file.name}`;
        toast("Local CSV file loaded successfully", "success");
      } catch (err) {
        statusText.value = err.message || "Failed to parse CSV";
        toast(statusText.value, "error");
      } finally {
        uploading.value = false;
        // Reset file input element for subsequent file selection
        if (fileInput.value) {
          fileInput.value.value = "";
        }
      }
    };

    reader.onerror = () => {
      statusText.value = "Failed to read file";
      toast("Failed to read local file", "error");
      uploading.value = false;
      if (fileInput.value) {
        fileInput.value.value = "";
      }
    };

    reader.readAsText(file);
  } catch (err) {
    statusText.value = err.message || "File processing failed";
    toast(statusText.value, "error");
    uploading.value = false;
  }
}
</script>
