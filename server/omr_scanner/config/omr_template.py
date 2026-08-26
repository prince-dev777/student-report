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
        self.roll_fill_threshold = roll_fill_threshold or fill_threshold
        self.numerical_fill_threshold = numerical_fill_threshold or fill_threshold


# Standard Roll Number Configuration across all templates
DEFAULT_ROLL_NO_CONFIG = {
    "cols": 5,
    "rows": 10,
    "x_coords": [60, 86, 112, 138, 164],
    "y_coords": [145 + r * 20 for r in range(10)]
}


# ==========================================
# --- T1 (JEE 75 MCQ) ---
# ==========================================
t1_mcq_y = [405, 433, 461, 489, 517, 563, 591, 619, 647, 675, 721, 749, 777, 805, 833, 879, 907, 935, 963, 991, 1037, 1065, 1093, 1121, 1149]

T1_TEMPLATE = TemplateConfig(
    name="T1",
    roi_size=18,
    fill_threshold=45.0,
    target_width=903,
    target_height=1412,
    roll_no_config=DEFAULT_ROLL_NO_CONFIG,
    roll_fill_threshold=35.0,
    sections=[
        {
            "name": "PHYSICS",
            "type": "mcq",
            "start_q": 1,
            "num_q": 25,
            "options": ["A", "B", "C", "D"],
            "x_coords": [128, 154, 180, 206],
            "y_coords": t1_mcq_y
        },
        {
            "name": "CHEMISTRY",
            "type": "mcq",
            "start_q": 26,
            "num_q": 25,
            "options": ["A", "B", "C", "D"],
            "x_coords": [412, 438, 464, 490],
            "y_coords": t1_mcq_y
        },
        {
            "name": "MATHEMATICS",
            "type": "mcq",
            "start_q": 51,
            "num_q": 25,
            "options": ["A", "B", "C", "D"],
            "x_coords": [697, 723, 749, 775],
            "y_coords": t1_mcq_y
        }
    ],
    answer_key={}
)


# ==========================================
# --- T2 (JEE 75 with Numerical) ---
# ==========================================
t2_mcq_y = [384 + r * 22 for r in range(20)]
t2_num_y = [917, 1014, 1114, 1209, 1305]
t2_num_row_offsets = [0.0, 17.3, 34.6, 51.9]

T2_TEMPLATE = TemplateConfig(
    name="T2",
    roi_size=18,
    fill_threshold=45.0,
    numerical_fill_threshold=55.0,
    target_width=903,
    target_height=1412,
    roll_no_config=DEFAULT_ROLL_NO_CONFIG,
    roll_fill_threshold=35.0,
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
            "x_coords": [412, 438, 464, 490],
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
            "x_coords": [70, 95, 119, 144, 168, 193, 217, 242, 267, 291],
            "y_coords": t2_num_y,
            "row_offsets": t2_num_row_offsets
        },
        {
            "name": "CHEMISTRY NUMERICAL",
            "type": "numerical",
            "start_q": 46,
            "num_q": 5,
            "options": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
            "x_coords": [341, 366, 390, 414, 439, 463, 488, 512, 537, 561],
            "y_coords": t2_num_y,
            "row_offsets": t2_num_row_offsets
        },
        {
            "name": "MATH NUMERICAL",
            "type": "numerical",
            "start_q": 71,
            "num_q": 5,
            "options": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
            "x_coords": [611, 636, 660, 685, 709, 734, 758, 783, 807, 831],
            "y_coords": t2_num_y,
            "row_offsets": t2_num_row_offsets
        }
    ],
    answer_key={}
)


# ==========================================
# --- T3 (NEET 180) ---
# ==========================================
t3_y_coords = [375, 397, 419, 440, 462, 484, 506, 528, 549, 571, 593, 615, 637, 658, 680, 702, 724, 746, 767, 789, 811, 833, 855, 876, 898, 920, 942, 964, 985, 1007, 1029, 1051, 1073, 1094, 1116, 1138, 1160, 1182, 1203, 1225, 1247, 1269, 1291, 1312, 1334]

