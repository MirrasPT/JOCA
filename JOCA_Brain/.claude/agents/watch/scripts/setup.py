#!/usr/bin/env python3
"""Setup / preflight for /watch.

Modes:
  setup.py --check      Silent preflight. Exit 0 if ready, 2/3/4 on failure.
  setup.py --json       Machine-readable status for Claude to parse.
  setup.py              Installer. Auto-installs deps, prints install hint for whisperx.

Exit codes (--check):
  0  ready
  2  missing binaries (ffmpeg/ffprobe/yt-dlp)
  3  whisperx not installed
  4  both missing
"""
from __future__ import annotations

import json
import platform
import shutil
import subprocess
import sys
from pathlib import Path


REQUIRED_BINARIES = ["ffmpeg", "ffprobe", "yt-dlp"]


def _check_binaries() -> list[str]:
    return [b for b in REQUIRED_BINARIES if not shutil.which(b)]


def _check_whisperx() -> bool:
    try:
        import whisperx  # noqa: F401
        return True
    except ImportError:
        return False


def _detect_device() -> str:
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu (torch not installed)"


def _status() -> dict:
    missing = _check_binaries()
    has_whisperx = _check_whisperx()

    if not missing and has_whisperx:
        status = "ready"
    elif missing and not has_whisperx:
        status = "needs_install_and_whisperx"
    elif missing:
        status = "needs_install"
    else:
        status = "needs_whisperx"

    return {
        "status": status,
        "missing_binaries": missing,
        "has_whisperx": has_whisperx,
        "device": _detect_device() if has_whisperx else None,
        "platform": platform.system(),
    }


def cmd_check() -> int:
    s = _status()
    if s["status"] == "ready":
        return 0

    parts = []
    if s["missing_binaries"]:
        parts.append(f"missing binaries: {', '.join(s['missing_binaries'])}")
    if not s["has_whisperx"]:
        parts.append("whisperx not installed (pip install whisperx)")
    installer = Path(__file__).resolve()
    sys.stderr.write(
        f"[watch] setup incomplete ({'; '.join(parts)}). "
        f"Run: python3 {installer}\n"
    )
    sys.stderr.flush()

    if s["missing_binaries"] and not s["has_whisperx"]:
        return 4
    if s["missing_binaries"]:
        return 2
    return 3


def cmd_json() -> int:
    json.dump(_status(), sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


def _brew_pkgs(missing: list[str]) -> list[str]:
    pkgs: list[str] = []
    for b in missing:
        if b in ("ffmpeg", "ffprobe") and "ffmpeg" not in pkgs:
            pkgs.append("ffmpeg")
        elif b == "yt-dlp" and "yt-dlp" not in pkgs:
            pkgs.append("yt-dlp")
        else:
            pkgs.append(b)
    return pkgs


def _install_binaries_macos(missing: list[str]) -> bool:
    if not shutil.which("brew"):
        print("[setup] Homebrew not found. Install from https://brew.sh, then re-run.", file=sys.stderr)
        return False
    pkgs = _brew_pkgs(missing)
    cmd = ["brew", "install", *pkgs]
    print(f"[setup] running: {' '.join(cmd)}", file=sys.stderr)
    result = subprocess.run(cmd)
    if result.returncode != 0:
        return False
    return not _check_binaries()


def cmd_install() -> int:
    missing = _check_binaries()
    if missing:
        system = platform.system()
        if system == "Darwin":
            ok = _install_binaries_macos(missing)
            if not ok:
                return 2
        elif system == "Linux":
            print("[setup] install binaries manually:", file=sys.stderr)
            print("  sudo apt install ffmpeg  &&  pipx install yt-dlp", file=sys.stderr)
            return 2
        elif system == "Windows":
            print("[setup] install binaries manually:", file=sys.stderr)
            print("  winget install Gyan.FFmpeg  &&  winget install yt-dlp.yt-dlp", file=sys.stderr)
            return 2
        else:
            print(f"[setup] unsupported platform ({system}). Install manually: {', '.join(missing)}", file=sys.stderr)
            return 2

    if not _check_whisperx():
        print("[setup] whisperx is not installed.", file=sys.stderr)
        print("", file=sys.stderr)
        print("  Install PyTorch first (see https://pytorch.org/get-started), then:", file=sys.stderr)
        print("    pip install whisperx", file=sys.stderr)
        print("", file=sys.stderr)
        print("  On macOS (CPU only):", file=sys.stderr)
        print("    pip install torch torchvision torchaudio", file=sys.stderr)
        print("    pip install whisperx", file=sys.stderr)
        print("", file=sys.stderr)
        print("  Model sizes: tiny/base/small/medium/large-v2 (default: large-v2 ~3GB)", file=sys.stderr)
        print("  First /watch run downloads the model automatically.", file=sys.stderr)
        return 3

    device = _detect_device()
    print(f"[setup] ready. whisperx available, device: {device}")
    return 0


def main() -> int:
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == "--check":
            return cmd_check()
        if arg == "--json":
            return cmd_json()
    return cmd_install()


if __name__ == "__main__":
    raise SystemExit(main())
