"""Bounded local preview ASR. Inputs are approved WAV bytes, not a transcript."""
import argparse
import hashlib
import json
from pathlib import Path
import wave

parser = argparse.ArgumentParser()
parser.add_argument("--audio", required=True)
parser.add_argument("--models-root", required=True)
args = parser.parse_args()
audio = Path(args.audio).resolve(strict=True)
with wave.open(str(audio), "rb") as source:
    duration = source.getnframes() / source.getframerate()
    if duration <= 0 or duration > 30 or source.getnchannels() != 1:
        raise ValueError("Only short approved mono recordings are supported")

import torch
import whisper

torch.set_num_threads(4)
model_path = Path(args.models_root).resolve(strict=True) / "tiny.en.pt"
# Never initiate a hidden model download during a learner's request.
expected = whisper._MODELS["tiny.en"].split("/")[-2]
if hashlib.sha256(model_path.read_bytes()).hexdigest() != expected:
    raise ValueError("The preinstalled ASR model has not passed its checksum")
model = whisper.load_model(str(model_path), device="cpu")
result = model.transcribe(str(audio), fp16=False, language="en", temperature=0)
print(json.dumps({"text": result["text"].strip(), "language": result["language"]}, ensure_ascii=False))
