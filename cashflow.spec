# cashflow.spec
# -*- mode: python ; coding: utf-8 -*-

import os

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        # Копируем весь frontend внутрь .exe
        ('frontend', 'frontend'),
    ],
    hiddenimports=[
        'sqlalchemy.dialects.sqlite',
        'webview.platforms.winforms',
        'clr',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(
    a.pure,
    a.zipped_data,
    cipher=block_cipher,
)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='cashflow',          # имя выходного файла
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,                 # сжатие (нужен UPX)
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,            # --noconsole
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # icon='frontend/icon.ico',  # раскомментируй если добавишь иконку
)