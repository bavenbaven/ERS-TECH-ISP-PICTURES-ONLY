# -*- coding: utf-8 -*-
"""
检查整理是否过度 - 验证文件完整性
"""

import os
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
BASE = Path(r"D:\ERS-Tech-ISP-Images")

IMG_EXT = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}

# 检查每个品牌文件夹的结构
print("品牌文件夹结构检查：")
print("=" * 70)

issues = []
for brand in sorted(BASE.iterdir()):
    if not brand.is_dir() or brand.name.startswith('.'):
        continue
    
    # 检查子目录结构
    for subdir in brand.iterdir():
        if subdir.is_dir():
            files = [f for f in subdir.rglob('*') if f.is_file()]
            img_files = [f for f in files if f.suffix.lower() in IMG_EXT]
            
            # 检查是否有空目录
            if len(img_files) == 0 and len(files) == 0:
                issues.append(f"{subdir.relative_to(BASE)}: 空目录")
            
            # 检查是否有多个同名文件
            names = [f.name for f in img_files]
            if len(names) != len(set(names)):
                issues.append(f"{subdir.relative_to(BASE)}: 有同名图片")
            
            # 检查是否有非图片文件（除了主图片外）
            other_files = [f for f in files if f.suffix.lower() not in IMG_EXT]
            if other_files:
                issues.append(f"{subdir.relative_to(BASE)}: 有非图片文件: {[f.name for f in other_files]}")

if issues:
    print(f"\n发现 {len(issues)} 个问题：\n")
    for issue in issues[:20]:
        print(f"  - {issue}")
    if len(issues) > 20:
        print(f"  ... 还有 {len(issues) - 20} 个问题")
else:
    print("\n未发现明显问题")

# 统计文件夹层级
print("\n\n文件夹层级分析：")
print("=" * 70)

for brand in ['OPPO', 'HUAWEI', 'SAMSUNG']:
    brand_dir = BASE / brand
    if not brand_dir.exists():
        continue
    
    # 统计各级目录
    level1 = 0  # 品牌下直接子目录
    level2 = 0  # 二级子目录
    level3 = 0  # 三级子目录
    
    for item in brand_dir.iterdir():
        if item.is_dir():
            level1 += 1
            for sub in item.iterdir():
                if sub.is_dir():
                    level2 += 1
                    for sub2 in sub.iterdir():
                        if sub2.is_dir():
                            level3 += 1
    
    print(f"{brand}:")
    print(f"  一级子目录: {level1}")
    print(f"  二级子目录: {level2}")
    print(f"  三级子目录: {level3}")
