from typing import Dict, List, Any

class TemplateConfig:
    def __init__(
        self,
        name: str,
        roi_size: int,
        fill_threshold: float,
        target_width: int,
        target_height: int,
        roll_no_config: Dict[str, Any],
        sections: List[Dict[str, Any]],
        answer_key: Dict[str, str] = None,
        roll_fill_threshold: float = None,
        numerical_fill_threshold: float = None
    ):
        self.name = name
        self.roi_size = roi_size
        self.fill_threshold = fill_threshold
        self.target_width = target_width
        self.target_height = target_height
        self.roll_no_config = roll_no_config
        self.sections = sections
        self.answer_key = answer_key or {}
        self.roll_fill_threshold = roll_fill_threshold
        self.numerical_fill_threshold = numerical_fill_threshold


# T1 Template configuration based on Phase 0 validation
T1_TEMPLATE = TemplateConfig(
    name="T1",
    roi_size=18,
    fill_threshold=65.0,
    target_width=1000,
    target_height=1400,
    roll_no_config={
        "cols": 4,
        "rows": 10,
        "x_coords": [66, 94, 123, 152],
        "y_coords": [126 + i * 20 for i in range(10)]
    },
    roll_fill_threshold=55.0,
    sections=[
        {
            "name": "Section 1",
            "start_q": 1,
            "num_q": 25,
            "options": ["A", "B", "C", "D"],
            "x_coords": [220, 249, 277, 306],
            "y_coords": [
                404, 431, 458, 485, 511,
                555, 582, 609, 636, 663,
                707, 734, 760, 787, 814,
                858, 885, 912, 938, 965,
                1009, 1036, 1063, 1090, 1117
            ]
        },
        {
            "name": "Section 2",
            "start_q": 26,
            "num_q": 25,
            "options": ["A", "B", "C", "D"],
            "x_coords": [693, 721, 750, 779],
            "y_coords": [
                404, 431, 458, 485, 511,
                555, 582, 609, 636, 663,
                707, 734, 760, 787, 814,
                858, 885, 912, 938, 965,
                1009, 1036, 1063, 1090, 1117
            ]
        }
    ],
    answer_key={} # No key defined for T1 yet
)

# T75 Template configuration for 75-question format
t75_answer_key = {}
for i in range(1, 26):
    t75_answer_key[str(i)] = "A"
for i in range(26, 51):
    t75_answer_key[str(i)] = "B"
for i in range(51, 76):
    t75_answer_key[str(i)] = "C"

T75_TEMPLATE = TemplateConfig(
    name="T75",
    roi_size=18,
    fill_threshold=65.0,
    target_width=1000,
    target_height=1600,
    roll_no_config={
        "cols": 5,
        "rows": 10,
        "x_coords": [66, 95, 124, 153, 182],
        "y_coords": [164, 187, 210, 232, 255, 278, 300, 323, 346, 368]
    },
    roll_fill_threshold=55.0,
    sections=[
        {
            "name": "Section 1",
            "start_q": 1,
            "num_q": 25,
            "options": ["A", "B", "C", "D"],
            "x_coords": [141, 170, 199, 228],
            "y_coords": [
                459, 491, 523, 554, 585, 
                638, 670, 702, 734, 765, 
                817, 850, 882, 914, 946, 
                998, 1029, 1060, 1092, 1125, 
                1177, 1209, 1241, 1273, 1305
            ]
        },
        {
            "name": "Section 2",
            "start_q": 26,
            "num_q": 25,
            "options": ["A", "B", "C", "D"],
            "x_coords": [458, 486, 514, 543],
            "y_coords": [
                459, 491, 523, 554, 585, 
                638, 670, 702, 734, 765, 
                817, 850, 882, 914, 946, 
                998, 1029, 1060, 1092, 1125, 
                1177, 1209, 1241, 1273, 1305
            ]
        },
        {
            "name": "Section 3",
            "start_q": 51,
            "num_q": 25,
            "options": ["A", "B", "C", "D"],
            "x_coords": [772, 801, 829, 858],
            "y_coords": [
                459, 491, 523, 554, 585, 
                638, 670, 702, 734, 765, 
                817, 850, 882, 914, 946, 
                998, 1029, 1060, 1092, 1125, 
                1177, 1209, 1241, 1273, 1305
            ]
        }
    ],
    answer_key=t75_answer_key
)

# T90 Template configuration for 90-question NEET format
t90_y_coords = [
    456, 486, 521, 552, 584, 617, 665, 696, 726, 756,
    792, 842, 873, 906, 936, 967, 1018, 1051, 1080, 1115,
    1146, 1194, 1224, 1256, 1290, 1321, 1368, 1401, 1434, 1464
]

