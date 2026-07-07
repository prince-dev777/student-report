from zk import ZK
import sys

ip = '192.168.0.12'
port = 71

print(f"Connecting to ZK device at {ip}:{port}...")
zk = ZK(ip, port=port, timeout=5, force_udp=False)
conn = None
try:
    conn = zk.connect()
    print("Connected successfully!")
    
    # Disable device during operations (recommended)
    conn.disable_device()
    
    print("\nDevice Info:")
    try:
        print(f"- Firmware: {conn.get_firmware_version()}")
    except Exception as e:
        print(f"- Firmware: Failed to fetch ({e})")
        
    try:
        print(f"- Device Name: {conn.get_device_name()}")
    except Exception as e:
        print(f"- Device Name: Failed to fetch ({e})")

    users = conn.get_users()
    print(f"\nFound {len(users)} users registered on device:")
    for user in users[:10]: # print first 10 users
        print(f"- ID: {user.user_id} | Name: {user.name} | Role: {user.privilege}")
        
    # Enable device again
    conn.enable_device()
except Exception as e:
    print(f"Error communicating with device: {e}")
finally:
    if conn:
        try:
            conn.disconnect()
        except:
            pass
