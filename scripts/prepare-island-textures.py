#!/usr/bin/env python3
"""Make small, repeatable terrain textures from inspected image-gen inputs.

The input images are deliberately not treated as production-ready. This pass
does four things in a fixed order: move the source seam to the middle, feather
both the middle and outer wrap seams, flatten broad luminance drift using a
wrap-aware blur, and compress the result around a project palette.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


SIZE = 512
SEAM_BAND = 36
BLUR_RADIUS = 72
OUTPUT_QUALITY = 88

ROOT = Path(__file__).resolve().parents[1]
INPUT_DIR = ROOT / "tmp" / "island-textures-input"
OUTPUT_DIR = ROOT / "packages" / "world" / "public" / "island-textures"
TILING_PATH = ROOT / "island-texture-tiling-4x4.png"
FLATNESS_PATH = ROOT / "island-texture-flatness-8x8.png"
METRICS_PATH = ROOT / "island-texture-processing.json"

TEXTURES = {
    "grass-albedo": {"input": "grass-generated.png", "target": (126, 185, 72), "contrast": 0.68},
    "route-albedo": {"input": "path-generated.png", "target": (232, 214, 166), "contrast": 0.48},
    "rock-albedo": {"input": "rock-generated.png", "target": (163, 103, 70), "contrast": 0.58},
    "surface-detail": {"input": "detail-generated.png", "target": (128, 128, 128), "contrast": 0.24},
}


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def smoothstep(value: float) -> float:
    value = clamp(value, 0.0, 1.0)
    return value * value * (3.0 - 2.0 * value)


def blend_pixel(left: tuple[int, ...], right: tuple[int, ...], amount: float) -> tuple[int, ...]:
    average = tuple((a + b) * 0.5 for a, b in zip(left, right))
    return tuple(
        int(round(a * (1.0 - amount) + b * amount))
        for a, b in zip(left, average)
    )


def repair_vertical_seam(image: Image.Image, center: bool) -> Image.Image:
    """Feather a vertical periodic seam without making an edge discontinuity."""

    pixels = image.load()
    width, height = image.size
    result = image.copy()
    output = result.load()
    for distance in range(SEAM_BAND):
        amount = 1.0 - smoothstep(distance / max(1, SEAM_BAND - 1))
        if center:
            left_x = width // 2 - 1 - distance
            right_x = width // 2 + distance
        else:
            left_x = distance
            right_x = width - 1 - distance
        for y in range(height):
            left = pixels[left_x, y]
            right = pixels[right_x, y]
            output[left_x, y] = blend_pixel(left, right, amount)
            output[right_x, y] = blend_pixel(right, left, amount)
    return result


def repair_horizontal_seam(image: Image.Image, center: bool) -> Image.Image:
    """Feather a horizontal periodic seam without making an edge discontinuity."""

    pixels = image.load()
    width, height = image.size
    result = image.copy()
    output = result.load()
    for distance in range(SEAM_BAND):
        amount = 1.0 - smoothstep(distance / max(1, SEAM_BAND - 1))
        if center:
            top_y = height // 2 - 1 - distance
            bottom_y = height // 2 + distance
        else:
            top_y = distance
            bottom_y = height - 1 - distance
        for x in range(width):
            top = pixels[x, top_y]
            bottom = pixels[x, bottom_y]
            output[x, top_y] = blend_pixel(top, bottom, amount)
            output[x, bottom_y] = blend_pixel(bottom, top, amount)
    return result


def make_seamless(source: Image.Image) -> Image.Image:
    resized = source.convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    # Put the generated image's original outer edges in the middle, where a
    # broad feather can hide their mismatch. The second pass repairs the new
    # outer periodic boundary as well.
    shifted = ImageChops.offset(resized, SIZE // 2, SIZE // 2)
    shifted = repair_vertical_seam(shifted, center=True)
    shifted = repair_horizontal_seam(shifted, center=True)
    shifted = repair_vertical_seam(shifted, center=False)
    shifted = repair_horizontal_seam(shifted, center=False)
    return shifted


def wrap_blur(image: Image.Image) -> Image.Image:
    """Blur a 3×3 torus so the flatten pass cannot invent edge gradients."""

    tiled = Image.new("RGB", (SIZE * 3, SIZE * 3))
    for row in range(3):
        for column in range(3):
            tiled.paste(image, (column * SIZE, row * SIZE))
    blurred = tiled.filter(ImageFilter.GaussianBlur(BLUR_RADIUS))
    return blurred.crop((SIZE, SIZE, SIZE * 2, SIZE * 2))


def palette_flatten(image: Image.Image, target: tuple[int, int, int], contrast: float) -> Image.Image:
    """Remove broad lighting-like drift and remap to a quiet project palette."""

    source = image.load()
    blurred = wrap_blur(image).load()
    source_luma_total = 0.0
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b = source[x, y]
            source_luma_total += 0.2126 * r + 0.7152 * g + 0.0722 * b
    mean_luma = max(1.0, source_luma_total / (SIZE * SIZE))

    result = Image.new("RGB", (SIZE, SIZE))
    output = result.load()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b = source[x, y]
            br, bg, bb = blurred[x, y]
            luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
            blur_luma = max(1.0, 0.2126 * br + 0.7152 * bg + 0.0722 * bb)

            # Divide out only the broad, illumination-shaped component. The
            # narrow clamp prevents a generator's local blotch from becoming
            # an artificial halo after division.
            correction = clamp(luma / blur_luma, 0.91, 1.09)
            corrected_luma = luma * correction
            variation = clamp(corrected_luma / mean_luma - 1.0, -0.16, 0.16)
            factor = 1.0 + variation * contrast

            # Keep a small amount of the source chroma so the generated input
            # still contributes material character, but let the target swatch
            # own the actual palette and value range.
            source_chroma = (
                (r - luma) * 0.05,
                (g - luma) * 0.05,
                (b - luma) * 0.05,
            )
            output[x, y] = tuple(
                int(round(clamp(channel * factor + chroma, 0.0, 255.0)))
                for channel, chroma in zip(target, source_chroma)
            )
    return result


def prepare_texture(spec: dict[str, object]) -> Image.Image:
    source = Image.open(INPUT_DIR / str(spec["input"]))
    seamless = make_seamless(source)
    target = spec["target"]
    if not isinstance(target, tuple):
        raise TypeError("texture target must be a tuple")
    return palette_flatten(seamless, target, float(spec["contrast"]))


def luma(pixel: tuple[int, ...]) -> float:
    r, g, b = pixel[:3]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def seam_metrics(image: Image.Image) -> dict[str, float]:
    pixels = image.load()
    vertical = []
    horizontal = []
    for index in range(SIZE):
        vertical.append(sum(abs(a - b) for a, b in zip(pixels[0, index], pixels[SIZE - 1, index])) / 3)
        horizontal.append(sum(abs(a - b) for a, b in zip(pixels[index, 0], pixels[index, SIZE - 1])) / 3)
    small = image.resize((8, 8), Image.Resampling.BOX)
    small_luma = [luma(small.getpixel((x, y))) for y in range(8) for x in range(8)]
    return {
        "edgeMeanAbsDifference": round((sum(vertical) + sum(horizontal)) / (len(vertical) + len(horizontal)), 4),
        "edgeMaxAbsDifference": round(max(vertical + horizontal), 4),
        "downsample8x8LumaMin": round(min(small_luma), 4),
        "downsample8x8LumaMax": round(max(small_luma), 4),
        "downsample8x8LumaRange": round(max(small_luma) - min(small_luma), 4),
    }


def make_tiling_sheet(images: dict[str, Image.Image]) -> None:
    panel_size = 1024
    sheet = Image.new("RGB", (panel_size * 2, panel_size * 2), (246, 242, 229))
    names = list(images)
    for index, name in enumerate(names):
        panel = Image.new("RGB", (panel_size, panel_size))
        tile = images[name].resize((256, 256), Image.Resampling.LANCZOS)
        for row in range(4):
            for column in range(4):
                panel.paste(tile, (column * 256, row * 256))
        sheet.paste(panel, ((index % 2) * panel_size, (index // 2) * panel_size))
    sheet.save(TILING_PATH, format="PNG", optimize=True)


def make_flatness_sheet(images: dict[str, Image.Image]) -> None:
    panel_size = 512
    sheet = Image.new("RGB", (panel_size * 2, panel_size * 2), (246, 242, 229))
    names = list(images)
    for index, name in enumerate(names):
        small = images[name].resize((8, 8), Image.Resampling.BOX)
        panel = small.resize((panel_size, panel_size), Image.Resampling.NEAREST)
        sheet.paste(panel, ((index % 2) * panel_size, (index // 2) * panel_size))
    sheet.save(FLATNESS_PATH, format="PNG", optimize=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    images: dict[str, Image.Image] = {}
    metrics: dict[str, object] = {"schemaVersion": 1, "size": SIZE, "textures": {}}
    for name, spec in TEXTURES.items():
        image = prepare_texture(spec)
        output_path = OUTPUT_DIR / f"{name}.webp"
        image.save(output_path, format="WEBP", quality=OUTPUT_QUALITY, method=6)
        # Validate the bytes that the browser will decode, not only the
        # pre-compression working image.
        decoded = Image.open(output_path).convert("RGB")
        images[name] = decoded
        texture_metrics = seam_metrics(decoded)
        texture_metrics.update(
            {
                "path": str(output_path.relative_to(ROOT)),
                "bytes": output_path.stat().st_size,
                "sha256": sha256(output_path),
            }
        )
        metrics["textures"][name] = texture_metrics  # type: ignore[index]

    make_tiling_sheet(images)
    make_flatness_sheet(images)
    metrics["totalBytes"] = sum(
        int(value["bytes"]) for value in metrics["textures"].values()  # type: ignore[union-attr]
    )
    metrics["verificationImages"] = [
        str(TILING_PATH.relative_to(ROOT)),
        str(FLATNESS_PATH.relative_to(ROOT)),
    ]
    metrics["pipeline"] = {
        "source": "codex-built-in-imagegen",
        "postProcess": [
            "512x512 resize",
            "half-size offset",
            "center and outer periodic seam feather",
            "wrap-aware Gaussian blur luminance flatten",
            "palette remap and contrast compression",
            f"WebP quality {OUTPUT_QUALITY}",
        ],
    }
    METRICS_PATH.write_text(json.dumps(metrics, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
