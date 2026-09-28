# -*- coding: utf-8 -*-
import os
import sys
from pathlib import Path
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')
BASE = Path(r"D:\ERS-Tech-ISP-Images")

IMG_EXT = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}

# 检查是否有文件丢失
# 统计每个品牌文件夹的结构
print("检查文件夹结构：")
print("=" * 60)

for brand in sorted(BASE.iterdir()):
    if not brand.is_dir() or brand.name.startswith('.'):
        continue
    
    # 直接子目录
    subdirs = [d for d in brand.iterdir() if d.is_dir()]
    # 直接文件
    files = [f for f in brand.iterdir() if f.is_file() and f.suffix.lower() in IMG_EXT]
    # 递归统计
    all_files = list(brand.rglob('*'))
    img_files = [f for f in all_files if f.is_file() and f.suffix.lower() in IMG_EXT]
    
    if brand.name in ['OPPO', 'HUAWEI', 'SAMSUNG', 'LG']:
        print(f"\n{brand.name}:")
        print(f"  直接子目录: {len(subdirs)}")
        print(f"  直接图片文件: {len(files)}")
        print(f"  递归图片文件: {len(img_files)}")

# 检查是否有同名文件在不同位置
print("\n\n检查同名文件（可能丢失）：")
print("=" * 60)

all_files = list(BASE.rglob('*'))
img_files = [f for f in all_files if f.is_file() and f.suffix.lower() in IMG_EXT]

by_name = defaultdict(list)
for f in img_files:
    by_name[f.name].append(f)

# 找出有重复文件名的
for name, paths in by_name.items():
    if len(paths) > 1:
        # 检查这些文件是否在不同文件夹
        dirs = set(p.parent for p in paths)
        if len(dirs) > 1:
            print(f"\n同名文件在不同文件夹: {name}")
            for p in paths:
                print(f"  - {p.relative_to(BASE)}")
            break  # 只显示第一个例子
