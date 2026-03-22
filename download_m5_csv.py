#!/usr/bin/env python3
"""
Download all .csv files from an M5StickC Plus2 (MicroPython filesystem) over USB.

This script uses mpremote to:
1) connect to the board serial port,
2) recursively list CSV files under remote root,
3) copy them into a local output directory while preserving structure.

Example:
  python3 download_m5_csv.py --port /dev/cu.usbmodem1101 --remote-root /flash --out ./csv_backup
"""

from __future__ import annotations

import argparse
import glob
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import List


REMOTE_LIST_SCRIPT = r'''
import os

ROOT = {root!r}


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
        if path == '/':
            full = '/' + name
        else:
            full = path.rstrip('/') + '/' + name

        if is_dir(full):
            walk(full)
        else:
            if name.lower().endswith('.csv'):
                print(full)


walk(ROOT)
'''

MPREMOTE_CMD: List[str] | None = None


def run_cmd(cmd: List[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, text=True, capture_output=True)


def mpremote_base_cmd() -> List[str]:
    if MPREMOTE_CMD is None:
        raise RuntimeError(
            "mpremote is not available. Install with: pip3 install mpremote"
        )
    return MPREMOTE_CMD


def find_port(manual_port: str | None) -> str:
    if manual_port:
        return manual_port

    patterns = [
        "/dev/cu.usbmodem*",
        "/dev/cu.usbserial*",
        "/dev/tty.usbmodem*",
        "/dev/tty.usbserial*",
        "/dev/cu.SLAB_USBtoUART*",
    ]

    matches: List[str] = []
    for p in patterns:
        matches.extend(glob.glob(p))

    if not matches:
        raise RuntimeError(
            "No serial port found. Please pass --port explicitly, e.g. --port /dev/cu.usbmodem1101"
        )

    matches = sorted(set(matches))
    return matches[0]


def ensure_mpremote_available() -> None:
    global MPREMOTE_CMD

    if shutil.which("mpremote"):
        MPREMOTE_CMD = ["mpremote"]
        return

    probe = run_cmd([sys.executable, "-m", "mpremote", "help"])
    if probe.returncode == 0:
        MPREMOTE_CMD = [sys.executable, "-m", "mpremote"]
        return

    raise RuntimeError(
        "mpremote is not installed or not usable in current environment. "
        "Install with: pip3 install mpremote"
    )


def list_remote_csv_files(port: str, remote_root: str) -> List[str]:
    script = REMOTE_LIST_SCRIPT.format(root=remote_root)
    result = run_cmd(mpremote_base_cmd() + ["connect", port, "exec", script])

    if result.returncode != 0:
        raise RuntimeError(
            "Failed to list CSV files from device.\n"
            f"Command stderr:\n{result.stderr.strip()}"
        )

    files = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if line.endswith(".csv") and line.startswith("/"):
            files.append(line)

    return sorted(set(files))


def remote_to_local_path(remote_file: str, out_dir: Path) -> Path:
    rel = remote_file.lstrip("/")
    return out_dir / rel


def copy_file(port: str, remote_file: str, local_file: Path) -> None:
    local_file.parent.mkdir(parents=True, exist_ok=True)

    result = run_cmd(
        mpremote_base_cmd()
        + [
            "connect",
            port,
            "fs",
            "cp",
            f":{remote_file}",
            str(local_file),
        ]
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"Failed to copy {remote_file} -> {local_file}\n"
            f"Command stderr:\n{result.stderr.strip()}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download all .csv files from M5StickC Plus2 flash over USB"
    )
    parser.add_argument("--port", help="Serial port, e.g. /dev/cu.usbmodem1101")
    parser.add_argument(
        "--remote-root",
        default="/flash",
        help="Remote root path on device. Common values: /flash or /",
    )
    parser.add_argument(
        "--out",
        default="./csv_backup",
        help="Local output folder for downloaded files",
    )
    args = parser.parse_args()

    try:
        ensure_mpremote_available()
        port = find_port(args.port)

        out_dir = Path(args.out).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)

        print(f"Using port: {port}")
        print(f"Remote root: {args.remote_root}")
        print(f"Output folder: {out_dir}")

        files = list_remote_csv_files(port, args.remote_root)
        if not files:
            print("No .csv files found on device.")
            return 0

        print(f"Found {len(files)} csv file(s). Start downloading...")
        for i, remote_file in enumerate(files, start=1):
            local_file = remote_to_local_path(remote_file, out_dir)
            print(f"[{i}/{len(files)}] {remote_file} -> {local_file}")
            copy_file(port, remote_file, local_file)

        print("Done.")
        return 0

    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
