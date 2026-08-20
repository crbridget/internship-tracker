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
