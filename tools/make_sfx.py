#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
合成机械键盘按键音（3 个力度变体）+ 里程碑提示音
做法：短噪声爆破（click）+ 低频阻尼正弦（thock），指数衰减包络
输出：audio/key1.wav / key2.wav / key3.wav / milestone.wav（16bit 单声道 44.1kHz）
"""
import math
import random
import struct
import wave
import os

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'audio')


def env_exp(n, tau):
    return math.exp(-n / (SR * tau))


def make_key(path, thock_freq, thock_amp, noise_amp, tau_noise, tau_thock, click_amp):
    random.seed(int(thock_freq * 7))
    n_total = int(SR * 0.09)
    samples = []
    prev = 0.0
    for n in range(n_total):
        t = n / SR
        # 噪声（高频 click），做一次高通（差分）让声音更脆
        white = random.uniform(-1.0, 1.0)
        hp = white - prev
        prev = white
        click = click_amp * hp * env_exp(n, tau_noise)
        # 低频 thock
        thock = thock_amp * math.sin(2 * math.pi * thock_freq * t) * env_exp(n, tau_thock)
        # 轻微的板共振
        res = 0.12 * math.sin(2 * math.pi * (thock_freq * 2.7) * t) * env_exp(n, 0.012)
        v = click + thock + res
        v = max(-1.0, min(1.0, v))
        samples.append(int(v * 32767 * 0.85))
    with wave.open(path, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', s) for s in samples))
    return path


def make_milestone(path):
    """里程碑：两个上行音（清脆的短叮）"""
    n_total = int(SR * 0.34)
    samples = []
    for n in range(n_total):
        t = n / SR
        v = 0.0
        if t < 0.17:
            v += 0.4 * math.sin(2 * math.pi * 1180 * t) * env_exp(n, 0.055)
        if t >= 0.09:
            n2 = n - int(SR * 0.09)
            v += 0.35 * math.sin(2 * math.pi * 1570 * (n2 / SR)) * env_exp(n2, 0.07)
        v += 0.06 * math.sin(2 * math.pi * 2360 * t) * env_exp(n, 0.02)
        samples.append(int(max(-1, min(1, v)) * 32767 * 0.8))
    with wave.open(path, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', s) for s in samples))
    return path


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    # 轻 / 中 / 重 三种力度（模拟不同键位与指力）
    make_key(os.path.join(OUT, 'key1.wav'), 118, 0.34, 0.55, 0.0042, 0.030, 0.34)
    make_key(os.path.join(OUT, 'key2.wav'), 96, 0.42, 0.62, 0.0038, 0.038, 0.42)
    make_key(os.path.join(OUT, 'key3.wav'), 138, 0.30, 0.48, 0.0046, 0.026, 0.30)
    make_milestone(os.path.join(OUT, 'milestone.wav'))
    for f in ['key1.wav', 'key2.wav', 'key3.wav', 'milestone.wav']:
        p = os.path.join(OUT, f)
        print(f, os.path.getsize(p), 'bytes')
