from pathlib import Path

from PIL import Image


BRAND_DIR = Path(__file__).resolve().parents[1] / "public" / "brand"
JOBS = (
    ("rise-platform-fixed-background.png", "rise-platform-fixed-background", ((1672, 941), (768, 432))),
    ("mentee-home-continuous-dark.png", "mentee-home-continuous-dark", ((1920, 2400), (800, 1000))),
    ("mentee-home-continuous-light.png", "mentee-home-continuous-light", ((1920, 2400), (800, 1000))),
)


def main() -> None:
    for source_name, stem, sizes in JOBS:
        source = Image.open(BRAND_DIR / source_name).convert("RGB")
        for index, size in enumerate(sizes):
            image = source if source.size == size else source.resize(size, Image.Resampling.LANCZOS)
            suffix = "" if index == 0 else "-mobile"
            image.save(BRAND_DIR / f"{stem}{suffix}.webp", "WEBP", quality=88, method=6)
            image.save(BRAND_DIR / f"{stem}{suffix}.avif", "AVIF", quality=64, speed=6)
            print(f"Generated {stem}{suffix} at {size[0]}x{size[1]}")


if __name__ == "__main__":
    main()
