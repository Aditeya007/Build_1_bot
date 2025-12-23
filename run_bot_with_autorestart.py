"""
Auto-restart wrapper for app_20.py
This script runs the bot and automatically restarts it when it exits (e.g., after scrapes complete)
"""
import subprocess
import sys
import time
import os
from pathlib import Path

# Get the directory containing this script
SCRIPT_DIR = Path(__file__).parent
BOT_SCRIPT = SCRIPT_DIR / "BOT" / "app_20.py"

print("=" * 80)
print("🔄 BOT AUTO-RESTART WRAPPER")
print("=" * 80)
print(f"Bot script: {BOT_SCRIPT}")
print("This will automatically restart the bot when it exits.")
print("Press Ctrl+C to stop completely.")
print("=" * 80)
print()

restart_count = 0

# Set environment variable to disable uvicorn's reload mode
# This ensures os._exit(1) properly terminates the process
env = os.environ.copy()
env["BOT_AUTO_RESTART"] = "1"

while True:
    try:
        restart_count += 1
        if restart_count > 1:
            print(f"\n{'=' * 80}")
            print(f"🔄 RESTARTING BOT (restart #{restart_count})")
            print(f"{'=' * 80}\n")
            time.sleep(2)  # Brief pause between restarts
        
        # Run the bot script with auto-restart env var
        # Use the same Python interpreter that's running this script
        process = subprocess.run(
            [sys.executable, str(BOT_SCRIPT)],
            cwd=str(SCRIPT_DIR),
            env=env
        )
        
        # If we get here, the bot exited
        exit_code = process.returncode
        
        if exit_code == 0:
            # Clean exit (Ctrl+C) - don't restart
            print("\n✅ Bot exited cleanly (exit code 0). Stopping auto-restart.")
            break
        else:
            # Any non-zero exit means restart (code 1 = requested, others = crash)
            print(f"\n🔄 Bot exited with code {exit_code}. Restarting...")
            if exit_code != 1:
                # If it wasn't a requested restart, wait a bit
                print("   (Waiting 3 seconds before restart...)")
                time.sleep(3)
            continue
            
    except KeyboardInterrupt:
        print("\n\n🛑 Ctrl+C detected. Stopping bot and auto-restart wrapper.")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error running bot: {e}")
        print("Retrying in 10 seconds...")
        time.sleep(10)
