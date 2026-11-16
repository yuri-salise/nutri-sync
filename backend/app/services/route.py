"""GeoJSON route helpers for the community feed: parsing, privacy trimming, thinning.

Privacy (RA 10173): when someone else's activity is shown, the first and last
PRIVACY_RADIUS_M of the route are cut so the feed doesn't reveal a home or workplace.
"""

import json
import math
from typing import List, Optional

PRIVACY_RADIUS_M = 200.0
MAX_FEED_POINTS = 120

Point = List[float]  # [lat, lng]


def haversine_m(a: Point, b: Point) -> float:
    r = 6371008.8
    la1, la2 = math.radians(a[0]), math.radians(b[0])
    dlat, dlng = la2 - la1, math.radians(b[1] - a[1])
    h = math.sin(dlat / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def parse_route(geojson: Optional[str]) -> List[Point]:
    """GeoJSON LineString ([lng, lat] pairs) -> [[lat, lng], ...]. Bad input gives []."""
    if not geojson:
        return []
    try:
        data = json.loads(geojson)
        coords = data.get("coordinates", []) if isinstance(data, dict) else []
        points = []
        for c in coords:
            lng, lat = float(c[0]), float(c[1])
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                points.append([lat, lng])
        return points
    except (ValueError, TypeError, IndexError, KeyError):
        return []


def trim_ends(points: List[Point], radius_m: float = PRIVACY_RADIUS_M) -> List[Point]:
    """Drops the start and end of the route within radius_m of the true start/end."""
    if len(points) < 2:
        return []
    start, end = points[0], points[-1]
    first = 0
    while first < len(points) and haversine_m(start, points[first]) < radius_m:
        first += 1
    last = len(points) - 1
    while last > first and haversine_m(end, points[last]) < radius_m:
        last -= 1
    trimmed = points[first : last + 1]
    # Nothing meaningful left to show (very short route): hide it entirely.
    return trimmed if len(trimmed) >= 2 else []


def thin(points: List[Point], max_points: int = MAX_FEED_POINTS) -> List[Point]:
    if len(points) <= max_points:
        return points
    step = (len(points) - 1) / (max_points - 1)
    picked = [points[round(i * step)] for i in range(max_points)]
    return picked


def feed_route(geojson: Optional[str], hide_ends: bool) -> List[Point]:
    points = parse_route(geojson)
    if hide_ends:
        points = trim_ends(points)
    return thin(points)
