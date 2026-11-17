from app.scripts.evaluate_scanner import evaluate, load_foods
from app.services.embedding_service import generate_embedding
from app.services.meal_parser import (
    FoodMatcher,
    grams_for,
    parse_segment,
    parse_serving,
    split_meal,
)


def test_embeddings_are_deterministic():
    # Regression: hash() is salted per process, which broke stored-vs-query similarity.
    assert generate_embedding("chicken adobo") == generate_embedding("chicken adobo")


def test_split_meal_on_connectors():
    parts = [seg for _, seg in split_meal("adobo with 1 cup rice and egg, banana")]
    assert parts == ["adobo", "1 cup rice", "egg", "banana"]


def test_parse_segment_quantities():
    seg = parse_segment("1 cup garlic rice")
    assert (seg.qty, seg.unit, seg.food_text) == (1.0, "cup", "garlic rice")

    seg = parse_segment("200g grilled chicken")
    assert (seg.qty, seg.unit, seg.food_text) == (200.0, "g", "grilled chicken")

    seg = parse_segment("half cup rice")
    assert (seg.qty, seg.unit, seg.food_text) == (0.5, "cup", "rice")

    seg = parse_segment("a boiled egg")
    assert (seg.qty, seg.unit, seg.food_text) == (1.0, None, "boiled egg")

    seg = parse_segment("chicken breast 150g")
    assert (seg.qty, seg.unit, seg.food_text) == (150.0, "g", "chicken breast")


def test_grams_use_food_serving_description():
    lumpia = parse_serving("3 pieces (90g)")
    assert grams_for(5, None, lumpia) == 150.0  # 5 rolls at 30 g each
    assert grams_for(None, None, lumpia) == 90.0  # no amount -> one serving
    rice = parse_serving("1 cup packed (158g)")
    assert grams_for(2, "cup", rice) == 316.0
    assert grams_for(120, "g", rice) == 120.0


def test_matcher_scales_portions_and_flags_unknown_food():
    matcher = FoodMatcher(load_foods(), embed=generate_embedding)
    items = matcher.match_meal("chicken adobo with 2 cups rice and atchara")
    names = [i.food.food_name if i.food else None for i in items]

    assert names[0] == "Adobong Manok (Chicken Adobo)"
    assert names[1] == "Cooked White Rice (Bigas Puti)"
    assert items[1].grams == 316.0
    # Atchara is not in the knowledge base: it must not be silently replaced.
    assert items[2].food is None and items[2].confidence == "none"
    assert items[2].macros()["calories"] == 0.0


def test_scanner_meets_evaluation_targets():
    # Quality gate for Requirement T5 on the bundled evaluation set.
    report = evaluate()
    assert report.meals >= 20
    # Graded on food family (same food, any variant). The exact-entry score is reported
    # by the evaluator but not gated: near-duplicate USDA variants make it label-sensitive.
    assert report.family_recall >= 0.85
    assert report.family_precision >= 0.85
    assert report.kcal_mape <= 15.0


def test_scanner_holdout_does_not_regress():
    # Held-out meals: expected foods were written from the tables before the scanner was
    # run on them. This is a regression floor, not a quality claim; calorie error on this
    # set is higher than on the tuned set and is only reported, not gated.
    from pathlib import Path

    from app.scripts.evaluate_scanner import DATA_DIR

    report = evaluate(eval_set=Path(DATA_DIR) / "scanner_holdout_set.csv")
    assert report.meals >= 30
    assert report.family_recall >= 0.80
    assert report.family_precision >= 0.80
