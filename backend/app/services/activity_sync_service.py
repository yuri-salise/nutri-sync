from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import NutritionLog, RunActivity, User, WorkoutSession


async def calculate_daily_activity_synced_summary(
    db: AsyncSession, user: User, target_date: datetime = None
) -> Dict[str, Any]:
    """
    Computes dynamic activity-synced macronutrient targets based on:
    1. Base goals (User.base_kcal_goal, protein_goal_g, etc.)
    2. Strength workout calories burned for the day
    3. GPS run calories burned for the day
    4. Nutrition logs consumed for the day
    """
    if target_date is None:
        target_date = datetime.now(timezone.utc)

    start_of_day = datetime(
        target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc
    )
    end_of_day = start_of_day + timedelta(days=1)

    # 1. Sum Workout Session calories burned today
    stmt_workouts = select(
        func.coalesce(func.sum(WorkoutSession.burned_kcal), 0.0),
        func.coalesce(func.sum(WorkoutSession.duration_min), 0),
    ).where(
        and_(
            WorkoutSession.user_id == user.id,
            WorkoutSession.session_date >= start_of_day,
            WorkoutSession.session_date < end_of_day,
        )
    )
    res_workouts = await db.execute(stmt_workouts)
    workout_burned_kcal, workout_total_min = res_workouts.one()

    # 2. Sum Run Activity calories burned today
    stmt_runs = select(
        func.coalesce(func.sum(RunActivity.burned_kcal), 0.0),
        func.coalesce(func.sum(RunActivity.distance_km), 0.0),
        func.coalesce(func.sum(RunActivity.duration_sec), 0),
    ).where(
        and_(
            RunActivity.user_id == user.id,
            RunActivity.recorded_at >= start_of_day,
            RunActivity.recorded_at < end_of_day,
        )
    )
    res_runs = await db.execute(stmt_runs)
    run_burned_kcal, run_total_km, run_total_sec = res_runs.one()

    total_activity_burned_kcal = round(float(workout_burned_kcal + run_burned_kcal), 1)

    # 3. Dynamic Macro Adjustment Formula
    # Glycogen replenishment: ~60% of burned active calories converted to Carbohydrates (4 kcal/g)
    # Muscle protein synthesis adjustment: +0.2g protein per kg of bodyweight if workout occurred
    additional_carbs_g = round((total_activity_burned_kcal * 0.60) / 4.0, 1)
    additional_protein_g = 20.0 if workout_burned_kcal > 0 else 0.0
    additional_fat_g = round((total_activity_burned_kcal * 0.15) / 9.0, 1)

    dynamic_kcal_goal = round(user.base_kcal_goal + total_activity_burned_kcal, 1)
    dynamic_protein_goal = round(user.protein_goal_g + additional_protein_g, 1)
    dynamic_carbs_goal = round(user.carbs_goal_g + additional_carbs_g, 1)
    dynamic_fat_goal = round(user.fat_goal_g + additional_fat_g, 1)

    # 4. Sum Consumed Nutrition today
    stmt_nutrition = select(
        func.coalesce(func.sum(NutritionLog.total_kcal), 0.0),
        func.coalesce(func.sum(NutritionLog.protein_g), 0.0),
        func.coalesce(func.sum(NutritionLog.carbs_g), 0.0),
        func.coalesce(func.sum(NutritionLog.fat_g), 0.0),
        func.count(NutritionLog.id),
    ).where(
        and_(
            NutritionLog.user_id == user.id,
            NutritionLog.logged_at >= start_of_day,
            NutritionLog.logged_at < end_of_day,
        )
    )
    res_nutri = await db.execute(stmt_nutrition)
    consumed_kcal, consumed_protein, consumed_carbs, consumed_fat, logged_meals_count = (
        res_nutri.one()
    )

    remaining_kcal = round(dynamic_kcal_goal - float(consumed_kcal), 1)
    remaining_protein = round(dynamic_protein_goal - float(consumed_protein), 1)
    remaining_carbs = round(dynamic_carbs_goal - float(consumed_carbs), 1)
    remaining_fat = round(dynamic_fat_goal - float(consumed_fat), 1)

    return {
        "date": start_of_day.isoformat(),
        "user_weight_kg": user.weight_kg,
        "base_goals": {
            "calories": user.base_kcal_goal,
            "protein_g": user.protein_goal_g,
            "carbs_g": user.carbs_goal_g,
            "fat_g": user.fat_goal_g,
        },
        "activity_burn": {
            "workout_burned_kcal": round(float(workout_burned_kcal), 1),
            "workout_minutes": int(workout_total_min),
            "run_burned_kcal": round(float(run_burned_kcal), 1),
            "run_distance_km": round(float(run_total_km), 2),
            "run_duration_min": round(float(run_total_sec) / 60.0, 1),
            "total_burned_kcal": total_activity_burned_kcal,
        },
        "dynamic_targets": {
            "calories": dynamic_kcal_goal,
            "protein_g": dynamic_protein_goal,
            "carbs_g": dynamic_carbs_goal,
            "fat_g": dynamic_fat_goal,
        },
        "consumed": {
            "calories": round(float(consumed_kcal), 1),
            "protein_g": round(float(consumed_protein), 1),
            "carbs_g": round(float(consumed_carbs), 1),
            "fat_g": round(float(consumed_fat), 1),
            "logged_meals_count": int(logged_meals_count),
        },
        "remaining": {
            "calories": remaining_kcal,
            "protein_g": remaining_protein,
            "carbs_g": remaining_carbs,
            "fat_g": remaining_fat,
        },
    }
