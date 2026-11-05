import logging
import re
import sys


class SensitiveDataFilter(logging.Filter):
    """
    Sanitizes sensitive tokens, passwords, and authorization headers
    from logs to comply with Requirement B9 and OWASP Top 10.
    """
    PATTERNS = [
        (re.compile(r'(password[\'"]?\s*[:=]\s*[\'"]?)[^\'",\s]+([\'"]?)', re.IGNORECASE), r'\1***REDACTED***\2'),
        (re.compile(r'(token[\'"]?\s*[:=]\s*[\'"]?)[^\'",\s]+([\'"]?)', re.IGNORECASE), r'\1***REDACTED***\2'),
        (re.compile(r'(authorization[\'"]?\s*[:=]\s*[\'"]?Bearer\s+)[^\'",\s]+([\'"]?)', re.IGNORECASE), r'\1***REDACTED***\2'),
        (re.compile(r'(secret_key[\'"]?\s*[:=]\s*[\'"]?)[^\'",\s]+([\'"]?)', re.IGNORECASE), r'\1***REDACTED***\2'),
    ]

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            for pattern, repl in self.PATTERNS:
                record.msg = pattern.sub(repl, record.msg)
        return True


def setup_logging() -> logging.Logger:
    logger = logging.getLogger("nutrisync")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        handler.addFilter(SensitiveDataFilter())
        logger.addHandler(handler)

    return logger


logger = setup_logging()
