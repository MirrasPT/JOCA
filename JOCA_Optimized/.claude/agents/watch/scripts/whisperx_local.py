#!/usr/bin/env python3
"""Transcribe a video via WhisperX running locally.

No API key needed. Requires: pip install whisperx
Uses GPU (CUDA) automatically if available, falls back to CPU.
Returns segments in the same {start, end, text} shape as transcribe.parse_vtt.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path


DEFAULT_MODEL = "large-v2"


def is_available() -> bool:
    try:
        import whisperx  # noqa: F401
        return True
    except ImportError:
        return False


def _detect_device() -> tuple[str, str]:
    """Return (device, compute_type) based on available hardware."""
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda", "float16"
    except ImportError:
        pass
    return "cpu", "int8"


def extract_audio(video_path: str, out_path: Path) -> Path:
    """Extract mono 16kHz WAV — WhisperX preferred format."""
    if shutil.which("ffmpeg") is None:
        raise SystemExit("ffmpeg is not installed. Install with: brew install ffmpeg")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel", "error",
        "-y",
        "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"ffmpeg audio extraction failed: {result.stderr.strip()}")
    if not out_path.exists() or out_path.stat().st_size == 0:
        raise SystemExit("ffmpeg produced no audio — video may have no audio track")
    return out_path


def transcribe_video(
    video_path: str,
    audio_out: Path,
    model_name: str = DEFAULT_MODEL,
    language: str | None = None,
) -> tuple[list[dict], str]:
    """Run WhisperX locally: extract audio → transcribe → return segments.

    Returns (segments, backend_label). Raises SystemExit on any failure.
    """
    if not is_available():
        raise SystemExit(
            "whisperx is not installed. Run: pip install whisperx\n"
            "Requires torch — see https://github.com/m-bain/whisperX for details."
        )

    import whisperx

    device, compute_type = _detect_device()
    print(f"[watch] extracting audio for WhisperX ({device})…", file=sys.stderr)
    audio_path = extract_audio(video_path, audio_out)

    print(f"[watch] loading model {model_name} on {device} ({compute_type})…", file=sys.stderr)
    load_kwargs: dict = {"device": device, "compute_type": compute_type}
    if language:
        load_kwargs["language"] = language
    model = whisperx.load_model(model_name, **load_kwargs)

    print("[watch] transcribing…", file=sys.stderr)
    transcribe_kwargs: dict = {"batch_size": 16}
    if language:
        transcribe_kwargs["language"] = language
    result = model.transcribe(str(audio_path), **transcribe_kwargs)

    raw_segments = result.get("segments") or []
    segments = [
        {
            "start": round(float(seg.get("start") or 0.0), 2),
            "end": round(float(seg.get("end") or 0.0), 2),
            "text": (seg.get("text") or "").strip(),
        }
        for seg in raw_segments
        if (seg.get("text") or "").strip()
    ]

    if not segments:
        raise SystemExit("WhisperX returned no transcript segments")

    backend_label = f"whisperx/{model_name} ({device})"
    print(f"[watch] transcribed {len(segments)} segments via {backend_label}", file=sys.stderr)
    return segments, backend_label


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(
            "usage: whisperx_local.py <video-path> [<audio-out.wav>] [--model NAME] [--language LANG]",
            file=sys.stderr,
        )
        raise SystemExit(2)

    video = sys.argv[1]
    audio_out = (
        Path(sys.argv[2]) if len(sys.argv) > 2 and not sys.argv[2].startswith("--")
        else Path("audio.wav")
    )
    model_name = DEFAULT_MODEL
    language = None
    if "--model" in sys.argv:
        model_name = sys.argv[sys.argv.index("--model") + 1]
    if "--language" in sys.argv:
        language = sys.argv[sys.argv.index("--language") + 1]

    segs, backend = transcribe_video(video, audio_out, model_name=model_name, language=language)
    print(json.dumps({"backend": backend, "segments": segs}, indent=2))
