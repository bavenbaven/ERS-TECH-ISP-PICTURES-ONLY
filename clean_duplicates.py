# -*- coding: utf-8 -*-
"""
清理重复图片文件
规则：同一文件名保留一个，删除其他重复文件
"""

import os
import sys
import shutil
from pathlib import Path
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')
BASE = Path(r"D:\ERS-Tech-ISP-Images")

IMG_EXT = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}

def get_file_info(path):
    """获取文件信息用于比较"""
    stat = path.stat()
    return {
        'size': stat.st_size,
        'mtime': stat.st_mtime,
        'path': path
    }

def main():
    # 收集所有图片文件
    files = []
    for item in BASE.rglob('*'):
        if item.is_file() and item.suffix.lower() in IMG_EXT:
            files.append(item)
    
    print(f"总共找到 {len(files)} 个图片文件")
    
    # 按文件名分组
    by_name = defaultdict(list)
    for f in files:
        by_name[f.name].append(f)
    
    # 找出重复的文件
    duplicates = []
    for name, paths in by_name.items():
        if len(paths) > 1:
            # 按文件大小排序，保留最大的
            paths.sort(key=lambda p: p.stat().st_size, reverse=True)
            best = paths[0]
            others = paths[1:]
            duplicates.append((name, best, others))
    
    print(f"\n发现 {len(duplicates)} 个重复文件名")
    print(f"需要删除 {sum(len(others) for _, _, others in duplicates)} 个重复文件")
    
    # 删除重复文件
    deleted = 0
    for name, best, others in duplicates:
        for other in others:
            try:
                other.unlink()
                deleted += 1
                print(f"删除: {other.relative_to(BASE)}")
            except Exception as e:
                print(f"删除失败: {other.relative_to(BASE)} - {e}")
    
    # 清理空文件夹
    for dirpath, dirnames, filenames in os.walk(str(BASE), topdown=False):
        dp = Path(dirpath)
        if dp == BASE:
            continue
        try:
            if not any(dp.iterdir()):
                dp.rmdir()
                print(f"删除空文件夹: {dp.relative_to(BASE)}")
        except Exception:
            pass
    
    print(f"\n清理完成！删除了 {deleted} 个重复文件")

if __name__ == '__main__':
    main()
