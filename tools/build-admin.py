#!/usr/bin/env python3
"""Compatibility entry point: package the visual builder, not the retired forms UI."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('build-builder.py')),run_name='__main__')
