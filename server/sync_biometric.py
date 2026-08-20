import os
import sys
import time
import requests

try:
    from zk import ZK, const
except ImportError:
    print("❌ 'pyzk' library is not installed.")
    print("👉 Install it by running: pip install pyzk requests")
    sys.exit(1)

# Default Configuration
DEFAULT_DEVICE_IP = '192.168.1.201'
DEVICE_PORT = 4370  # Standard ZKTeco / eSSL port
LOCAL_API_URL = 'http://127.0.0.1:5000/api/attendance/biometric'
POLL_INTERVAL = 10  # Seconds between sync cycles

def get_device_ip():
    if len(sys.argv) > 1:
        return sys.argv[1].strip()
    env_ip = os.environ.get('BIOMETRIC_IP')
    if env_ip:
        return env_ip.strip()
    return DEFAULT_DEVICE_IP

def fetch_and_sync(device_ip):
    print(f"\n📡 Connecting to Biometric Machine at {device_ip}:{DEVICE_PORT}...")
    zk = ZK(device_ip, port=DEVICE_PORT, timeout=5, force_udp=False)
    conn = None
    try:
        conn = zk.connect()
        print("✅ Connected successfully to Biometric Machine!")
        
        # Test machine details
        try:
            device_name = conn.get_device_name()
            print(f"📟 Device Model / Name: {device_name}")
        except Exception:
            pass

        # Read all attendance logs from device memory
        print("📥 Fetching attendance logs from machine memory...")
        attendance = conn.get_attendance()
        print(f"📊 Found {len(attendance)} total punch logs on device.")

        if not attendance:
            print("ℹ️ No attendance logs present on device.")
            return

        synced_count = 0
        error_count = 0

        for log in attendance:
            roll_number = str(log.user_id).strip()
            if not roll_number:
                continue

            # Format datetime
            timestamp_str = log.timestamp.strftime('%Y-%m-%d %I:%M %p')
            date_part, time_part = timestamp_str.split(' ', 1)
            
            # Determine punch type (0=IN, 1=OUT or status mapping)
            log_type = 'OUT' if log.status == 1 else 'IN'

            payload = {
                "rollNumber": roll_number,
                "type": log_type,
                "time": time_part
            }

            try:
                res = requests.post(LOCAL_API_URL, json=payload, timeout=5)
                if res.status_code == 200:
                    synced_count += 1
                else:
                    error_count += 1
            except Exception:
                error_count += 1

        print(f"🎉 Sync cycle completed: {synced_count} records processed successfully ({error_count} skipped/unmatched).")

    except Exception as e:
        print(f"❌ Connection to {device_ip} failed: {e}")
        print("\n🔍 Troubleshooting Checklist:")
        print(" 1. Make sure both your PC and Biometric machine are connected to the SAME WiFi/Router.")
        print(f" 2. Try pinging the device from Windows Command Prompt: ping {device_ip}")
        print(" 3. Verify the Biometric Machine's IP in its physical screen menu (Menu -> Comm -> Network).")
        print(" 4. Verify that Port 4370 is not blocked by your router or antivirus firewall.")
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass

if __name__ == '__main__':
    device_ip = get_device_ip()
    print("=" * 60)
    print("    CAREER XONE - BIOMETRIC DIRECT IP SYNC ENGINE")
    print("=" * 60)
    print(f"🎯 Target Biometric Machine IP : {device_ip}")
    print(f"🔌 Machine Port                : {DEVICE_PORT}")
    print(f"🖥️ Local Backend Server URL    : {LOCAL_API_URL}")
    print("=" * 60)
    print("💡 Tip: You can pass IP as argument: python sync_biometric.py 192.168.1.50\n")

    # Run once immediately
    fetch_and_sync(device_ip)

    print(f"\n⏳ Auto-polling active. Checking for new punches every {POLL_INTERVAL} seconds.")
    print("Press Ctrl + C to stop.")

    while True:
        try:
            time.sleep(POLL_INTERVAL)
            fetch_and_sync(device_ip)
        except KeyboardInterrupt:
            print("\n🛑 Biometric Sync stopped by user.")
            break
        except Exception as e:
            print(f"⚠️ Loop error: {e}")
            time.sleep(POLL_INTERVAL)
