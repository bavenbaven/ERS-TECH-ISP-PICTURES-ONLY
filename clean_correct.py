# -*- coding: utf-8 -*-
"""
正确清理重复图片
只删除同一文件夹内的重复文件，不同文件夹的同名文件保留
"""

import os
import sys
from pathlib import Path
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')
BASE = Path(r"D:\ERS-Tech-ISP-Images")

IMG_EXT = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}

def get_dims(path):
    try:
        import struct
        with open(path, 'rb') as f:
            sig = f.read(16)
            if sig[:2] == b'\xff\xd8':
                return read_jpeg(f)
            if sig[:8] == b'\x89PNG\r\n\x1a\n':
                return struct.unpack('>II', sig[16:24])
            if sig[:4] == b'BM':
                return struct.unpack('<II', sig[18:26])
        return 0, 0
    except:
        return 0, 0

def read_jpeg(f):
    while True:
        m = f.read(2)
        if len(m) < 2: return 0, 0
        if m[0] != 0xFF: continue
        if m[1] == 0xD9: return 0, 0
        if m[1] in (0xC0, 0xC2):
            f.read(3)
            return struct.unpack('>HH', f.read(4))
        l = struct.unpack('>H', f.read(2))[0]
        f.read(l - 2)

def better(a, b):
    """比较两个图片，返回更好的那个"""
    o = {'.jpg': 4, '.jpeg': 4, '.png': 3, '.bmp': 2, '.webp': 1}
    sa, sb = o.get(a.suffix.lower(), 0), o.get(b.suffix.lower(), 0)
    if sa != sb:
        return a if sa > sb else b
    wa, ha = get_dims(a)
    wb, hb = get_dims(b)
    if wa * ha != wb * hb:
        return a if wa * ha > wb * hb else b
    return a if a.stat().st_size >= b.stat().st_size else b

def main():
    total_deleted = 0
    
    # 按品牌文件夹处理
    for brand_dir in sorted(BASE.iterdir()):
        if not brand_dir.is_dir() or brand_dir.name.startswith('.'):
            continue
        
        # 收集该品牌下所有图片
        images = []
        for item in brand_dir.rglob('*'):
            if item.is_file() and item.suffix.lower() in IMG_EXT:
                images.append(item)
        
        if not images:
            continue
        
        # 按文件名分组
        by_name = defaultdict(list)
        for img in images:
            by_name[img.name].append(img)
        
        # 处理每个文件名组
        for name, paths in by_name.items():
            if len(paths) > 1:
                # 有多个同名文件，保留最好的一个
                paths.sort(key=lambda p: p.stat().st_size, reverse=True)
                best = paths[0]
                others = paths[1:]
                
                # 删除其余的
                for other in others:
                    try:
                        other.unlink()
                        total_deleted += 1
                        print(f"删除: {other.relative_to(BASE)}")
                    except Exception as e:
                        print(f"删除失败: {other.relative_to(BASE)} - {e}")
    
    # 清理空文件夹
    for brand_dir in sorted(BASE.iterdir()):
        if not brand_dir.is_dir() or brand_dir.name.startswith('.'):
            continue
        for dirpath, dirnames, filenames in os.walk(str(brand_dir), topdown=False):
            dp = Path(dirpath)
            if dp == brand_dir:
                continue
            try:
                if not any(dp.iterdir()):
                    dp.rmdir()
                    print(f"删除空文件夹: {dp.relative_to(BASE)}")
            except:
                pass
    
    print(f"\n清理完成！删除了 {total_deleted} 个重复文件")

if __name__ == '__main__':
    main()
