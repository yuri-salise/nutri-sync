import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select, text

BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.core.logging import logger
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.common_exercises import COMMON_EXERCISES
from app.db.models import Exercise, NutritionLog, RunActivity, User, WorkoutSession, WorkoutSet
from app.db.routine_models import WorkoutRoutine, WorkoutRoutineExercise
from app.db.session import AsyncSessionLocal, engine


async def seed_demo_data():
    # Ensure pgvector extension and table schema exist defensively
    async with engine.begin() as conn:
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        except Exception:
            pass
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        logger.info("Checking existing demo users...")
        res = await session.execute(select(User).where(User.email == "athlete@nutrisync.com"))
        if res.scalar_one_or_none():
            logger.info("Demo users already exist. Skipping seed_demo_data.")
            return

        # 1. Create Athlete and Admin Users
        athlete = User(
            email="athlete@nutrisync.com",
            password_hash=get_password_hash("Password123!"),
            full_name="Yuri Salise",
            role="athlete",
            weight_kg=72.5,
            base_kcal_goal=2350.0,
            protein_goal_g=160.0,
            carbs_goal_g=260.0,
            fat_goal_g=65.0,
        )
        admin = User(
            email="admin@nutrisync.com",
            password_hash=get_password_hash("Password123!"),
            full_name="Coach Rinante Buntod",
            role="admin",
            weight_kg=78.0,
            base_kcal_goal=2500.0,
            protein_goal_g=180.0,
            carbs_goal_g=280.0,
            fat_goal_g=70.0,
        )
        session.add_all([athlete, admin])
        await session.flush()

        # 2. Seed Standard Approved Exercise Catalog
        exercises_data = COMMON_EXERCISES
        created_exercises = []
        for name, cat, muscle, met in exercises_data:
            ex = Exercise(
                name=name,
                category=cat,
                muscle_group=muscle,
                met_value=met,
                status="approved",
                created_by_id=admin.id,
            )
            session.add(ex)
            created_exercises.append(ex)

        # Private custom exercise by athlete (no approval needed)
        pending_ex = Exercise(
            name="Bulgarian Split Squat with Chains",
            category="compound",
            muscle_group="legs",
            met_value=7.0,
            status="private",
            created_by_id=athlete.id,
        )
        session.add(pending_ex)
        await session.flush()

        # 3. Seed Sample Workout Session with Sets & PR
        today = datetime.now(timezone.utc)
        workout = WorkoutSession(
            user_id=athlete.id,
            split_title="Push Day A - Heavy Chest & Delts",
            duration_min=75,
            burned_kcal=485.0,
            is_public=True,
            session_date=today - timedelta(hours=4),
        )
        session.add(workout)
        await session.flush()

        by_name = {ex.name: ex for ex in created_exercises}
        bench_ex = by_name["Barbell Bench Press"]
        ohp_ex = by_name["Overhead Barbell Press"]

        sets = [
            WorkoutSet(
                session_id=workout.id,
                exercise_id=bench_ex.id,
                set_no=1,
                reps=10,
                weight_kg=80.0,
                is_pr=False,
            ),
            WorkoutSet(
                session_id=workout.id,
                exercise_id=bench_ex.id,
                set_no=2,
                reps=8,
                weight_kg=95.0,
                is_pr=False,
            ),
            WorkoutSet(
                session_id=workout.id,
                exercise_id=bench_ex.id,
                set_no=3,
                reps=5,
                weight_kg=105.0,
                is_pr=True,
                verified_by_id=admin.id,
            ),
            WorkoutSet(
                session_id=workout.id,
                exercise_id=ohp_ex.id,
                set_no=1,
                reps=8,
                weight_kg=50.0,
                is_pr=False,
            ),
            WorkoutSet(
                session_id=workout.id,
                exercise_id=ohp_ex.id,
                set_no=2,
                reps=6,
                weight_kg=60.0,
                is_pr=True,
                verified_by_id=None,
            ),
        ]
        session.add_all(sets)

        # 4. Seed Sample GPS Trail Run Activity (with Leaflet GeoJSON polyline)
        sample_geojson = {
            "type": "LineString",
            "coordinates": [
                [121.0500, 14.5500],
                [121.0515, 14.5512],
                [121.0530, 14.5535],
                [121.0560, 14.5560],
                [121.0585, 14.5585],
                [121.0620, 14.5610],
                [121.0645, 14.5630],
                [121.0670, 14.5665],
                [121.0690, 14.5690],
            ],
        }
        run = RunActivity(
            user_id=athlete.id,
            surface_type="trail",
            distance_km=6.85,
            duration_sec=2430,  # 40.5 minutes
            elevation_gain_m=145.0,
            burned_kcal=520.0,
            route_geojson=json.dumps(sample_geojson),
            is_public=True,
            recorded_at=today - timedelta(hours=10),
        )
        session.add(run)

        # 5. Seed Initial Nutrition Logs
        meal1 = NutritionLog(
            user_id=athlete.id,
            meal_name="Post-Workout: Chicken Inasal with Garlic Rice & Boiled Eggs",
            total_kcal=710.0,
            protein_g=58.0,
            carbs_g=72.0,
            fat_g=22.0,
            logged_at=today - timedelta(hours=3),
        )
        meal2 = NutritionLog(
            user_id=athlete.id,
            meal_name="Morning Fuel: Rolled Oats with Whey Isolate & Peanut Butter",
            total_kcal=560.0,
            protein_g=42.0,
            carbs_g=65.0,
            fat_g=14.0,
            logged_at=today - timedelta(hours=8),
        )
        session.add_all([meal1, meal2])

        # 6. Saved routine so the "start from a routine" flow has something to show
        push_day = WorkoutRoutine(
            user_id=athlete.id, name="Push Day", notes="Chest, shoulders, triceps"
        )
        push_day.exercises = [
            WorkoutRoutineExercise(
                exercise_id=by_name[n].id,
                position=i,
                target_sets=sets_,
                target_reps=reps,
                target_weight_kg=kg,
                rest_sec=rest,
            )
            for i, (n, sets_, reps, kg, rest) in enumerate(
                [
                    ("Barbell Bench Press", 4, 8, 80.0, 150),
                    ("Incline Dumbbell Press", 3, 10, 26.0, 90),
                    ("Overhead Barbell Press", 3, 8, 45.0, 120),
                    ("Dumbbell Lateral Raises", 3, 15, 10.0, 60),
                    ("Tricep Rope Pushdowns", 3, 12, 25.0, 60),
                ],
                start=1,
            )
        ]
        session.add(push_day)

        await session.commit()
        logger.info(
            "Demo accounts, exercises, workout sessions, run activities, and nutrition logs successfully seeded!"
        )


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
