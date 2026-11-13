#!/usr/bin/env python3
"""Deterministic photographic Replay-style card compositor (no generative models).

Measured from Apple 900x1200 AMRply.TAI02 raster examples: sharp upper square,
fade around y=640..900, photo-coloured low-frequency continuation below.
This is a measured reconstruction, not Apple's unpublished server renderer.

Example:
  python3 tools/make-replay-artist-card.py input.jpg output.png
The width is preserved; a tall source is cropped vertically only. For a group
photo use the default top=0 to retain every face across the original width.
"""
import argparse
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageOps


def compose(source, width=900, height=1200, top=0.0,
            fade_start=640, fade_end=900, blur_radius=150):
    source = ImageOps.exif_transpose(source).convert('RGB')
    scaled_height = round(source.height * width / source.width)
    resized = source.resize((width, scaled_height), Image.Resampling.LANCZOS)
    # Keep the full horizontal field: no face-selective crops or redrawing.
    crop_y = round(max(0, scaled_height - width) * top)
    square = np.asarray(resized, dtype=np.uint8)[crop_y:crop_y + width]
    if square.shape[0] < width:
        square = np.pad(square, ((0, width-square.shape[0]), (0, 0), (0, 0)), mode='edge')
    extended = np.pad(square, ((0, height-width), (0, 0), (0, 0)), mode='edge')
    blurred = np.asarray(Image.fromarray(extended).filter(
        ImageFilter.GaussianBlur(blur_radius)), dtype=np.float32)
    y = np.arange(height, dtype=np.float32)
    progress = np.clip((y-fade_start)/(fade_end-fade_start), 0, 1)
    alpha = (progress*progress*(3-2*progress))[:,None,None]
    result = np.rint(extended.astype(np.float32)*(1-alpha)+blurred*alpha).astype(np.uint8)
    # The source's sharp upper region must remain pixel-identical after resize.
    assert np.array_equal(result[:fade_start], extended[:fade_start])
    return Image.fromarray(result)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--top', type=float, default=0.0,
                        help='Vertical crop position 0=top, 1=bottom. No horizontal crop.')
    parser.add_argument('--blur', type=float, default=150)
    args = parser.parse_args()
    if not 0 <= args.top <= 1:
        parser.error('--top must be between 0 and 1')
    if args.output.suffix.lower() != '.png':
        parser.error('Use a PNG output to preserve the composited pixels losslessly')
    with Image.open(args.source) as photo:
        card = compose(photo, top=args.top, blur_radius=args.blur)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    card.save(args.output, format='PNG', optimize=True)
    print(args.output)

if __name__ == '__main__':
    main()
