# -*- coding: utf-8 -*-
"""
先预览：打印每个品牌下的分组情况，不实际修改文件
"""

import os
from pathlib import Path
from collections import defaultdict

BASE = Path(r"D:\ERS-Tech-ISP-Images")
IMG_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}

def normalize_name(name: str) -> str:
    suffixes_to_remove = [
        '_EMMC', '_ISP', '_JTAG', '_TP', '_EDL', '_RST',
        '_EMMC_1', '_EMMC_2', '_ISP_1',
    ]
    n = name
    for s in suffixes_to_remove:
        n = n.replace(s, '')
    n = Path(n).stem
    brands = ['acer', 'advan', 'agm', 'alcatel', 'amazon', 'amg', 'andromax',
              'apple', 'archos', 'artel', 'asus', 'benq', 'blackview', 'blu',
              'cat', 'cherry', 'coolpad', 'crius', 'dell', 'dji', 'gionee',
              'google', 'gsmart', 'haier', 'hmd', 'honor', 'hotwav', 'htc',
              'huawei', 'icatch', 'infinix', 'itel', 'jio', 'kyocera',
              'lenovo', 'lg', 'macoo', 'meizu', 'micromax', 'motorola', 'nec',
              'nokia', 'nubia', 'oppo', 'panasonic', 'philips', 'pocket',
              'polaroid', 'realme', 'samsung', 'sony', 'tcl', 'teclast', 'thl',
              'ugreen', 'umpdig', 'vivo', 'vodafone', 'wiko',
              'xiaomi', 'zte', 'zopo']
    lower = n.lower()
    for brand in brands:
        if lower.startswith(brand + '_') or lower.startswith(brand + ' '):
            n = n[len(brand):].lstrip('_ ')
            break
    n = n.replace('_', ' ').strip()
    return n

def is_image(path: Path) -> bool:
    return path.suffix.lower() in IMG_EXTENSIONS

def main():
    total_imgs = 0
    for brand_dir in sorted(BASE.iterdir()):
        if not brand_dir.is_dir():
            continue
        grouped = defaultdict(list)
        for img_path in brand_dir.rglob('*'):
            if img_path.is_file() and is_image(img_path):
                norm = normalize_name(img_path.name)
                grouped[norm].append(img_path)
        
        # 打印有重复的型号
        duplicates = {k: v for k, v in grouped.items() if len(v) > 1}
        if duplicates:
            print(f"\n=== {brand_dir.name} (有重复型号的文件夹) ===")
            for norm, paths in sorted(duplicates.items()):
                print(f"\n  [{norm}] 共 {len(paths)} 张图:")
                for p in paths:
                    print(f"    - {p.relative_to(brand_dir)}")
        
        total_imgs += len(grouped)
    
    print(f"\n总共处理了 {total_imgs} 个型号分组")

if __name__ == '__main__':
    main()
