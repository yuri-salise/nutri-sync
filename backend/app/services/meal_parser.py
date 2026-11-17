"""
Meal parsing and food matching for the Smart Meal Scanner.

Pipeline for a free-text meal such as "chicken adobo with 1 cup garlic rice and 2 eggs":

1. Split the description into food segments on connectors (with, and, at, commas, +).
2. Pull a quantity and unit off each segment ("1 cup", "200g", "2", "half").
3. Score every food in the knowledge base against the segment with a hybrid score:
   lexical token overlap (Filipino synonyms, light stemming) plus embedding cosine.
4. Merge a segment back into the previous one when it only adds detail to the same
   dish ("ginisang munggo with tinapa" stays one item).
5. Convert the quantity to grams using the food's own serving description, then
   scale the per-100 g macros.

Everything here is pure Python with no database access, so it can be unit tested and
evaluated offline (see app/scripts/evaluate_scanner.py).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Protocol, Sequence, Tuple

import numpy as np

# --------------------------------------------------------------------------- #
# Vocabulary
# --------------------------------------------------------------------------- #

STOPWORDS = {
    "a",
    "an",
    "the",
    "of",
    "with",
    "and",
    "at",
    "na",
    "ng",
    "sa",
    "some",
    "my",
    "w",
    "side",
    "plus",
    "for",
    "on",
    "in",
    "style",
    "ko",
}

# Words that describe preparation. They count for half in the query (so "steamed rice"
# still finds "Cooked White Rice") and are ignored when measuring name precision.
DESCRIPTORS = {
    "cooked",
    "raw",
    "fresh",
    "prepared",
    "commercially",
    "enriched",
    "plain",
    "traditional",
    "special",
    "regular",
    "whole",
    "large",
    "medium",
    "small",
    "steamed",
    "boiled",
    "grilled",
    "baked",
    "roasted",
    "fried",
    "sauteed",
    "homemade",
    "hot",
    "cold",
    "street",
    # Generic USDA qualifiers that say nothing about which food it is.
    "all",
    "commercial",
    "varieties",
    "variety",
    "types",
    "type",
    "average",
    "unspecified",
    "mixed",
    "species",
}

# Filipino -> English token synonyms, applied to both query and food names.
SYNONYMS = {
    "kanin": "rice",
    "bigas": "rice",
    "itlog": "egg",
    "manok": "chicken",
    "baboy": "pork",
    "baka": "beef",
    "isda": "fish",
    "hipon": "shrimp",
    "sugpo": "prawn",
    "gulay": "vegetable",
    "saging": "banana",
    "tinapay": "bread",
    "gatas": "milk",
    "kamote": "sweet",
    "inihaw": "grilled",
    "prito": "fried",
    "nilaga": "boiled",
    "laga": "boiled",
}

# Whole-phrase aliases for very common short inputs. The value is used as the search text.
PHRASE_ALIASES = {
    "rice": "cooked white rice bigas puti",
    "white rice": "cooked white rice bigas puti",
    "steamed rice": "cooked white rice bigas puti",
    "plain rice": "cooked white rice bigas puti",
    "kanin": "cooked white rice bigas puti",
    "garlic rice": "sinangag garlic fried rice",
    "fried rice": "sinangag garlic fried rice",
    "sinangag": "sinangag garlic fried rice",
    "brown rice": "cooked brown rice kayumanggi",
    "egg": "hard-boiled egg itlog na laga",
    "boiled egg": "hard-boiled egg itlog na laga",
    "hard boiled egg": "hard-boiled egg itlog na laga",
    "fried egg": "egg whole fried",
    "sunny side up": "egg whole fried",
    "sunny side up egg": "egg whole fried",
    "scrambled egg": "egg whole scrambled",
    "chicken breast": "chicken breast boneless skinless grilled",
    "fried chicken": "chicken breast fried batter",
    "banana": "banana fresh raw",
    "coke": "cola carbonated regular",
    "cola": "cola carbonated regular",
    "soda": "cola carbonated regular",
    "softdrink": "cola carbonated regular",
    "fries": "french fries",
    "oatmeal": "oats cereal regular quick",
    "pizza": "cheese pizza regular crust",
    "coffee": "coffee brewed black",
    "bread": "bread white commercially prepared",
    "milk": "milk whole",
    "adobo": "adobong manok chicken adobo",
}

NUMBER_WORDS = {
    "a": 1.0,
    "an": 1.0,
    "one": 1.0,
    "two": 2.0,
    "three": 3.0,
    "four": 4.0,
    "five": 5.0,
    "six": 6.0,
    "seven": 7.0,
    "eight": 8.0,
    "half": 0.5,
    "isang": 1.0,
    "dalawang": 2.0,
}

UNIT_ALIASES = {
    "g": "g",
    "gram": "g",
    "grams": "g",
    "gr": "g",
    "kg": "kg",
    "ml": "ml",
    "cup": "cup",
    "cups": "cup",
    "tasa": "cup",
    "bowl": "bowl",
    "bowls": "bowl",
    "plate": "plate",
    "plates": "plate",
    "piece": "piece",
    "pieces": "piece",
    "pc": "piece",
    "pcs": "piece",
    "slice": "slice",
    "slices": "slice",
    "tbsp": "tbsp",
    "tablespoon": "tbsp",
    "tablespoons": "tbsp",
    "tsp": "tsp",
    "teaspoon": "tsp",
    "teaspoons": "tsp",
    "serving": "serving",
    "servings": "serving",
    "order": "serving",
    "orders": "serving",
    "scoop": "scoop",
    "scoops": "scoop",
    "glass": "glass",
    "glasses": "glass",
    "can": "can",
    "cans": "can",
    "tin": "can",
    "stick": "stick",
    "sticks": "stick",
    "link": "link",
    "links": "link",
    "mug": "mug",
    "mugs": "mug",
    "handful": "handful",
    "handfuls": "handful",
    "oz": "oz",
    "ounce": "oz",
    "ounces": "oz",
    "lb": "lb",
    "lbs": "lb",
    "pound": "lb",
    "pounds": "lb",
}

# Units that only appear in food serving descriptions ("1 fl oz", "1 quart"), never in
# what a user types. Knowing them stops those servings being mistaken for "1 medium"-style
# count servings.
SERVING_ONLY_UNITS = {
    "fl": "floz",
    "fluid": "floz",
    "quart": "quart",
    "pint": "pint",
    "gallon": "gallon",
    "pat": "pat",
    "dash": "dash",
    "pinch": "pinch",
    "drop": "drop",
    "cubic": "cubic",
    "nlea": "serving",
}

# Fallback gram weights when the user's unit differs from the food's serving unit.
GENERIC_UNIT_GRAMS = {
    "cup": 150.0,
    "bowl": 250.0,
    "plate": 300.0,
    "slice": 30.0,
    "tbsp": 15.0,
    "tsp": 5.0,
    "glass": 240.0,
    "can": 355.0,
    "mug": 240.0,
    "scoop": 30.0,
    "stick": 45.0,
    "link": 40.0,
    "handful": 30.0,
    "oz": 28.35,
    "lb": 453.6,
}

_UNIT_PATTERN = "|".join(sorted(UNIT_ALIASES, key=len, reverse=True))
_NUM_PATTERN = r"\d+(?:\.\d+)?|\d+/\d+|(?:" + "|".join(NUMBER_WORDS) + r")\b"
_LEADING_QTY = re.compile(
    rf"^(?P<num>{_NUM_PATTERN})\s*(?:(?P<unit>{_UNIT_PATTERN})\b)?\s*(?:of\s+)?",
    re.IGNORECASE,
)
_TRAILING_QTY = re.compile(r"\s*(?P<num>\d+(?:\.\d+)?)\s*(?P<unit>g|grams|kg|ml)\s*$", re.I)
_SPLIT = re.compile(r"\s*(,|;|\+|&|\bwith\b|\band\b|\bw/|\bplus\b|\bat\b|\bsaka\b)\s*", re.I)

HIGH_CONFIDENCE = 0.60
LOW_CONFIDENCE = 0.40

# USDA names lead with the food itself ("Apples, raw, ..." vs "Strudel, apple"). A name
# whose first part is fully covered by the query is a better candidate. There is no
# matching penalty: category heads such as "Fish, salmon, ..." would be punished unfairly.
HEAD_BONUS = 0.10

# Source boilerplate that carries no food identity, e.g. "(Includes foods for USDA's ...)".
_BOILERPLATE = re.compile(r"\s*\((?:includes?|may contain)[^)]*\)", re.IGNORECASE)


# --------------------------------------------------------------------------- #
# Data shapes
# --------------------------------------------------------------------------- #


class FoodLike(Protocol):
    id: int
    food_name: str
    source_dataset: str
    kcal_per_100g: float
    protein_per_100g: float
    carbs_per_100g: float
    fat_per_100g: float
    serving_description: str


@dataclass
class Serving:
    qty: float
    unit: Optional[str]
    grams: float
    label: str = ""


@dataclass
class ParsedSegment:
    text: str  # original segment text
    food_text: str  # segment with quantity removed
    qty: Optional[float]
    unit: Optional[str]


@dataclass
class MatchedItem:
    query_text: str
    food: Optional[FoodLike]
    grams: float
    score: float
    confidence: str  # "high" | "low" | "none"
    alternatives: List[FoodLike] = field(default_factory=list)

    def macros(self) -> Dict[str, float]:
        if self.food is None or self.confidence == "none":
            return {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
        f = self.grams / 100.0
        return {
            "calories": round(self.food.kcal_per_100g * f, 1),
            "protein_g": round(self.food.protein_per_100g * f, 1),
            "carbs_g": round(self.food.carbs_per_100g * f, 1),
            "fat_g": round(self.food.fat_per_100g * f, 1),
        }


# --------------------------------------------------------------------------- #
# Parsing helpers
# --------------------------------------------------------------------------- #


def _to_number(raw: str) -> float:
    raw = raw.lower()
    if raw in NUMBER_WORDS:
        return NUMBER_WORDS[raw]
    if "/" in raw:
        a, b = raw.split("/", 1)
        return float(a) / float(b) if float(b) else 1.0
    return float(raw)


def _stem(tok: str) -> str:
    if len(tok) > 4 and tok.endswith("es") and tok[-3] in "osx":
        return tok[:-2]
    if len(tok) > 3 and tok.endswith("s") and not tok.endswith("ss"):
        return tok[:-1]
    return tok


def tokenize(text: str) -> List[str]:
    toks = []
    for raw in re.findall(r"[a-z0-9]+", text.lower()):
        if raw in STOPWORDS:
            continue
        tok = _stem(raw)
        toks.append(tok)
        if raw in SYNONYMS:
            toks.append(SYNONYMS[raw])
    return toks


def parse_serving(description: str) -> Serving:
    """'3 pieces (90g)' -> Serving(qty=3, unit='piece', grams=90)."""
    desc = (description or "").lower()
    grams_all = re.findall(r"\((\d+(?:\.\d+)?)\s*(?:g|ml)\)", desc)
    grams = float(grams_all[-1]) if grams_all else 100.0
    label = (description or "").strip()
    qty_m = re.match(r"^(\d+/\d+|\d+(?:\.\d+)?)\s+([a-z]+)", desc)
    if not qty_m:
        return Serving(qty=1.0, unit=None, grams=grams, label=label)
    qty = _to_number(qty_m.group(1)) or 1.0
    word = qty_m.group(2)
    unit = UNIT_ALIASES.get(word) or SERVING_ONLY_UNITS.get(word)
    if unit is None:
        # "1 large bowl with toppings": the size comes first, the unit noun after it.
        for later in re.findall(r"[a-z]+", desc.split("(")[0])[1:]:
            unit = UNIT_ALIASES.get(later) or SERVING_ONLY_UNITS.get(later)
            if unit:
                break
    return Serving(qty=qty, unit=unit, grams=grams, label=label)


def parse_servings(default_description: str, portions: Optional[str] = None) -> List[Serving]:
    """The default serving first, then every extra portion ("a | b | c"), without repeats."""
    servings = [parse_serving(default_description)]
    seen = {servings[0].label.lower()}
    for part in (portions or "").split("|"):
        part = part.strip()
        if part and part.lower() not in seen:
            seen.add(part.lower())
            servings.append(parse_serving(part))
    return servings


def pick_serving(qty: Optional[float], unit: Optional[str], servings: Sequence[Serving]) -> Serving:
    """Choose the portion that fits what the user typed.

    "1 cup rice" -> the cup portion; "an apple" -> the medium fruit portion;
    no amount -> the default portion (skipping a tiny first portion such as "1 grape").
    """
    default = servings[0]
    if default.grams < 10 and default.unit is None:
        # A tiny count portion ("1 grape", 6 g) is not a meal-sized default. Measured
        # units such as "1 pat" or "1 tsp" are kept: butter really is a few grams.
        default = next((s for s in servings if s.grams >= 30), default)
    if qty is None:
        # No amount ("a baked potato", "banana"): a medium piece beats half a cup.
        medium = [s for s in servings if s.unit is None and "medium" in s.label.lower()]
        return medium[0] if medium else default
    if unit in ("g", "kg", "ml", "serving"):
        return default
    if unit is None:
        counts = [s for s in servings if s.unit is None]
        medium = [s for s in counts if "medium" in s.label.lower()]
        return (medium or counts or [default])[0]
    same = [s for s in servings if s.unit == unit]
    if unit == "piece":
        same = same or [s for s in servings if s.unit is None]
    return (same or [default])[0]


def parse_segment(text: str) -> ParsedSegment:
    cleaned = text.strip().strip(".").strip()
    qty: Optional[float] = None
    unit: Optional[str] = None

    m = _LEADING_QTY.match(cleaned)
    if m and (m.group("unit") or m.end() < len(cleaned)):
        qty = _to_number(m.group("num"))
        unit = UNIT_ALIASES.get((m.group("unit") or "").lower())
        cleaned = cleaned[m.end() :]
        # "half cup", "a cup of" style: number word followed by a unit word
        m2 = re.match(rf"^(?P<unit>{_UNIT_PATTERN})\b\s*(?:of\s+)?", cleaned, re.I)
        if unit is None and m2:
            unit = UNIT_ALIASES[m2.group("unit").lower()]
            cleaned = cleaned[m2.end() :]
    else:
        t = _TRAILING_QTY.search(cleaned)
        if t:
            qty = float(t.group("num"))
            unit = UNIT_ALIASES[t.group("unit").lower()]
            cleaned = cleaned[: t.start()]

    return ParsedSegment(text=text.strip(), food_text=cleaned.strip(), qty=qty, unit=unit)


def split_meal(description: str) -> List[Tuple[str, str]]:
    """Returns [(connector_before, segment_text), ...]."""
    parts = _SPLIT.split(description.strip())
    out: List[Tuple[str, str]] = []
    connector = ""
    for i, part in enumerate(parts):
        if i % 2 == 1:
            connector = part
            continue
        if part.strip():
            out.append((connector, part.strip()))
        connector = ""
    return out


def grams_for_servings(
    qty: Optional[float], unit: Optional[str], servings: Sequence[Serving]
) -> float:
    return grams_for(qty, unit, pick_serving(qty, unit, servings))


def grams_for(qty: Optional[float], unit: Optional[str], serving: Serving) -> float:
    if unit == "g":
        return qty or 100.0
    if unit == "kg":
        return (qty or 1.0) * 1000.0
    if unit == "ml":
        return qty or 100.0
    if qty is None:
        return serving.grams  # no quantity given: one standard serving
    per_unit = serving.grams / (serving.qty or 1.0)
    if unit is None or unit == serving.unit or (unit == "piece" and serving.unit is None):
        return qty * per_unit
    if unit == "serving":
        return qty * serving.grams
    return qty * GENERIC_UNIT_GRAMS.get(unit, per_unit)


# --------------------------------------------------------------------------- #
# Scoring
# --------------------------------------------------------------------------- #


def _tok_match(a: str, b: str) -> bool:
    if a == b:
        return True
    short, long_ = (a, b) if len(a) <= len(b) else (b, a)
    return len(short) >= 4 and long_.startswith(short) and len(long_) - len(short) <= 3


def lexical_score(query_toks: Sequence[str], name_toks: Sequence[str]) -> float:
    if not query_toks or not name_toks:
        return 0.0
    q_weights = [0.5 if t in DESCRIPTORS else 1.0 for t in query_toks]
    matched_w = sum(
        w for t, w in zip(query_toks, q_weights) if any(_tok_match(t, n) for n in name_toks)
    )
    recall = matched_w / sum(q_weights)

    core_name = {n for n in name_toks if n not in DESCRIPTORS} or set(name_toks)
    matched_name = {n for n in core_name if any(_tok_match(n, q) for q in query_toks)}
    precision = len(matched_name) / len(core_name)
    return 0.75 * recall + 0.25 * precision


def _cosine(a: Sequence[float], b: Sequence[float]) -> float:
    va, vb = np.asarray(a, dtype=np.float32), np.asarray(b, dtype=np.float32)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    return float(va @ vb / denom) if denom else 0.0


class FoodMatcher:
    """Scores meal segments against a fixed list of foods."""

    LEXICAL_WEIGHT = 0.8
    SEMANTIC_WEIGHT = 0.2

    def __init__(
        self,
        foods: Sequence[FoodLike],
        embed: Optional[Callable[[str], List[float]]] = None,
    ):
        self.foods = list(foods)
        self.embed = embed
        self._name_toks = {f.id: tokenize(_BOILERPLATE.sub("", f.food_name)) for f in self.foods}
        self._head_toks = {
            f.id: [
                tok
                for tok in tokenize(re.split(r"[,(]", _BOILERPLATE.sub("", f.food_name))[0])
                if tok not in DESCRIPTORS
            ]
            for f in self.foods
        }
        self._servings = {
            f.id: parse_servings(f.serving_description, getattr(f, "portions", None))
            for f in self.foods
        }
        self._name_vecs: Dict[int, List[float]] = {}
        if embed:
            for f in self.foods:
                self._name_vecs[f.id] = embed(f.food_name)

        # Speed-up structures. A food that shares no word with the query has a lexical
        # score of 0, so it can score at most SEMANTIC_WEIGHT (0.2), below every
        # confidence/alternative cut-off. Ranking therefore only needs the foods that share
        # a word with the query, and all embedding similarities are computed in one batch.
        self._name_len = [len(f.food_name) for f in self.foods]
        self._token_index: Dict[str, List[int]] = {}
        for i, f in enumerate(self.foods):
            for tok in set(self._name_toks[f.id]):
                self._token_index.setdefault(tok, []).append(i)
        self._vocab = list(self._token_index)
        self._token_candidates: Dict[str, List[int]] = {}
        self._matrix: Optional[np.ndarray] = None
        if embed and self.foods:
            mat = np.asarray([self._name_vecs[f.id] for f in self.foods], dtype=np.float32)
            norms = np.linalg.norm(mat, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            self._matrix = mat / norms

    def _head_adjust(self, food_id: int, q_toks: Sequence[str], lex: float) -> float:
        head = self._head_toks[food_id]
        if not head:
            return lex
        if all(any(_tok_match(h, q) for q in q_toks) for h in head):
            return min(1.0, lex + HEAD_BONUS)
        return lex

    def _candidates_for_token(self, tok: str) -> List[int]:
        cached = self._token_candidates.get(tok)
        if cached is None:
            ids: set = set()
            for key in self._vocab:
                if _tok_match(tok, key):
                    ids.update(self._token_index[key])
            cached = sorted(ids)
            self._token_candidates[tok] = cached
        return cached

    def _candidates(self, q_toks: Sequence[str]) -> List[int]:
        ids: set = set()
        for tok in set(q_toks):
            ids.update(self._candidates_for_token(tok))
        return sorted(ids)

    def search_text(self, food_text: str) -> str:
        key = " ".join(re.findall(r"[a-z0-9]+", food_text.lower()))
        key = re.sub(r"\b(eggs)\b", "egg", key)
        return PHRASE_ALIASES.get(key, food_text)

    def rank(self, food_text: str) -> List[Tuple[FoodLike, float]]:
        text = self.search_text(food_text)
        q_toks = tokenize(text)
        candidates = self._candidates(q_toks)
        # No shared word: every lexical score is 0, so only the semantic part ranks them.
        indices = candidates or list(range(len(self.foods)))

        sem: Optional[np.ndarray] = None
        if self.embed is not None and self._matrix is not None:
            q = np.asarray(self.embed(text), dtype=np.float32)
            q_norm = float(np.linalg.norm(q))
            sims = self._matrix[indices] @ q / q_norm if q_norm else np.zeros(len(indices))
            sem = np.maximum(0.0, sims)

        ranked = []
        for pos, i in enumerate(indices):
            f = self.foods[i]
            score = lexical_score(q_toks, self._name_toks[f.id]) if candidates else 0.0
            if score > 0:
                score = self._head_adjust(f.id, q_toks, score)
            if sem is not None:
                score = self.LEXICAL_WEIGHT * score + self.SEMANTIC_WEIGHT * float(sem[pos])
            ranked.append((f, score))
        ranked.sort(key=lambda fs: (-fs[1], len(fs[0].food_name)))
        return ranked

    def servings(self, food: FoodLike) -> List[Serving]:
        return self._servings[food.id]

    @staticmethod
    def confidence(score: float) -> str:
        if score >= HIGH_CONFIDENCE:
            return "high"
        if score >= LOW_CONFIDENCE:
            return "low"
        return "none"

    def match_meal(self, description: str) -> List[MatchedItem]:
        groups: List[Dict] = []
        for connector, seg_text in split_meal(description):
            seg = parse_segment(seg_text)
            if not seg.food_text:
                continue
            ranked = self.rank(seg.food_text)
            best, best_score = ranked[0] if ranked else (None, 0.0)

            # Merge into the previous group when this segment just adds detail to the
            # same dish, e.g. "ginisang munggo with tinapa".
            if groups and connector and best is not None:
                prev = groups[-1]
                merged_text = f"{prev['seg'].food_text} {connector} {seg.food_text}"
                merged_rank = self.rank(merged_text)
                prev_best, prev_score = prev["ranked"][0] if prev["ranked"] else (None, 0.0)
                same_dish = (
                    prev_best is not None
                    and prev_score >= LOW_CONFIDENCE
                    and merged_rank[0][0].id == prev_best.id
                    and merged_rank[0][1] >= prev_score
                )
                adds_detail = (
                    best.id == getattr(prev_best, "id", None) or best_score < HIGH_CONFIDENCE
                )
                if same_dish and adds_detail and seg.qty is None:
                    prev["seg"] = ParsedSegment(
                        text=f"{prev['seg'].text} {connector} {seg.text}",
                        food_text=merged_text,
                        qty=prev["seg"].qty,
                        unit=prev["seg"].unit,
                    )
                    prev["ranked"] = merged_rank
                    continue
            groups.append({"seg": seg, "ranked": ranked})

        items: List[MatchedItem] = []
        for g in groups:
            seg, ranked = g["seg"], g["ranked"]
            if not ranked:
                continue
            food, score = ranked[0]
            conf = self.confidence(score)
            grams = (
                grams_for_servings(seg.qty, seg.unit, self.servings(food))
                if conf != "none"
                else 0.0
            )
            alternatives = [f for f, s in ranked[1:4] if s >= LOW_CONFIDENCE * 0.75]
            if conf == "none":
                # Nothing credible: offer the top candidates as suggestions only.
                alternatives = [f for f, s in ranked[:3] if s >= LOW_CONFIDENCE * 0.75]
            items.append(
                MatchedItem(
                    query_text=seg.text,
                    food=food if conf != "none" else None,
                    grams=round(grams, 1),
                    score=round(score, 4),
                    confidence=conf,
                    alternatives=alternatives,
                )
            )
        return items


def total_macros(items: Sequence[MatchedItem]) -> Dict[str, float]:
    totals = {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
    for item in items:
        for k, v in item.macros().items():
            totals[k] += v
    return {k: round(v, 1) for k, v in totals.items()}
