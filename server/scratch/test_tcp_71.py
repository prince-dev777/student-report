import socket

ip = '192.168.0.12'
port = 71

print(f"Testing TCP connection to {ip}:{port}...")
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(5)
try:
    s.connect((ip, port))
    print("SUCCESS: TCP Port 71 is OPEN and connected!")
    s.close()
except Exception as e:
    print(f"FAILED: TCP Port 71 failed: {e}")
