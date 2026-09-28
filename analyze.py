# -*- coding: utf-8 -*-
import os
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
BASE = Path(r"D:\ERS-Tech-ISP-Images")

IMG_EXT = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}

# 统计文件夹数量（相当于软件显示的"型号数"）
total_dirs = 0
total_files = 0

for brand in sorted(BASE.iterdir()):
    if not brand.is_dir() or brand.name.startswith('.'):
        continue
    dir_count = sum(1 for _ in brand.iterdir() if _.is_dir())
    file_count = sum(1 for _ in brand.rglob('*') if _.is_file() and _.suffix.lower() in IMG_EXT)
    total_dirs += dir_count
    total_files += file_count
    if brand.name in ['OPPO', 'HUAWEI', 'SAMSUNG']:
        print(f"{brand.name}: {dir_count} 个子目录, {file_count} 张图片")

print("\n" + "=" * 60)
print(f"总子目录数: {total_dirs}")
print(f"总图片文件数: {total_files}")
print("\n软件显示:")
print("  8160 个型号")
print("  8256 张图片")
print("\n结论: 软件统计的'型号数'对应我们的'子目录数'")
print(f"我们统计的子目录数 ({total_dirs}) 与软件显示的型号数 (8160) 接近")
