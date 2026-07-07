from zk import ZK

ip = '192.168.0.13'
print(f"Testing ZK UDP connection on {ip}:71...")

zk = ZK(ip, port=71, timeout=5, force_udp=True)
conn = None
try:
    conn = zk.connect()
    print("SUCCESS! Connected over UDP port 71!")
    print("Device firmware version:", conn.get_firmware_version())
    conn.disconnect()
except Exception as e:
    print("UDP port 71 connection failed:", e)

print(f"\nTesting ZK TCP connection on {ip}:71...")
zk_tcp = ZK(ip, port=71, timeout=5, force_udp=False)
try:
    conn = zk_tcp.connect()
    print("SUCCESS! Connected over TCP port 71!")
    conn.disconnect()
except Exception as e:
    print("TCP port 71 connection failed:", e)
