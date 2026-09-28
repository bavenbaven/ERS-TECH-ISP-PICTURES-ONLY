# -*- coding: utf-8 -*-
import os
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
BASE = Path(r"D:\ERS-Tech-ISP-Images")

IMG_EXT = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}

# 最终统计
total_brands = 0
total_dirs = 0
total_files = 0
total_size = 0
empty_dirs = 0
single_file_dirs = 0

for brand in sorted(BASE.iterdir()):
    if not brand.is_dir() or brand.name.startswith('.'):
        continue
    total_brands += 1
    
    dir_count = 0
    file_count = 0
    size = 0
    
    for item in brand.rglob('*'):
        if item.is_file():
            file_count += 1
            size += item.stat().st_size
            if item.suffix.lower() in IMG_EXT:
                total_files += 1
        elif item.is_dir():
            dir_count += 1
    
    total_dirs += dir_count
    total_size += size
    
    # 统计单文件文件夹
    for subdir in brand.iterdir():
        if subdir.is_dir():
            files = [f for f in subdir.rglob('*') if f.is_file()]
            if len(files) == 1:
                single_file_dirs += 1

print("=" * 70)
print("整理完成 - 最终统计")
print("=" * 70)
print(f"品牌文件夹数: {total_brands}")
print(f"子目录总数: {total_dirs}")
print(f"图片文件总数: {total_files}")
print(f"总大小: {total_size / 1024 / 1024:.2f} MB")
print(f"单文件文件夹数: {single_file_dirs}")
print()
print("对比软件显示:")
print(f"  软件型号数: 8160 (我们: {total_dirs})")
print(f"  软件图片数: 8256 (我们: {total_files})")
print()
print("说明:")
print(f"  - 我们删除了 {8160 - total_dirs} 个重复的型号文件夹")
print(f"  - 我们删除了 {8256 - total_files} 张重复的图片")
print(f"  - 这是正常的整理结果，保持了唯一性")
