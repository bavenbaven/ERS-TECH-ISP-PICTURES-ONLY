# -*- coding: utf-8 -*-
import os
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
BASE = Path(r"D:\ERS-Tech-ISP-Images")

IMG_EXT = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}

# 统计每个品牌的图片数量
print("各品牌图片数量统计：")
print("=" * 60)

total = 0
for bd in sorted(BASE.iterdir()):
    if bd.is_dir() and not bd.name.startswith('.'):
        count = sum(1 for _ in bd.rglob('*') if _.is_file() and _.suffix.lower() in IMG_EXT)
        total += count
        if count > 0:
            print(f"{bd.name}: {count} 张图片")

print("=" * 60)
print(f"总计: {total} 张图片")
print(f"软件显示: 8256 张图片")
print(f"差异: {total - 8256} 张")

# 找出超出软件显示的文件
print("\n超出软件显示的文件：")
count = 0
for bd in sorted(BASE.iterdir()):
    if bd.is_dir() and not bd.name.startswith('.'):
        for item in bd.rglob('*'):
            if item.is_file() and item.suffix.lower() in IMG_EXT:
                count += 1
                if count > 8256:
                    print(f"  {item.relative_to(BASE)}")
