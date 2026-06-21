---
name: lyric-align
description: "Forced alignment of lyrics to audio — produce word/line-level timestamps via WhisperX (large-v3) with optional Demucs vocal separation, then emit LRC, ASS, or SRT for lyric videos. MUST be invoked when the user says: lyric sync, lyric timestamps, karaoke timing, forced alignment, word-level timestamps, WhisperX lyrics, lyric video timing."
metadata:
  version: 1.0.0
  origin: local
---

# Lyric Align

Specialist for word/line-level lyric-to-audio forced alignment using WhisperX + wav2vec2. Output: LRC (line-timed), ASS (animated karaoke), SRT (word highlight). Target project: Simao-sina (Remotion lyric videos).

---

## CRITICAL — Wrong tools for this task

**Do NOT use:**
- `gemini-brain` agent — falls back to faster-whisper tiny, segment-level timestamps (3-12s granularity). Useless for lyric sync.
- `watch` agent — same backend, same limitation.
- faster-whisper standalone — gives coarse segment timestamps only; drifts on sung audio.

**Use this skill.** WhisperX adds a second forced-alignment pass (wav2vec2 CTC phoneme model) on top of faster-whisper, converting segment timestamps into word-level onsets with ~10ms precision + per-word confidence scores.

---

## Pipeline

```
[audio file]
      │
      ▼
[1. Demucs — vocal stem separation]   ← biggest accuracy lever; skip only if a cappella
      │
      ▼
[2. WhisperX large-v3 — transcription OR fixed-transcript alignment]
      │
      ▼
[3. wav2vec2 forced alignment — word-level timestamps]
      │
      ▼
[4. Export — LRC / ASS / SRT]
      │
      ▼
[5. Manual review — flag low-confidence words]
```

---

## Setup (Windows venv)

```powershell
python -m venv .venv
.venv\Scripts\activate

# Core
pip install whisperx          # pulls faster-whisper + torch
pip install demucs

# GPU (match your CUDA version — check with: nvidia-smi)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# ffmpeg must be on PATH — whisperx and demucs both shell out to it
# Download from https://www.gyan.dev/ffmpeg/builds/ → add bin/ to PATH
```

**Windows pitfall:** CTranslate2 (used by faster-whisper/WhisperX) requires cuDNN + cuBLAS DLLs on PATH. If you see `Could not load library cudnn_ops_infer64_8.dll`, install cuDNN and add to PATH or use CPU mode (`--device cpu`).

**Diarization:** pyannote requires a HuggingFace token. Not needed for lyric sync — skip `--diarize`.

---

## Step 1 — Demucs vocal separation

```bash
# HTDemucs (best quality, ~9.0 dB SDR vs Spleeter ~5.9)
demucs --two-stems=vocals song.wav

# Output: separated/htdemucs/song/vocals.wav
#         separated/htdemucs/song/no_vocals.wav
```

Feed `vocals.wav` into WhisperX. Instrument bleed smears word onsets — always separate first unless already a cappella.

**Caveat:** dense harmonies and backing vocals remain in the vocal stem; onsets may still blur on chorus stacks.

---

## Step 2 — WhisperX alignment

### Option A — Known lyrics (PREFERRED for lyric videos)

When you have the official lyrics text, supply them as the transcript and run alignment only. ASR on sung vocals mis-hears words; fixed-transcript alignment is higher accuracy.

```bash
# Save lyrics to lyrics.txt first (one line per lyric line)
whisperx separated/htdemucs/song/vocals.wav \
  --model large-v3 \
  --align_model WAV2VEC2_ASR_LARGE_LV60K_960H \
  --language en \
  --initial_prompt "$(cat lyrics.txt)" \
  --output_format all \
  --output_dir ./output \
  --highlight_words True
```

For fixed-transcript forced alignment (bypasses ASR entirely):

