import cv2

img = cv2.imread(r"C:\Users\sawar\MyProjects\student-report\server\warped_test_fixed.png")
crop_q = img[400:600, 150:400]
cv2.imwrite(r"C:\Users\sawar\.gemini\antigravity-ide\brain\7041d054-3264-44c3-b0ed-ce8c96976141\crop_questions.png", crop_q)
