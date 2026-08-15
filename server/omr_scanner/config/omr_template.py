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


t1_mcq_y = [405, 433, 461, 489, 517, 563, 591, 619, 647, 675, 721, 749, 777, 805, 833, 879, 907, 935, 963, 991, 1037, 1065, 1093, 1121, 1149]

T1_TEMPLATE = TemplateConfig(
    name="T1",
    roi_size=18,
    fill_threshold=35.0,
    target_width=903,
    target_height=1412,
    roll_no_config={
        "cols": 5,
        "rows": 10,
        "x_coords": [60, 86, 112, 138, 164],
        "y_coords": [145 + r * 20 for r in range(10)]
    },
    roll_fill_threshold=55.0,
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
    answer_key={} # No key defined for T1 yet
)


t2_mcq_y = [380 + r * 22 for r in range(20)]
t2_num_y = [910, 1008, 1106, 1204, 1302]

T2_TEMPLATE = TemplateConfig(
    name="T2",
    roi_size=18,
    fill_threshold=35.0,
    numerical_fill_threshold=35.0,
    target_width=903,
    target_height=1412,
    roll_no_config={
        "cols": 5,
        "rows": 10,
        "x_coords": [60, 86, 112, 138, 164],
        "y_coords": [145 + r * 20 for r in range(10)]
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
            "x_coords": [70, 94, 119, 144, 168, 192, 217, 242, 266, 290],
            "y_coords": t2_num_y,
            "row_offsets": [0.0, 17.5, 35.0, 52.5]
        },
        {
            "name": "CHEMISTRY NUMERICAL",
            "type": "numerical",
            "start_q": 46,
            "num_q": 5,
            "options": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
            "x_coords": [340, 365, 390, 414, 438, 463, 488, 512, 536, 561],
            "y_coords": t2_num_y,
            "row_offsets": [0.0, 17.5, 35.0, 52.5]
        },
        {
            "name": "MATH NUMERICAL",
            "type": "numerical",
            "start_q": 71,
            "num_q": 5,
            "options": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
            "x_coords": [611, 636, 660, 684, 709, 734, 758, 782, 807, 832],
            "y_coords": t2_num_y,
            "row_offsets": [0.0, 17.5, 35.0, 52.5]
        }
    ],
    answer_key={} # No key defined to avoid reference table mismatch, detection only
)

t6_y_coords = [410, 429, 449, 468, 488, 507, 527, 546, 566, 585, 605, 624, 644, 663, 683, 702, 722, 741, 761, 780, 800, 819, 839, 858, 878, 897, 917, 936, 956, 975, 995, 1014, 1034, 1053, 1073, 1092, 1112, 1131, 1151, 1170, 1190, 1209, 1229, 1248, 1268, 1287, 1307, 1326, 1346, 1365]

T6_TEMPLATE = TemplateConfig(
    name="T6",
    roi_size=18,
    fill_threshold=35.0,
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
t3_y_coords = [405, 426, 448, 470, 492, 514, 535, 557, 579, 601, 623, 644, 666, 688, 710, 732, 753, 775, 797, 819, 841, 862, 884, 906, 928, 950, 971, 993, 1015, 1037, 1059, 1080, 1102, 1124, 1146, 1168, 1189, 1211, 1233, 1255, 1277, 1298, 1320, 1342, 1364]

T3_TEMPLATE = TemplateConfig(
    name="T3",
    roi_size=18,
    fill_threshold=35.0,
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
t4_y_coords = [410, 435, 460, 485, 510, 548, 573, 598, 623, 648, 686, 711, 736, 761, 786, 824, 849, 874, 899, 924, 962, 987, 1012, 1037, 1062, 1100, 1125, 1150, 1175, 1200]

T4_TEMPLATE = TemplateConfig(
    name="T4",
    roi_size=18,
    fill_threshold=35.0,
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
            "x_coords": [139, 164, 189, 214],
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
            "x_coords": [688, 713, 738, 763],
            "y_coords": t4_y_coords
        }
    ]
)

# --- T5 (MHCET 200) ---
T5_TEMPLATE = TemplateConfig(
    name="T5",
    roi_size=18,
    fill_threshold=35.0,
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
t7_y_coords = [435, 462, 489, 516, 543, 587, 614, 641, 668, 695, 739, 766, 793, 820, 847, 891, 918, 945, 972, 999, 1043, 1070, 1097, 1124, 1151]

T7_TEMPLATE = TemplateConfig(
    name="T7",
    roi_size=18,
    fill_threshold=35.0,
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
            "x_coords": [206, 232, 258, 284],
            "y_coords": t7_y_coords
        },
        {
            "name": "SECTION 2 (26-50)",
            "type": "mcq",
            "start_q": 26,
            "num_q": 25,
            "options": ["A", "B", "C", "D"],
            "x_coords": [618, 644, 670, 696],
            "y_coords": t7_y_coords
        }
    ]
)
