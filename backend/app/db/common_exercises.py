"""Built-in exercise library shown to every user (status "approved", no owner).

Shared by the 003 migration (so production databases get it) and the demo seed script.
Each entry: (name, category, muscle_group, MET value).
"""

COMMON_EXERCISES = [
    # Chest
    ("Barbell Bench Press", "compound", "chest", 6.0),
    ("Incline Dumbbell Press", "compound", "chest", 5.5),
    ("Dumbbell Bench Press", "compound", "chest", 5.5),
    ("Push-Ups", "compound", "chest", 3.8),
    ("Cable Chest Fly", "isolation", "chest", 4.0),
    ("Chest Dips", "compound", "chest", 5.0),
    # Back
    ("Conventional Deadlift", "compound", "back", 8.0),
    ("Pull-Ups", "compound", "back", 6.0),
    ("Weighted Pull-Ups", "compound", "back", 6.5),
    ("Lat Pulldown", "compound", "back", 5.0),
    ("Barbell Bent-Over Row", "compound", "back", 6.0),
    ("Seated Cable Row", "compound", "back", 5.0),
    ("One-Arm Dumbbell Row", "compound", "back", 5.0),
    # Legs
    ("Barbell Back Squat", "compound", "legs", 7.5),
    ("Leg Press", "compound", "legs", 6.0),
    ("Romanian Deadlift", "compound", "legs", 6.5),
    ("Walking Lunges", "compound", "legs", 6.0),
    ("Bulgarian Split Squat", "compound", "legs", 6.0),
    ("Leg Extension", "isolation", "legs", 4.0),
    ("Lying Leg Curl", "isolation", "legs", 4.0),
    ("Standing Calf Raise", "isolation", "legs", 3.5),
    ("Hip Thrust", "compound", "legs", 5.5),
    # Shoulders
    ("Overhead Barbell Press", "compound", "shoulders", 5.5),
    ("Seated Dumbbell Shoulder Press", "compound", "shoulders", 5.0),
    ("Dumbbell Lateral Raises", "isolation", "shoulders", 4.0),
    ("Face Pulls", "isolation", "shoulders", 3.5),
    # Arms
    ("Barbell Bicep Curl", "isolation", "arms", 4.5),
    ("Incline Dumbbell Bicep Curls", "isolation", "arms", 4.5),
    ("Hammer Curls", "isolation", "arms", 4.5),
    ("Tricep Rope Pushdowns", "isolation", "arms", 4.5),
    ("Overhead Tricep Extension", "isolation", "arms", 4.5),
    # Core
    ("Plank", "isolation", "core", 3.5),
    ("Hanging Leg Raises", "isolation", "core", 4.0),
    ("Cable Woodchoppers", "isolation", "core", 4.0),
    ("Crunches", "isolation", "core", 3.5),
]
