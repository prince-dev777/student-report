import socket

ip = '192.168.0.13'
ports = [71, 80, 4370, 7788, 5000, 8081]

print(f"Scanning open ports on {ip}...")
for port in ports:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(2.0)
    result = s.connect_ex((ip, port))
    if result == 0:
        print(f"Port {port} (TCP) is OPEN!")
    else:
        print(f"Port {port} (TCP) is closed.")
    s.close()

# Also test UDP for port 4370 (ZK standard)
# Since UDP is connectionless, connect_ex doesn't work, but we can print a note
print("ZK SDK usually listens on port 4370 (UDP).")
