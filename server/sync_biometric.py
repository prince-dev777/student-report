import time
import requests
from zk import ZK, const

# Configuration
DEVICE_IP = '192.168.0.12'
DEVICE_PORT = 4370 # Default ZKTeco Port
LOCAL_API_URL = 'http://127.0.0.1:5000/api/attendance/biometric'
INSTITUTE_ID = '6a4234d917e9263d070eab02' # Replace with your actual Mongo Institute ID
POLL_INTERVAL = 10 # Check for new scans every 10 seconds

def fetch_and_sync():
    print(f"Connecting to Biometric device at {DEVICE_IP}:{DEVICE_PORT}...")
    zk = ZK(DEVICE_IP, port=DEVICE_PORT, timeout=5, force_udp=False)
    conn = None
    try:
        conn = zk.connect()
        print("Connected successfully! Fetching logs...")
        
        # Read all attendance logs from device memory
        attendance = conn.get_attendance()
        
        # We can read the last synced timestamp to only upload new records
        # For simplicity, we send the logs to our backend which handles upserting uniquely
        print(f"Found {len(attendance)} logs on the device. Syncing to Render...")
        
        synced_count = 0
        for log in attendance:
            # log.user_id = Roll Number/Enroll ID
            # log.timestamp = datetime object
            # log.status = 1 (OUT) or 0 (IN) (or similar depending on model)
            
            roll_number = str(log.user_id)
            timestamp_str = log.timestamp.strftime('%Y-%m-%d %I:%M %p') # YYYY-MM-DD HH:MM AM/PM
            date_part, time_part = timestamp_str.split(' ', 1)
            
            # Determine type
            log_type = 'OUT' if log.status == 1 else 'IN'
            
            # Send POST request to Render
            payload = {
                "instituteId": INSTITUTE_ID,
                "rollNumber": roll_number,
                "type": log_type,
                "time": time_part
            }
            
            try:
                res = requests.post(LOCAL_API_URL, json=payload, timeout=5)
                if res.status_code == 200:
                    synced_count += 1
            except Exception as e:
                # If network fails, keep iterating
                pass
                
        print(f"Sync complete! Successfully synced {synced_count} records to EduTrack.")
        
    except Exception as e:
        print(f"Connection failed: {e}")
        print("Make sure your laptop is connected to the same WiFi network as the biometric machine.")
    finally:
        if conn:
            try:
                conn.disconnect()
            except:
                pass

if __name__ == '__main__':
    print("--------------------------------------------------")
    print("      EduTrack - Biometric WiFi Sync Script       ")
    print("--------------------------------------------------")
    print("Press Ctrl+C to stop the sync script.")
    
    # Run loop
    while True:
        try:
            fetch_and_sync()
        except KeyboardInterrupt:
            print("\nSync script stopped.")
            break
        except Exception as e:
            print(f"Error in sync loop: {e}")
            
        print(f"Waiting {POLL_INTERVAL} seconds for next sync cycle...")
        time.sleep(POLL_INTERVAL)
