import json

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token, get_password_hash
from app.db.models import RunActivity, User, WorkoutSession, WorkoutSet
from app.services.activity_calories import estimate_burned_kcal
from app.services.route import feed_route, parse_route, thin, trim_ends

FEED = "/api/v1/community-feed"


def line(n: int, step_m: float = 25.0) -> str:
    """A straight route going north from (14.5, 121.0): n points, step_m metres apart."""
    deg = step_m / 111_320.0
    coords = [[121.0, 14.5 + i * deg] for i in range(n)]
    return json.dumps({"type": "LineString", "coordinates": coords})


@pytest.fixture
async def other_user(db_session, seed_test_users):
    db_session.add(
        User(
            id=3,
            email="other@example.com",
            password_hash=get_password_hash("Password123!"),
            full_name="Other Athlete",
            role="athlete",
        )
    )
    await db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(subject=3, role='athlete')}"}


@pytest.fixture
def me(athlete_token):
    return {"Authorization": f"Bearer {athlete_token}"}


@pytest.fixture
def admin(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.mark.asyncio
async def test_feed_requires_login(client: AsyncClient, seed_test_users):
    assert (await client.get(FEED)).status_code == 401
    assert (await client.post(f"{FEED}/posts", json={"body": "hi"})).status_code == 401


@pytest.mark.asyncio
async def test_post_flow_and_feed_shape(client: AsyncClient, seed_test_users, me):
    created = await client.post(f"{FEED}/posts", json={"body": "  New squat PR!  "}, headers=me)
    assert created.status_code == 201
    assert "Location" in created.headers
    body = created.json()
    assert body["type"] == "post" and body["text"] == "New squat PR!" and body["mine"] is True
    assert body["author"]["name"] == "Test Athlete"

    feed = await client.get(FEED, headers=me)
    assert feed.status_code == 200
    data = feed.json()
    assert data["data"][0]["key"] == f"post-{body['id']}"
    assert data["meta"]["total"] == 1

    # Blank and oversized posts are rejected
    assert (await client.post(f"{FEED}/posts", json={"body": "   "}, headers=me)).status_code in (
        400,
        422,
    )
    assert (
        await client.post(f"{FEED}/posts", json={"body": "x" * 1001}, headers=me)
    ).status_code in (400, 422)


@pytest.mark.asyncio
async def test_feed_mixes_types_filters_and_paginates(
    client: AsyncClient, db_session, seed_test_users, me
):
    db_session.add(
        WorkoutSession(id=1, user_id=1, split_title="Push", duration_min=50, is_public=True)
    )
    await db_session.flush()
    db_session.add(
        WorkoutSet(session_id=1, exercise_id=1, set_no=1, reps=5, weight_kg=100.0, is_pr=True)
    )
    db_session.add(
        WorkoutSession(id=2, user_id=2, split_title="Secret", duration_min=30, is_public=False)
    )
    db_session.add(
        RunActivity(
            id=1,
            user_id=1,
            sport_type="ride",
            surface_type="road",
            distance_km=20.0,
            duration_sec=3600,
            burned_kcal=500,
            is_public=True,
        )
    )
    await db_session.commit()
    await client.post(f"{FEED}/posts", json={"body": "hello"}, headers=me)

    feed = (await client.get(FEED, headers=me)).json()
    assert {i["type"] for i in feed["data"]} == {"workout", "run", "post"}
    # someone else's private workout never shows up
    assert all(i["title"] != "Secret" for i in feed["data"])
    assert feed["meta"]["total"] == 3

    workout = next(i for i in feed["data"] if i["type"] == "workout")
    assert workout["exercises"][0] == {
        "name": "Barbell Bench Press",
        "sets": 1,
        "reps": 5,
        "top_weight_kg": 100.0,
        "is_pr": True,
    }
    assert workout["prs_count"] == 1
    ride = next(i for i in feed["data"] if i["type"] == "run")
    assert ride["sport_type"] == "ride" and ride["title"] == "Ride"

    only_posts = (await client.get(f"{FEED}?activity_type=posts", headers=me)).json()
    assert [i["type"] for i in only_posts["data"]] == ["post"]
    assert (await client.get(f"{FEED}?activity_type=bogus", headers=me)).status_code in (400, 422)

    page1 = (await client.get(f"{FEED}?limit=2&page=1", headers=me)).json()
    page2 = (await client.get(f"{FEED}?limit=2&page=2", headers=me)).json()
    assert len(page1["data"]) == 2 and len(page2["data"]) == 1
    keys = [i["key"] for i in page1["data"] + page2["data"]]
    assert len(set(keys)) == 3  # no duplicates across pages
    assert page1["meta"]["total_pages"] == 2


@pytest.mark.asyncio
async def test_kudos_toggle_is_idempotent_and_per_user(
    client: AsyncClient, seed_test_users, me, other_user
):
    post_id = (await client.post(f"{FEED}/posts", json={"body": "kudos me"}, headers=me)).json()[
        "id"
    ]
    url = f"{FEED}/post/{post_id}/kudos"

    first = await client.put(url, headers=other_user)
    assert first.status_code == 200
    assert first.json() == {"kudos_count": 1, "kudos_by_me": True}
    again = await client.put(url, headers=other_user)  # repeating changes nothing
    assert again.json()["kudos_count"] == 1
    assert (await client.put(url, headers=me)).json()["kudos_count"] == 2

    item = (await client.get(FEED, headers=other_user)).json()["data"][0]
    assert item["kudos_count"] == 2 and item["kudos_by_me"] is True

    assert (await client.delete(url, headers=other_user)).status_code == 204
    item = (await client.get(FEED, headers=other_user)).json()["data"][0]
    assert item["kudos_count"] == 1 and item["kudos_by_me"] is False

    # unknown or missing targets
    assert (await client.put(f"{FEED}/post/999/kudos", headers=me)).status_code == 404
    assert (await client.put(f"{FEED}/banana/1/kudos", headers=me)).status_code == 404


@pytest.mark.asyncio
async def test_cannot_interact_with_private_items(
    client: AsyncClient, db_session, seed_test_users, other_user, me
):
    db_session.add(WorkoutSession(id=5, user_id=1, split_title="Mine", is_public=False))
    await db_session.commit()
    assert (await client.put(f"{FEED}/workout/5/kudos", headers=other_user)).status_code == 404
    assert (
        await client.post(f"{FEED}/workout/5/comments", json={"body": "hi"}, headers=other_user)
    ).status_code == 404
    assert (await client.get(f"{FEED}/workout/5/comments", headers=other_user)).status_code == 404
    # the owner can still see their own
    assert (await client.put(f"{FEED}/workout/5/kudos", headers=me)).status_code == 200


@pytest.mark.asyncio
async def test_comments_crud_and_permissions(
    client: AsyncClient, seed_test_users, me, other_user, admin
):
    post_id = (await client.post(f"{FEED}/posts", json={"body": "talk"}, headers=me)).json()["id"]
    base = f"{FEED}/post/{post_id}/comments"

    c1 = await client.post(base, json={"body": "first!"}, headers=other_user)
    assert c1.status_code == 201 and "Location" in c1.headers
    assert c1.json()["mine"] is True and c1.json()["author"]["name"] == "Other Athlete"
    c2 = await client.post(base, json={"body": "second"}, headers=me)

    assert (await client.post(base, json={"body": " "}, headers=me)).status_code in (400, 422)
    assert (await client.post(base, json={"body": "x" * 501}, headers=me)).status_code in (400, 422)

    listing = (await client.get(base, headers=me)).json()
    assert [c["body"] for c in listing["data"]] == ["first!", "second"]  # oldest first
    assert [c["mine"] for c in listing["data"]] == [False, True]
    assert (await client.get(FEED, headers=me)).json()["data"][0]["comments_count"] == 2

    # Only the author (or an admin) may delete
    cid = c1.json()["id"]
    assert (await client.delete(f"{FEED}/comments/{cid}", headers=me)).status_code == 403
    assert (await client.delete(f"{FEED}/comments/{cid}", headers=other_user)).status_code == 204
    assert (
        await client.delete(f"{FEED}/comments/{c2.json()['id']}", headers=admin)
    ).status_code == 204
    assert (await client.delete(f"{FEED}/comments/{cid}", headers=me)).status_code == 404


@pytest.mark.asyncio
async def test_deleting_a_post_removes_its_kudos_and_comments(
    client: AsyncClient, seed_test_users, me, other_user
):
    post_id = (await client.post(f"{FEED}/posts", json={"body": "bye"}, headers=me)).json()["id"]
    await client.put(f"{FEED}/post/{post_id}/kudos", headers=other_user)
    await client.post(f"{FEED}/post/{post_id}/comments", json={"body": "c"}, headers=other_user)

    assert (await client.delete(f"{FEED}/posts/{post_id}", headers=other_user)).status_code == 403
    assert (await client.delete(f"{FEED}/posts/{post_id}", headers=me)).status_code == 204
    assert (await client.get(FEED, headers=me)).json()["meta"]["total"] == 0
    assert (await client.get(f"{FEED}/post/{post_id}/comments", headers=me)).status_code == 404


@pytest.mark.asyncio
async def test_routes_hide_start_and_end_from_other_users(
    client: AsyncClient, db_session, seed_test_users, other_user, me
):
    db_session.add(
        RunActivity(
            user_id=1,
            sport_type="run",
            surface_type="road",
            distance_km=5.0,
            duration_sec=1800,
            burned_kcal=300,
            is_public=True,
            route_geojson=line(200),  # ~5 km
        )
    )
    await db_session.commit()

    mine = (await client.get(FEED, headers=me)).json()["data"][0]
    theirs = (await client.get(FEED, headers=other_user)).json()["data"][0]
    assert mine["route_hidden_ends"] is False and theirs["route_hidden_ends"] is True
    assert mine["route"][0][0] == pytest.approx(14.5, abs=1e-4)  # my own start is visible
    assert theirs["route"][0][0] > 14.5 + 190 / 111_320  # ~200 m cut from the start
    assert len(mine["route"]) <= 120


@pytest.mark.asyncio
async def test_run_activities_support_sport_types(client: AsyncClient, seed_test_users, me):
    ride = await client.post(
        "/api/v1/run-activities",
        json={
            "sport_type": "ride",
            "title": " Morning ride ",
            "distance_km": 30,
            "duration_sec": 4500,
        },
        headers=me,
    )
    assert ride.status_code == 201
    assert ride.json()["sport_type"] == "ride" and ride.json()["title"] == "Morning ride"
    assert ride.json()["burned_kcal"] > 0

    default = await client.post(
        "/api/v1/run-activities", json={"distance_km": 5, "duration_sec": 1800}, headers=me
    )
    assert default.json()["sport_type"] == "run"

    bad = await client.post(
        "/api/v1/run-activities",
        json={"sport_type": "swim", "distance_km": 1, "duration_sec": 600},
        headers=me,
    )
    assert bad.status_code in (400, 422)

    only_rides = await client.get("/api/v1/run-activities?sport_type=ride", headers=me)
    assert only_rides.json()["meta"]["total"] == 1


def test_calorie_estimates_differ_by_sport():
    w = 70.0
    run = estimate_burned_kcal("run", w, 10, 3000)
    walk = estimate_burned_kcal("walk", w, 10, 7200)
    slow_ride = estimate_burned_kcal("ride", w, 10, 2400)  # 15 km/h
    fast_ride = estimate_burned_kcal("ride", w, 25, 3000)  # 30 km/h
    assert run == pytest.approx(725.2, abs=0.1)  # 1.036 * 70 * 10
    assert walk == pytest.approx(371.0, abs=0.1)  # 0.53 * 70 * 10
    assert slow_ride == pytest.approx(317.3, abs=0.1)  # MET 6.8 for 2/3 h
    assert fast_ride > slow_ride
    assert estimate_burned_kcal("run", w, 10, 3000, surface="trail") > run
    assert estimate_burned_kcal("hike", w, 8, 7200, elevation_gain_m=400) > estimate_burned_kcal(
        "hike", w, 8, 7200
    )


def test_route_helpers():
    assert parse_route(None) == [] and parse_route("not json") == []
    assert parse_route('{"coordinates": [[121.0, 14.5], [999, 999]]}') == [[14.5, 121.0]]
    pts = parse_route(line(100, 25))
    trimmed = trim_ends(pts, 200)
    assert 0 < len(trimmed) < len(pts)
    assert trim_ends(parse_route(line(10, 25)), 200) == []  # ~225 m total: hidden entirely
    assert len(thin(pts, 20)) == 20 and thin(pts, 20)[0] == pts[0] and thin(pts, 20)[-1] == pts[-1]
    assert feed_route(None, hide_ends=True) == []
