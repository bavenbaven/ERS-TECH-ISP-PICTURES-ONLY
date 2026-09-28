# -*- coding: utf-8 -*-
"""
最终整理报告 - D:\ERS-Tech-ISP-Images
"""

import os
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
BASE = Path(r"D:\ERS-Tech-ISP-Images")

print("=" * 60)
print("文件夹整理完成报告")
print("=" * 60)

# 统计数据
total_brands = 0
total_dirs = 0
total_files = 0
total_size = 0
empty_dirs = 0

for bd in sorted(BASE.iterdir()):
    if bd.is_dir() and not bd.name.startswith('.'):
        total_brands += 1
        dir_count = 0
        file_count = 0
        size = 0
        
        for item in bd.rglob('*'):
            if item.is_file():
                file_count += 1
                size += item.stat().st_size
            elif item.is_dir():
                dir_count += 1
        
        if dir_count == 0 and file_count == 0:
            empty_dirs += 1
        
        total_dirs += dir_count
        total_files += file_count
        total_size += size
        
        # 打印各品牌统计
        print(f"\n【{bd.name}】")
        print(f"  子目录数: {dir_count}")
        print(f"  图片文件数: {file_count}")
        print(f"  总大小: {size / 1024:.1f} KB")

print("\n" + "=" * 60)
print("总体统计")
print("=" * 60)
print(f"品牌文件夹总数: {total_brands}")
print(f"子目录总数: {total_dirs}")
print(f"图片文件总数: {total_files}")
print(f"总文件大小: {total_size / 1024 / 1024:.2f} MB")
print(f"空目录数: {empty_dirs}")

# 显示主要品牌的子目录样例
print("\n" + "=" * 60)
print("主要品牌子目录样例")
print("=" * 60)

samples = ['OPPO', 'HUAWEI', 'SAMSUNG', 'ACER', 'LG', 'NOKIA']
for brand in samples:
    bd = BASE / brand
    if bd.exists():
        dirs = [d.name for d in bd.iterdir() if d.is_dir()]
        print(f"\n【{brand}】共 {len(dirs)} 个子目录")
        for d in sorted(dirs)[:5]:
            files = [f.name for f in (bd / d).iterdir() if f.is_file()]
            print(f"  - {d}: {len(files)} 个文件")
            for f in files:
                print(f"      * {f}")
        if len(dirs) > 5:
            print(f"  ... 还有 {len(dirs) - 5} 个子目录")
