import cv2
print(cv2.__version__)
img = cv2.imread(r"C:\Users\sawar\MyProjects\student-report\server\uploads\omr\6c79b37c3d599c096b6f134584cbf22d")
if img is None:
    print("Failed")
else:
    print("Success", img.shape)