T90_TEMPLATE = TemplateConfig(
    name="T90",
    roi_size=18,
    fill_threshold=65.0,
    target_width=1000,
    target_height=1800,
    roll_no_config={
        # Fallback to T1 style coordinates, user hasn't provided T90 specific roll constraints yet.
        "cols": 4,
        "rows": 10,
        "x_coords": [70, 100, 120, 150],
        "y_coords": [140 + i * 25 for i in range(10)]
    },
    roll_fill_threshold=55.0,
    sections=[
        {
            "name": "Section 1",
            "start_q": 1,
            "num_q": 30,
            "options": ["A", "B", "C", "D"],
            "x_coords": [144, 168, 192, 216],
            "y_coords": t90_y_coords
        },
        {
            "name": "Section 2",
            "start_q": 31,
            "num_q": 30,
            "options": ["A", "B", "C", "D"],
            "x_coords": [488, 512, 536, 560],
            "y_coords": t90_y_coords
        },
        {
            "name": "Section 3",
            "start_q": 61,
            "num_q": 30,
            "options": ["A", "B", "C", "D"],
            "x_coords": [782, 806, 830, 854],
            "y_coords": t90_y_coords
        }
    ],
    answer_key={} # No key defined to avoid reference table mismatch, detection only
)

t2_mcq_y = [350, 371, 391, 411, 432, 452, 472, 492, 513, 533, 553, 574, 594, 614, 634, 655, 675, 695, 716, 736]
t2_num_y = [839, 929, 1020, 1110, 1201]

T2_TEMPLATE = TemplateConfig(
    name="T2",
    roi_size=18,
    fill_threshold=65.0,
    numerical_fill_threshold=45.0,
    target_width=903,
    target_height=1302,
    roll_no_config={
        "cols": 5,
        "rows": 10,
        "x_coords": [60, 86, 112, 138, 164],
        "y_coords": [134, 152, 171, 189, 207, 226, 244, 263, 281, 300]
    },
    roll_fill_threshold=55.0,
    sections=[
        {
            "name": "PHYSICS MCQ",
            "type": "mcq",
            "start_q": 1,
            "num_q": 20,
            "options": ["A", "B", "C", "D"],
            "x_coords": [141, 167, 193, 219],
            "y_coords": t2_mcq_y
        },
        {
            "name": "CHEMISTRY MCQ",
            "type": "mcq",
            "start_q": 26,
            "num_q": 20,
            "options": ["A", "B", "C", "D"],
            "x_coords": [411, 437, 463, 489],
            "y_coords": t2_mcq_y
        },
        {
            "name": "MATH MCQ",
            "type": "mcq",
            "start_q": 51,
            "num_q": 20,
            "options": ["A", "B", "C", "D"],
            "x_coords": [682, 708, 734, 760],
            "y_coords": t2_mcq_y
        },
        {
            "name": "PHYSICS NUMERICAL",
            "type": "numerical",
            "start_q": 21,
            "num_q": 5,
            "options": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
            "x_coords": [70, 94, 119, 143, 168, 192, 217, 241, 266, 290],
            "y_coords": t2_num_y,
            "row_offsets": [0.0, 16.1, 32.3, 48.4]
        },
        {
            "name": "CHEMISTRY NUMERICAL",
            "type": "numerical",
            "start_q": 46,
            "num_q": 5,
            "options": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
            "x_coords": [340, 365, 389, 414, 438, 463, 487, 512, 536, 561],
            "y_coords": t2_num_y,
            "row_offsets": [0.0, 16.1, 32.3, 48.4]
        },
        {
            "name": "MATH NUMERICAL",
            "type": "numerical",
            "start_q": 71,
            "num_q": 5,
            "options": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
            "x_coords": [611, 635, 660, 684, 709, 733, 758, 782, 807, 831],
            "y_coords": t2_num_y,
            "row_offsets": [0.0, 16.1, 32.3, 48.4]
        }
    ],
    answer_key={} # No key defined to avoid reference table mismatch, detection only
)

t6_y_coords = [int(380.0 + r * 19.5) for r in range(50)]

T6_TEMPLATE = TemplateConfig(
    name="T6",
    roi_size=18,
    fill_threshold=65.0,
    target_width=903,
    target_height=1412,
    roll_no_config={
        "cols": 5,
        "rows": 10,
        "x_coords": [60, 86, 112, 138, 164],
        "y_coords": [int(145.0 + r * 20.0) for r in range(10)]
    },
    roll_fill_threshold=55.0,
    sections=[
        {
            "name": "PHYSICS",
            "start_q": 1,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [102, 122, 142, 162],
            "y_coords": t6_y_coords
        },
        {
            "name": "CHEMISTRY",
            "start_q": 51,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [315, 335, 355, 375],
            "y_coords": t6_y_coords
        },
        {
            "name": "BIOLOGY P1",
            "start_q": 101,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [528, 548, 568, 588],
            "y_coords": t6_y_coords
        },
        {
            "name": "BIOLOGY P2",
            "start_q": 151,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [741, 761, 781, 801],
            "y_coords": t6_y_coords
        }
    ]
)

# --- T3 (NEET 180) ---
t3_y_coords = [int(375.0 + r * 21.8) for r in range(45)]

