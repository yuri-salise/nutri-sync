"""Calorie estimates for GPS activities (run, walk, ride, hike).

Estimates only: they use body weight, distance, time and climb, not heart rate.
Keep in sync with frontend/src/utils/activity.ts, which shows the same estimate live.
"""

SPORTS = ("run", "walk", "ride", "hike")


def _ride_met(speed_kmh: float) -> float:
    """Cycling MET by average speed (Compendium of Physical Activities)."""
    if speed_kmh < 16:
        return 6.8
    if speed_kmh < 20:
        return 8.0
    if speed_kmh < 25:
        return 10.0
    return 12.0


def estimate_burned_kcal(
    sport: str,
    weight_kg: float,
    distance_km: float,
    duration_sec: int,
    elevation_gain_m: float = 0.0,
    surface: str = "road",
) -> float:
    hours = max(duration_sec, 1) / 3600.0
    if sport == "walk":
        # ~0.53 kcal per kg per km on flat ground
        base = 0.53 * weight_kg * distance_km
    elif sport == "ride":
        speed = distance_km / hours
        base = _ride_met(speed) * weight_kg * hours
    elif sport == "hike":
        # Hiking is about MET 6 on mixed terrain
        base = 6.0 * weight_kg * hours
    else:  # run
        base = 1.036 * weight_kg * distance_km * (1.15 if surface == "trail" else 1.0)

    # Climbing: extra work against gravity (~0.05 kcal per metre gained, rides less so)
    climb_factor = 0.02 if sport == "ride" else 0.05
    return round(base + elevation_gain_m * climb_factor, 1)
