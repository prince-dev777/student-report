from zk import ZK

ip = '192.168.0.12'
print(f"Testing ZK UDP connection on {ip}:4370...")

zk = ZK(ip, port=4370, timeout=5, force_udp=True)
conn = None
try:
    conn = zk.connect()
    print("SUCCESS! Connected over UDP port 4370!")
    print("Device firmware version:", conn.get_firmware_version())
    conn.disconnect()
except Exception as e:
    print("UDP port 4370 connection failed:", e)

print(f"\nTesting ZK TCP connection on {ip}:4370...")
zk_tcp = ZK(ip, port=4370, timeout=5, force_udp=False)
try:
    conn = zk_tcp.connect()
    print("SUCCESS! Connected over TCP port 4370!")
    conn.disconnect()
except Exception as e:
    print("TCP port 4370 connection failed:", e)