```python
import whisperx

device = "cuda"
audio = whisperx.load_audio("separated/htdemucs/song/vocals.wav")

# Load alignment model
model_a, metadata = whisperx.load_align_model(
    language_code="en",
    device=device,
    model_name="WAV2VEC2_ASR_LARGE_LV60K_960H"
)

# Build segments from your known lyrics (no transcription step)
segments = [{"text": line, "start": None, "end": None} for line in open("lyrics.txt")]

result = whisperx.align(
    segments,
    model_a,
    metadata,
    audio,
    device,
    return_char_alignments=False
)

# result["segments"] → word-level timestamps + confidence
```

### Option B — Transcription first (when lyrics are unknown)

```bash
whisperx separated/htdemucs/song/vocals.wav \
  --model large-v3 \
  --align_model WAV2VEC2_ASR_LARGE_LV60K_960H \
  --language en \
  --output_format all \
  --output_dir ./output \
  --highlight_words True
```

**VRAM:** large-v3 ~10GB. Medium fallback (~5GB): replace `large-v3` with `medium`.

---

## Step 3 — Output formats

| Format | Use case | Flag |
|--------|----------|------|
| LRC | Line-timed lyrics (foobar2000, VLC, AIMP, Remotion) | `--output_format lrc` |
| ASS | Animated karaoke with per-word fill (lyric video NLEs, Remotion) | `--output_format ass` |
| SRT | Word-by-word highlight (standard subtitles) | `--output_format srt` + `--highlight_words True` |
| VTT | Web player subtitles | `--output_format vtt` |

**For Remotion lyric videos:** export JSON for programmatic control:

```python
import json

words = []
for seg in result["segments"]:
    for w in seg["words"]:
        words.append({
            "word": w["word"].strip(),
            "start": round(w["start"], 3),  # seconds
            "end":   round(w["end"], 3),
            "confidence": round(w.get("score", 0), 3)
        })

with open("output/timestamps.json", "w") as f:
    json.dump(words, f, indent=2)
```

### Output spec (JSON schema)

```json
[
  {
    "word": "never",
    "start": 4.182,
    "end": 4.501,
    "confidence": 0.94
  }
]
```

Fields: `word` (stripped), `start`/`end` (seconds, 3dp), `confidence` (0.0–1.0).

---

## Step 4 — Review and cleanup

Low-confidence words need manual nudge:

```python
LOW_CONF = 0.6

flagged = [w for w in words if w["confidence"] < LOW_CONF]
for w in flagged:
    print(f"⚠ [{w['start']:.3f}–{w['end']:.3f}] '{w['word']}' conf={w['confidence']:.2f}")
```

**Common drift cases requiring manual correction:**
- Melisma (one syllable sustained across many notes)
- Fast rap (words under 80ms apart)
- Sustained final notes — alignment snaps to note end, not phoneme onset
- Chorus with backing vocal layers

Editors: Audacity (label track), Aegisub (ASS), or custom Remotion scrubber.

---

## Accuracy expectations

| Condition | Word onset accuracy |
|-----------|-------------------|
| Clean speech | ±10ms |
| Sung vocals (Demucs isolated) | ±30–80ms |
| Sung vocals (no separation) | ±100–300ms |
| Dense harmonies / fast rap | ±100ms+ (flag for review) |

WhisperX is sufficient for lyric video production with manual cleanup on flagged words. For reference-grade precision (e.g., academic phonetics), use Montreal Forced Aligner (MFA) — heavier setup but tighter onsets.

---

## Alternative tools

| Tool | When to use |
|------|-------------|
| `open-lrc` (PyPI: openlrc) | Convenience wrapper → `.lrc` direct output; less control |
| Montreal Forced Aligner (MFA) | When WhisperX drift is unacceptable; requires Conda + lexicon |
| faster-whisper standalone | Segment timing only (3-12s); NOT for lyric sync |

---

## Related skills

- **remotion** — consume `timestamps.json` to drive animated lyric components
- **video** — export pipeline from Remotion render to final video
- **img-gen** — generate per-line visual assets timed to lyric segments
