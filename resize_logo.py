"""
Logo Resizer - Production-ready icon resizing script.

Generates logos for all major platforms in one command:
- Web & PWA: 16, 32, 64, 96, 128, 192, 256, 384, 512
- Windows Desktop: 16, 32, 48, 64, 128, 256
- macOS: 16, 32, 64, 128, 256, 512, 1024
- Mobile: 120, 152, 167, 180
- Social Media: 200, 300, 400, 630, 500, 1200, 1500

Uses LANCZOS resampling for optimal quality and handles errors gracefully.
"""

import sys
from pathlib import Path
from PIL import Image


SIZES = [
    # Web & PWA
    16, 32, 64, 96, 128, 192, 256, 384, 512,
    # Windows Desktop (duplicates removed)
    48,
    # macOS
    1024,
    # Mobile
    120, 152, 167, 180,
    # Social Media
    200, 300, 400, 500, 630, 1200, 1500,
]
SIZES = sorted(list(set(SIZES)))  # Remove duplicates and sort
DEFAULT_INPUT = "logo.png"
OUTPUT_FORMAT = "PNG"
QUALITY = 95


def get_input_file() -> Path:
    """
    Get the input image filename from user or use default.

    Returns:
        Path: Path object to the input image file.

    Raises:
        FileNotFoundError: If the specified file doesn't exist.
    """
    filename = input(f"Enter logo filename (default: {DEFAULT_INPUT}): ").strip()
    if not filename:
        filename = DEFAULT_INPUT

    input_path = Path(filename)

    if not input_path.exists():
        raise FileNotFoundError(f"Image file not found: {input_path.name}")

    if not input_path.is_file():
        raise ValueError(f"Path is not a file: {input_path.name}")

    return input_path


def validate_image(image: Image.Image, filename: str) -> None:
    """
    Validate that the image is suitable for resizing.

    Args:
        image: PIL Image object to validate.
        filename: Original filename for error reporting.

    Raises:
        ValueError: If image format is not supported.
    """
    if image.mode not in ("RGB", "RGBA", "L", "LA"):
        raise ValueError(
            f"Unsupported image mode: {image.mode}. "
            f"Expected RGB, RGBA, L, or LA."
        )


def resize_and_save(input_path: Path, size: int) -> bool:
    """
    Resize image to specified size and save it.

    Args:
        input_path: Path to the input image.
        size: Target size in pixels (will be size x size).

    Returns:
        bool: True if successful, False otherwise.
    """
    try:
        with Image.open(input_path) as img:
            output_path = input_path.parent / f"{input_path.stem}-{size}x{size}.png"

            # Resize using LANCZOS for best quality
            resized = img.resize(
                (size, size),
                Image.Resampling.LANCZOS
            )

            # Save with high quality settings
            resized.save(output_path, OUTPUT_FORMAT, quality=QUALITY, optimize=True)

            print(f"  [OK] Created {output_path.name} ({size}x{size}px)")
            return True

    except Exception as e:
        print(f"  [FAIL] Failed to create {size}x{size}px version: {e}")
        return False


def main() -> int:
    """
    Main entry point for the logo resizer.

    Returns:
        int: Exit code (0 for success, 1 for failure).
    """
    try:
        print("\n=== Logo Resizer ===\n")

        input_path = get_input_file()
        print(f"\nProcessing: {input_path.name}")

        # Validate the image can be opened
        with Image.open(input_path) as img:
            original_size = img.size
            original_mode = img.mode

            validate_image(img, input_path.name)

        print(f"  Original size: {original_size[0]}x{original_size[1]}px ({original_mode})")
        print(f"\nResizing to {len(SIZES)} sizes using LANCZOS resampling...\n")

        # Resize to each target size
        successful = 0
        for size in SIZES:
            if resize_and_save(input_path, size):
                successful += 1

        # Summary
        print(f"\n{'='*30}")
        print(f"Completed: {successful}/{len(SIZES)} sizes created successfully")

        if successful == len(SIZES):
            print("[SUCCESS] All resizes completed successfully!")
            return 0
        else:
            print("[WARNING] Some resizes failed. Check errors above.")
            return 1

    except FileNotFoundError as e:
        print(f"\n[ERROR] {e}", file=sys.stderr)
        return 1
    except ValueError as e:
        print(f"\n[ERROR] {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
