#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成游戏 icon（512/1024/192/96）
视觉：橙色渐变底 + 白色键帽 + 闪电 + VS 徽章 —— 与游戏内 UI 同色系
用法：python3 tools/make_icon.py
"""
import os
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs', 'icon')
os.makedirs(OUT, exist_ok=True)

S = 1024                      # 母版尺寸
ORANGE_TOP = (255, 138, 78)   # #FF8A4E
ORANGE_BOT = (226, 62, 20)    # #E23E14
NAVY = (31, 42, 68)           # #1F2A44
WHITE = (255, 255, 255)


def rounded_mask(size, radius):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def diagonal_gradient(size, c1, c2):
    """从左上到右下的对角渐变"""
    grad = Image.new('RGB', (size, size), c1)
    px = grad.load()
    span = size * 2
    for y in range(size):
        for x in range(size):
            t = (x + y) / span
            px[x, y] = (
                int(c1[0] + (c2[0] - c1[0]) * t),
                int(c1[1] + (c2[1] - c1[1]) * t),
                int(c1[2] + (c2[2] - c1[2]) * t),
            )
    return grad


img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
bg = diagonal_gradient(S, ORANGE_TOP, ORANGE_BOT).convert('RGBA')
img.paste(bg, (0, 0), rounded_mask(S, 180))
d = ImageDraw.Draw(img)

# ---- 背景速度线（左侧，淡白）----
streaks = Image.new('RGBA', (S, S), (0, 0, 0, 0))
sd = ImageDraw.Draw(streaks)
for i, (x0, y0, ln, th, a) in enumerate([
    (70, 300, 120, 12, 70),
    (40, 380, 88, 9, 50),
    (86, 452, 70, 8, 36),
]):
    sd.rounded_rectangle([x0, y0, x0 + ln, y0 + th], radius=th // 2, fill=(255, 255, 255, a))
img = Image.alpha_composite(img, streaks)
d = ImageDraw.Draw(img)

# ---- 键帽投影 ----
cap = (312, 276, 712, 676)          # 400x400
shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle(
    [cap[0] + 6, cap[1] + 22, cap[2] + 6, cap[3] + 22], radius=104, fill=(120, 32, 8, 120))
shadow = shadow.filter(ImageFilter.GaussianBlur(26))
img = Image.alpha_composite(img, shadow)
d = ImageDraw.Draw(img)

# ---- 键帽本体（白 + 底部厚边，模拟立体键帽）----
d.rounded_rectangle([cap[0], cap[1] + 12, cap[2], cap[3] + 12], radius=104, fill=(228, 214, 200, 255))
d.rounded_rectangle(cap, radius=104, fill=WHITE + (255,))

# ---- 闪电（橙色，键帽中央）----
cx, cy = (cap[0] + cap[2]) / 2, (cap[1] + cap[3]) / 2
bolt = [
    (cx + 26, cy - 132), (cx - 58, cy + 14), (cx + 6, cy + 14),
    (cx - 22, cy + 132), (cx + 68, cy - 20), (cx + 2, cy - 20),
]
d.polygon(bolt, fill=(255, 107, 53, 255))

# ---- VS 徽章（右下）----
bx, by, br = 806, 790, 96
d.ellipse([bx - br - 6, by - br - 6, bx + br + 6, by + br + 6], fill=(255, 255, 255, 60))
d.ellipse([bx - br, by - br, bx + br, by + br], fill=NAVY + (255,))
try:
    f_vs = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 84)
except Exception:
    f_vs = ImageFont.load_default()
tw = d.textbbox((0, 0), 'VS', font=f_vs)
d.text((bx - (tw[2] - tw[0]) / 2, by - (tw[3] - tw[1]) / 2 - 10), 'VS', font=f_vs, fill=WHITE)

# ---- 输出各尺寸 ----
master = img
sizes = [('icon-1024.png', 1024), ('icon-512.png', 512), ('icon-192.png', 192), ('icon-96.png', 96)]
for name, sz in sizes:
    master.resize((sz, sz), Image.LANCZOS).save(os.path.join(OUT, name), 'PNG', optimize=True)

print('生成完成 ->', OUT)
for name, sz in sizes:
    p = os.path.join(OUT, name)
    print(' ', name, sz, os.path.getsize(p) // 1024, 'KB')
