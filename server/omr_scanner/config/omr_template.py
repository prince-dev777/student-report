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

t6_y_coords = [int(round(383.5 + i * 19.42857)) for i in range(50)]

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
    roll_fill_threshold=35.0,
    sections=[
        {
            "name": "PHYSICS",
            "start_q": 1,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [100, 120, 140, 160],
            "y_coords": t6_y_coords
        },
        {
            "name": "CHEMISTRY",
            "start_q": 51,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [314, 334, 354, 374],
            "y_coords": t6_y_coords
        },
        {
            "name": "BIOLOGY P1",
            "start_q": 101,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [527, 547, 567, 587],
            "y_coords": t6_y_coords
        },
        {
            "name": "BIOLOGY P2",
            "start_q": 151,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [740, 760, 780, 800],
            "y_coords": t6_y_coords
        }
    ]
)

# --- T3 (NEET 180) ---
t3_y_coords = [int(round(398.5 + i * 21.2727)) for i in range(45)]

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
    roll_fill_threshold=35.0,
    sections=[
        {
            "name": "PHYSICS",
            "type": "mcq",
            "start_q": 1,
            "num_q": 45,
            "options": ["A", "B", "C", "D"],
            "x_coords": [100, 120, 140, 160],
            "y_coords": t3_y_coords
        },
        {
            "name": "CHEMISTRY",
            "type": "mcq",
            "start_q": 46,
            "num_q": 45,
            "options": ["A", "B", "C", "D"],
            "x_coords": [314, 334, 354, 374],
            "y_coords": t3_y_coords
        },
        {
            "name": "BIOLOGY PART 1",
            "type": "mcq",
            "start_q": 91,
            "num_q": 45,
            "options": ["A", "B", "C", "D"],
            "x_coords": [527, 547, 567, 587],
            "y_coords": t3_y_coords
        },
        {
            "name": "BIOLOGY PART 2",
            "type": "mcq",
            "start_q": 136,
            "num_q": 45,
            "options": ["A", "B", "C", "D"],
            "x_coords": [740, 761, 780, 800],
            "y_coords": t3_y_coords
        }
    ]
)

# --- T4 (NEET 90) ---
t4_y_coords = [381, 407, 432, 457, 483, 521, 546, 571, 596, 622, 658, 685, 709, 733, 758, 797, 822, 847, 872, 897, 935, 960, 985, 1011, 1036, 1073, 1099, 1124, 1149, 1174]

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
    roll_fill_threshold=35.0,
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
    roll_fill_threshold=35.0,
    sections=[
        {
            "name": "PHYSICS",
            "type": "mcq",
            "start_q": 1,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [100, 120, 140, 160],
            "y_coords": t6_y_coords
        },
        {
            "name": "CHEMISTRY",
            "type": "mcq",
            "start_q": 51,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [314, 334, 354, 374],
            "y_coords": t6_y_coords
        },
        {
            "name": "MATHEMATICS",
            "type": "mcq",
            "start_q": 101,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [527, 547, 567, 587],
            "y_coords": t6_y_coords
        },
        {
            "name": "BIOLOGY",
            "type": "mcq",
            "start_q": 151,
            "num_q": 50,
            "options": ["A", "B", "C", "D"],
            "x_coords": [740, 760, 780, 800],
            "y_coords": t6_y_coords
        }
    ]
)

# --- T7 (OMR 50) ---
t7_y_coords = [405, 433, 460, 487, 514, 559, 586, 613, 640, 667, 711, 738, 765, 793, 820, 864, 891, 918, 945, 973, 1017, 1044, 1071, 1098, 1125]

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
    roll_fill_threshold=35.0,
    sections=[
        {
            "name": "SECTION 1 (1-25)",
            "type": "mcq",
            "start_q": 1,
            "num_q": 25,
            "options": ["A", "B", "C", "D"],
            "x_coords": [197, 223, 250, 276],
            "y_coords": t7_y_coords
        },
        {
            "name": "SECTION 2 (26-50)",
            "type": "mcq",
            "start_q": 26,
            "num_q": 25,
            "options": ["A", "B", "C", "D"],
            "x_coords": [623, 649, 676, 702],
            "y_coords": t7_y_coords
        }
    ]
)
