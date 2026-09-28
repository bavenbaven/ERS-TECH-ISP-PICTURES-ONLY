# -*- coding: utf-8 -*-
import os
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
BASE = Path(r"D:\ERS-Tech-ISP-Images")

IMG_EXT = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}

# 检查是否有重复文件（文件名相同但在不同位置）
print("检查重复文件：")
print("=" * 60)

file_map = {}
duplicates = []

for item in BASE.rglob('*'):
    if item.is_file() and item.suffix.lower() in IMG_EXT:
        name = item.name
        if name in file_map:
            duplicates.append((name, file_map[name], item))
        else:
            file_map[name] = item

if duplicates:
    print(f"发现 {len(duplicates)} 个重复文件名：\n")
    for name, path1, path2 in duplicates[:20]:
        print(f"文件名: {name}")
        print(f"  位置1: {path1.relative_to(BASE)}")
        print(f"  位置2: {path2.relative_to(BASE)}")
        print()
else:
    print("没有发现重复文件名")

print("\n" + "=" * 60)
print(f"总文件数: {len(file_map)} 个唯一文件名")
print(f"重复文件数: {len(duplicates)} 个")
