from __future__ import annotations

import base64
import binascii
import io
from dataclasses import dataclass

from PIL import Image, ImageEnhance, ImageOps

MAX_EDGE = 1568
MIN_EDGE = 200
JPEG_QUALITY = 85
MAX_INPUT_BYTES = 12 * 1024 * 1024

ALLOWED_MEDIA = {"image/jpeg", "image/png", "image/gif", "image/webp"}

class ImageTooLarge(Exception):
    pass

class UnsupportedImage(Exception):
    pass

@dataclass
class ProcessResult:
    data: str
    media_type: str
    width: int
    height: int
    original_width: int
    original_height: int
    original_bytes: int
    processed_bytes: int
    rotated: bool
    metadata_stripped: bool

def decode_base64(data: str) -> bytes:
    paylaod = data.strip()
    if paylaod.startswith("data:"):
        _, _, paylaod = paylaod.partition(",")
    try:
        raw = base64.b64decode(paylaod, validate=False)
    except (binascii.Error, ValueError) as exc:
        raise UnsupportedImage("not valid base64") from exc
    if not raw:
        raise UnsupportedImage("empty image")
    if len(raw) > MAX_INPUT_BYTES:
        raise ImageTooLarge(f"{len(raw)} bytes exceeds {MAX_INPUT_BYTES}")
    return raw

def target_size(width: int, height: int) -> tuple[int, int]:
    longest = max(width, height)
    if longest <= MAX_EDGE:
        return width, height
    scale = MAX_EDGE / longest
    return max(1, round(width * scale)), max(1, round(height * scale))

def process_image(data: str, enhance: bool = True) -> ProcessResult:
    raw = decode_base64(data)

    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except Exception as exc:
        raise UnsupportedImage("could not decode image") from exc

    original_w, original_h = image.size
    if min(original_w, original_h) < 1:
        raise UnsupportedImage("zero-dimension image")

    upright = ImageOps.exif_transpose(image)
    rotated = upright.size != image.size
    image = upright

    if image.mode not in ("RGB", "L"):
        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGBA")
            flat = Image.new("RGB", image.size, (255, 255, 255))
            flat.paste(image, mask=image.split()[-1])
            image = flat
        else:
            image = image.convert("RGB")
    elif image.mode == "L":
        image = image.convert("RGB")

    new_size = target_size(*image.size)
    if new_size != image.size:
        image = image.resize(new_size, Image.LANCZOS)

    if enhance and min(image.size) >= MIN_EDGE:
        image = ImageOps.autocontrast(image, cutoff=1)
        image = ImageEnhance.Sharpness(image).enhance(1.3)

    buffer = io.BytesIO()

    image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    processed = buffer.getvalue()

    return ProcessResult(
        data=base64.b64encode(processed).decode("ascii"),
        media_type="image/jpeg",
        width=image.size[0],
        height=image.size[1],
        original_width=original_w,
        original_height=original_h,
        original_bytes=len(raw),
        processed_bytes=len(processed),
        rotated=rotated,
        metadata_stripped=True,
    )