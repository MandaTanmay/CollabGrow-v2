"""
Install schedule package for auto-retraining
"""

import subprocess
import sys

try:
    import schedule
    print("✓ schedule package already installed")
except ImportError:
    print("Installing schedule package...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "schedule"])
    print("✓ schedule installed successfully")
