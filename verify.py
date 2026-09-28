# -*- coding: utf-8 -*-
import os
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
BASE = Path(r"D:\ERS-Tech-ISP-Images")

IMG_EXT = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}

# 统计图片数量
total = 0
by_brand = {}

for brand in sorted(BASE.iterdir()):
    if not brand.is_dir() or brand.name.startswith('.'):
        continue
    count = sum(1 for _ in brand.rglob('*') if _.is_file() and _.suffix.lower() in IMG_EXT)
    by_brand[brand.name] = count
    total += count

print("=" * 60)
print("各品牌图片数量统计")
print("=" * 60)
for brand, count in sorted(by_brand.items()):
    print(f"{brand}: {count} 张")

print("=" * 60)
print(f"总计: {total} 张图片")
print(f"软件显示: 8256 张")
print(f"差异: {total - 8256} 张")
