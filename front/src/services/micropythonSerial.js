const CTRL_A = "\x01";
const CTRL_B = "\x02";
const CTRL_C = "\x03";
const CTRL_D = "\x04";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toUint8Array(text) {
  return new TextEncoder().encode(text);
}

function fromUint8Array(bytes) {
  return new TextDecoder().decode(bytes);
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}

function stripControlChars(text) {
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
}

function concatArrays(chunks) {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export class MicroPythonSerial {
  constructor() {
    this.port = null;
    this.readRemainder = "";
    this.busy = false;
  }

  isSupported() {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  async connect() {
    if (!this.isSupported()) {
      throw new Error("This browser does not support the Web Serial API. Please use Chrome or Edge.");
    }
    const filters = [
      { usbVendorId: 0x10c4 },
      { usbVendorId: 0x1a86 },
      { usbVendorId: 0x303a }
    ];

    this.port = await navigator.serial.requestPort({ filters });
    await this.port.open({ baudRate: 115200 });
    this.readRemainder = "";
  }

  async disconnect() {
    if (!this.port) {
      return;
    }
    try {
      if (this.port.readable?.locked) {
        this.port.readable.cancel();
      }
    } catch (_err) {
      // Ignore cancellation error when stream is already closed.
    }
    await this.port.close();
    this.port = null;
    this.readRemainder = "";
  }

  async write(text) {
    if (!this.port?.writable) {
      throw new Error("Serial port is not connected.");
    }
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(toUint8Array(text));
    } finally {
      writer.releaseLock();
    }
  }

  async readUntil(ending, timeoutMs = 8000) {
    if (!this.port?.readable) {
      throw new Error("Serial port is not readable.");
    }
    const reader = this.port.readable.getReader();
    let buffer = this.readRemainder;
    this.readRemainder = "";

    try {
      const started = Date.now();
      while (true) {
        const idx = buffer.indexOf(ending);
        if (idx >= 0) {
          const body = buffer.slice(0, idx + ending.length);
          this.readRemainder = buffer.slice(idx + ending.length);
          return body;
        }

        const elapsed = Date.now() - started;
        const left = timeoutMs - elapsed;
        if (left <= 0) {
          throw new Error("Serial read timed out. Please check the device connection.");
        }

        const { value, done } = await withTimeout(
          reader.read(),
          left,
          "Serial read timed out. Please check the device connection."
        );
        if (done) {
          throw new Error("Serial connection was closed.");
        }
        buffer += fromUint8Array(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  async enterRawRepl() {
    await this.write(CTRL_C + CTRL_C);
    await delay(120);
    await this.write(CTRL_A);
    await this.readUntil(">", 6000);
  }

  async exitRawRepl() {
    await this.write(CTRL_B);
    await delay(60);
  }

  async exec(script) {
    if (!this.port) {
      throw new Error("Please connect the USB device first.");
    }
    if (this.busy) {
      throw new Error("The device is busy. Please try again.");
    }

    this.busy = true;
    try {
      await this.enterRawRepl();
      await this.write(script.replace(/\r\n/g, "\n"));
      await this.write(CTRL_D);
      const payload = await this.readUntil("\x04>", 12000);
      await this.exitRawRepl();

      const okIndex = payload.indexOf("OK");
      if (okIndex < 0) {
        throw new Error("The device returned an invalid response.");
      }

      const body = payload.slice(okIndex + 2, -2);
      const segments = body.split("\x04");
      const stdout = stripControlChars(segments[0] || "");
      const stderr = stripControlChars((segments.slice(1).join("\n") || "").trim());

      if (stderr) {
        throw new Error(stderr);
      }

      return stdout.trim();
    } finally {
      this.busy = false;
    }
  }

  async listCsvFiles(root = "/") {
    const cmd = `
import os
ROOT = ${JSON.stringify(root)}

def is_dir(path):
    try:
        os.listdir(path)
        return True
    except OSError:
        return False

def walk(path):
    try:
        names = os.listdir(path)
    except OSError:
        return
    for name in names:
        full = path.rstrip('/') + '/' + name if path != '/' else '/' + name
        if is_dir(full):
            walk(full)
        else:
            if name.lower().endswith('.csv'):
                print(full)

walk(ROOT)
`;
    const raw = await this.exec(cmd);
    return raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.endsWith(".csv"));
  }

  async readFile(path) {
    const cmd = `
import ubinascii

p = ${JSON.stringify(path)}
with open(p, 'rb') as f:
    while True:
        b = f.read(240)
        if not b:
            break
        print(ubinascii.b2a_base64(b).decode().strip())
print('__EOF__')
`;
    const raw = await this.exec(cmd);
    const lines = raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && s !== "__EOF__");

    const chunks = lines.map((line) => {
      const bin = atob(line);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) {
        out[i] = bin.charCodeAt(i);
      }
      return out;
    });

    return fromUint8Array(concatArrays(chunks));
  }
}