T3_TEMPLATE = TemplateConfig(
    name="T3",
    roi_size=18,
    fill_threshold=32.0,
    target_width=903,
    target_height=1412,
    roll_no_config=DEFAULT_ROLL_NO_CONFIG,
    roll_fill_threshold=35.0,
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


# ==========================================
# --- T4 (NEET 90) ---
# ==========================================
t4_y_coords = [380, 405, 430, 455, 480, 518, 543, 568, 593, 618, 656, 681, 706, 731, 756, 794, 819, 844, 869, 894, 932, 957, 982, 1007, 1032, 1070, 1095, 1120, 1145, 1170]

T4_TEMPLATE = TemplateConfig(
    name="T4",
    roi_size=18,
    fill_threshold=38.0,
    target_width=903,
    target_height=1412,
    roll_no_config=DEFAULT_ROLL_NO_CONFIG,
    roll_fill_threshold=35.0,
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


# ==========================================
# --- T5 (MHCET 200) ---
# ==========================================
t5_y_coords = [379, 399, 418, 438, 457, 477, 496, 516, 535, 555, 574, 594, 613, 633, 652, 672, 691, 711, 730, 750, 769, 789, 808, 827, 847, 866, 886, 905, 925, 944, 964, 983, 1003, 1022, 1042, 1062, 1082, 1100, 1120, 1139, 1159, 1178, 1198, 1217, 1237, 1256, 1276, 1295, 1315, 1334]

T5_TEMPLATE = TemplateConfig(
    name="T5",
    roi_size=18,
    fill_threshold=32.0,
    target_width=903,
    target_height=1412,
    roll_no_config=DEFAULT_ROLL_NO_CONFIG,
    roll_fill_threshold=35.0,
    sections=[
        {
            "name": "PHYSICS",
            "type": "mcq",
            "start_q": 1,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [102, 122, 142, 162],
            "y_coords": t5_y_coords
        },
        {
            "name": "CHEMISTRY",
            "type": "mcq",
            "start_q": 51,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [315, 335, 355, 375],
            "y_coords": t5_y_coords
        },
        {
            "name": "MATHEMATICS",
            "type": "mcq",
            "start_q": 101,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [528, 548, 568, 588],
            "y_coords": t5_y_coords
        },
        {
            "name": "BIOLOGY",
            "type": "mcq",
            "start_q": 151,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [741, 761, 781, 801],
            "y_coords": t5_y_coords
        }
    ]
)


# ==========================================
# --- T6 (MHCET 200 BIO) ---
# ==========================================
T6_TEMPLATE = TemplateConfig(
    name="T6",
    roi_size=18,
    fill_threshold=32.0,
    target_width=903,
    target_height=1412,
    roll_no_config=DEFAULT_ROLL_NO_CONFIG,
    roll_fill_threshold=35.0,
    sections=[
        {
            "name": "PHYSICS",
            "type": "mcq",
            "start_q": 1,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [102, 122, 142, 162],
            "y_coords": t5_y_coords
        },
        {
            "name": "CHEMISTRY",
            "type": "mcq",
            "start_q": 51,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [315, 335, 355, 375],
            "y_coords": t5_y_coords
        },
        {
            "name": "BIOLOGY P1",
            "type": "mcq",
            "start_q": 101,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [528, 548, 568, 588],
            "y_coords": t5_y_coords
        },
        {
            "name": "BIOLOGY P2",
            "type": "mcq",
            "start_q": 151,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [741, 761, 781, 801],
            "y_coords": t5_y_coords
        }
    ]
)


# ==========================================
# --- T7 (OMR 50) ---
# ==========================================
t7_y_coords = [405, 432, 459, 486, 513, 557, 584, 611, 638, 665, 709, 736, 763, 790, 817, 861, 888, 915, 942, 969, 1013, 1040, 1067, 1094, 1121]

T7_TEMPLATE = TemplateConfig(
    name="T7",
    roi_size=18,
    fill_threshold=40.0,
    target_width=903,
    target_height=1412,
    roll_no_config=DEFAULT_ROLL_NO_CONFIG,
    roll_fill_threshold=35.0,
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
