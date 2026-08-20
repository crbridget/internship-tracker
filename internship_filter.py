"""
Deciding whether a job title names an internship.

Single source of truth: the API, the CLI and the poller all call is_internship()
rather than keeping their own copy of the pattern.
"""

import re

INTERNSHIP_RE = re.compile(r'\b(intern|internship|co-?op)\b', re.IGNORECASE)


def is_internship(title):
    """True when the title names an internship or co-op."""
    return bool(INTERNSHIP_RE.search(title))


# Words carrying no signal in a role description.
_STOPWORDS = frozenset({'a', 'an', 'the', 'of', 'for', 'and', 'or', 'in', 'at', 'to'})

# Keeps +/# so 'c++' and 'c#' survive tokenising.
_WORD_RE = re.compile(r'[a-z0-9+#]+')


def _significant_words(text):
    return [w for w in _WORD_RE.findall(text.lower()) if w not in _STOPWORDS]


def matches_role(title, role):
    """
    True when every significant word in `role` appears in `title`.

    Word-order independent, so 'data analyst intern' matches both
    "Data Analyst Intern" and "Intern, Data Analyst". Each word is matched at a
    word boundary but without requiring the end of the word, so 'engineer' also
    matches "Engineering" and 'analyst' matches "Analysts".

    This is deliberately not the semantic scoring in score_relevance: that needs
    torch, and the notifier has to run on the cron's dependency-free install.
    """
    words = _significant_words(role)
    if not words:
        return False

    haystack = title.lower()
    return all(re.search(rf'\b{re.escape(word)}', haystack) for word in words)


def matches_any_role(title, roles):
    """True when the title matches at least one of `roles`. No roles means no match."""
    return any(matches_role(title, role) for role in roles)


def parse_roles(raw):
    """Split a comma-separated role list, dropping blanks."""
    if not raw:
        return []
    return [part.strip() for part in raw.split(',') if part.strip()]