T3_TEMPLATE = TemplateConfig(
    name="T3",
    roi_size=18,
    fill_threshold=65.0,
    target_width=903,
    target_height=1412,
    roll_no_config={
        "cols": 5,
        "rows": 10,
        "x_coords": [60, 86, 112, 138, 164],
        "y_coords": [int(145.0 + r * 20.0) for r in range(10)]
    },
    roll_fill_threshold=55.0,
    sections=[
        {
            "name": "PHYSICS",
            "type": "mcq",
            "start_q": 1,
            "num_q": 45,
            "options": ["A", "B", "C", "D"],
            "x_coords": [102, 122, 142, 162],
            "y_coords": t3_y_coords
        },
        {
            "name": "CHEMISTRY",
            "type": "mcq",
            "start_q": 46,
            "num_q": 45,
            "options": ["A", "B", "C", "D"],
            "x_coords": [315, 335, 355, 375],
            "y_coords": t3_y_coords
        },
        {
            "name": "BIOLOGY PART 1",
            "type": "mcq",
            "start_q": 91,
            "num_q": 45,
            "options": ["A", "B", "C", "D"],
            "x_coords": [528, 548, 568, 588],
            "y_coords": t3_y_coords
        },
        {
            "name": "BIOLOGY PART 2",
            "type": "mcq",
            "start_q": 136,
            "num_q": 45,
            "options": ["A", "B", "C", "D"],
            "x_coords": [741, 761, 781, 801],
            "y_coords": t3_y_coords
        }
    ]
)

# --- T4 (NEET 90) ---
t4_y_coords = []
y = 410.0
for block in range(6):
    for row in range(5):
        t4_y_coords.append(int(y - 30))
        y += 25.0
    y += 13.0 # block gap

T4_TEMPLATE = TemplateConfig(
    name="T4",
    roi_size=18,
    fill_threshold=65.0,
    target_width=903,
    target_height=1412,
    roll_no_config={
        "cols": 5,
        "rows": 10,
        "x_coords": [60, 86, 112, 138, 164],
        "y_coords": [int(145.0 + r * 20.0) for r in range(10)]
    },
    roll_fill_threshold=55.0,
    sections=[
        {
            "name": "BIOLOGY COL 1",
            "type": "mcq",
            "start_q": 1,
            "num_q": 30,
            "options": ["A", "B", "C", "D"],
            "x_coords": [130, 155, 180, 205],
            "y_coords": t4_y_coords
        },
        {
            "name": "BIOLOGY COL 2",
            "type": "mcq",
            "start_q": 31,
            "num_q": 30,
            "options": ["A", "B", "C", "D"],
            "x_coords": [414, 439, 464, 489],
            "y_coords": t4_y_coords
        },
        {
            "name": "BIOLOGY COL 3",
            "type": "mcq",
            "start_q": 61,
            "num_q": 30,
            "options": ["A", "B", "C", "D"],
            "x_coords": [698, 723, 748, 773],
            "y_coords": t4_y_coords
        }
    ]
)

# --- T5 (MHCET 200) ---
T5_TEMPLATE = TemplateConfig(
    name="T5",
    roi_size=18,
    fill_threshold=65.0,
    target_width=903,
    target_height=1412,
    roll_no_config={
        "cols": 5,
        "rows": 10,
        "x_coords": [60, 86, 112, 138, 164],
        "y_coords": [int(145.0 + r * 20.0) for r in range(10)]
    },
    roll_fill_threshold=55.0,
    sections=[
        {
            "name": "PHYSICS",
            "type": "mcq",
            "start_q": 1,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [102, 122, 142, 162],
            "y_coords": t6_y_coords
        },
        {
            "name": "CHEMISTRY",
            "type": "mcq",
            "start_q": 51,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [315, 335, 355, 375],
            "y_coords": t6_y_coords
        },
        {
            "name": "MATHEMATICS",
            "type": "mcq",
            "start_q": 101,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [528, 548, 568, 588],
            "y_coords": t6_y_coords
        },
        {
            "name": "BIOLOGY",
            "type": "mcq",
            "start_q": 151,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [741, 761, 781, 801],
            "y_coords": t6_y_coords
        }
    ]
)

# --- T7 (OMR 50) ---
t7_y_coords = []
y = 435.0
for block in range(5):
    for row in range(5):
        t7_y_coords.append(int(y - 30))
        y += 27.0
    y += 17.0 # block gap

T7_TEMPLATE = TemplateConfig(
    name="T7",
    roi_size=18,
    fill_threshold=65.0,
    target_width=903,
    target_height=1412,
    roll_no_config={
        "cols": 5,
        "rows": 10,
        "x_coords": [60, 86, 112, 138, 164],
        "y_coords": [int(145.0 + r * 20.0) for r in range(10)]
    },
    roll_fill_threshold=55.0,
    sections=[
        {
            "name": "SECTION 1 (1-25)",
            "type": "mcq",
            "start_q": 1,
            "num_q": 25,
            "options": ["A", "B", "C", "D"],
            "x_coords": [199, 225, 251, 277],
            "y_coords": t7_y_coords
        },
        {
            "name": "SECTION 2 (26-50)",
            "type": "mcq",
            "start_q": 26,
            "num_q": 25,
            "options": ["A", "B", "C", "D"],
            "x_coords": [626, 652, 678, 704],
            "y_coords": t7_y_coords
        }
    ]
)
