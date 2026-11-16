import hashlib
import re
from typing import List

import numpy as np

from app.core.config import settings
from app.core.logging import logger

_model = None


def _stable_hash(token: str) -> int:
    """Process-independent hash so embeddings are reproducible across restarts."""
    return int.from_bytes(hashlib.md5(token.encode("utf-8")).digest()[:8], "big")


_model_unavailable = False


def get_sentence_transformer_model():
    global _model, _model_unavailable
    if _model is not None:
        return _model
    if _model_unavailable:
        return None
    try:
        from sentence_transformers import SentenceTransformer

        logger.info(f"Loading local SentenceTransformer model: {settings.EMBEDDING_MODEL_NAME}")
        _model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
        return _model
    except Exception as e:
        logger.warning(
            f"SentenceTransformer not loaded ({e}). Using deterministic 384-d semantic embedding generator."
        )
        _model_unavailable = True
        return None


def generate_embedding(text: str) -> List[float]:
    """
    Generates a 384-dimensional normalized vector embedding for the given input text.
    Uses sentence-transformers if available, with a deterministic L2-normalized
    token hash projection as a resilient fallback.
    """
    model = get_sentence_transformer_model()
    if model:
        try:
            vector = model.encode(text, convert_to_numpy=True)
            norm = np.linalg.norm(vector)
            if norm > 0:
                vector = vector / norm
            return vector.tolist()
        except Exception as e:
            logger.error(f"Error encoding with SentenceTransformer: {e}")

    # Resilient Deterministic Semantic Projection (384-dim, unit normalized)
    dim = settings.EMBEDDING_DIMENSION
    vec = np.zeros(dim, dtype=np.float32)
    clean_text = text.lower().strip()
    words = re.findall(r"\b\w+\b", clean_text)

    if not words:
        words = [clean_text]

    for i, word in enumerate(words):
        # Hash character n-grams and whole word. A stable hash is required here:
        # Python's built-in hash() is salted per process (PYTHONHASHSEED), which made
        # seed-time and query-time vectors disagree and broke retrieval.
        idx = _stable_hash(word) % dim
        vec[idx] += 1.0 / (i + 1.0)

        # Character bigrams for subword similarity
        for j in range(len(word) - 1):
            bg_idx = _stable_hash(word[j : j + 2]) % dim
            vec[bg_idx] += 0.35

    # L2 normalize
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    else:
        vec[0] = 1.0

    return vec.tolist()


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    a = np.array(v1, dtype=np.float32)
    b = np.array(v2, dtype=np.float32)
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)
