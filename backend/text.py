"""
Turn job-board description HTML into plain text for storage and embedding.

Standard library only: the poller imports this, and the poller stays light (see
requirements-poll.txt).
"""

import hashlib
import html
import re
from html.parser import HTMLParser


# Greenhouse wraps company-wide boilerplate in these classes. Identical across
# every posting at a company, so keeping them makes postings embed alike.
_BOILERPLATE_CLASSES = {
    'content-intro',
    'content-conclusion',
    'content-pay-transparency',
}

# Tags that start a new line, so paragraph structure survives for chunking.
_BLOCK_TAGS = {
    'p', 'div', 'br', 'li', 'ul', 'ol', 'tr', 'table', 'section',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'hr',
}

# Void elements never get an end tag, so they mustn't count toward skip depth.
_VOID_TAGS = {'br', 'hr', 'img', 'input', 'meta', 'link', 'wbr', 'col', 'area', 'source'}


class _TextExtractor(HTMLParser):
    def __init__(self, skip_classes):
        super().__init__(convert_charrefs=True)
        self.skip_classes = skip_classes
        self.parts = []
        # >0 while inside a boilerplate element: counts open tags since entering
        # it, so nested divs don't end the skip early.
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if self.skip_depth:
            if tag not in _VOID_TAGS:
                self.skip_depth += 1
            return

        classes = set((dict(attrs).get('class') or '').split())
        if classes & self.skip_classes and tag not in _VOID_TAGS:
            self.skip_depth = 1
            return

        if tag in _BLOCK_TAGS:
            self.parts.append('\n')
        if tag == 'li':
            self.parts.append('- ')

    def handle_startendtag(self, tag, attrs):
        # <br/> style: never opens a scope, just a line break.
        if not self.skip_depth and tag in _BLOCK_TAGS:
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if self.skip_depth:
            if tag not in _VOID_TAGS:
                self.skip_depth -= 1
            return
        if tag in _BLOCK_TAGS:
            self.parts.append('\n')

    def handle_data(self, data):
        if not self.skip_depth:
            self.parts.append(data)


def html_to_text(fragment, strip_boilerplate=True):
    """
    HTML fragment -> plain text, one block per line, boilerplate sections removed.

    Expects real HTML. Greenhouse's `content` is entity-escaped HTML, so callers
    unescape it first (see greenhouse_description).

    If stripping boilerplate leaves nothing, the boilerplate *was* the posting
    (some Klaviyo postings put everything inside content-intro), so the full
    text is returned instead.
    """
    if not fragment:
        return ''
    text = _extract(fragment, _BOILERPLATE_CLASSES if strip_boilerplate else set())
    if not text and strip_boilerplate:
        text = _extract(fragment, set())
    return text


def _extract(fragment, skip_classes):
    parser = _TextExtractor(skip_classes)
    parser.feed(fragment)
    parser.close()
    return _tidy(''.join(parser.parts))


def _tidy(text):
    text = text.replace('\xa0', ' ')
    lines = (re.sub(r'[ \t\r\f\v]+', ' ', line).strip() for line in text.split('\n'))
    # Drop empty lines and bare bullets left by empty <li>s.
    return '\n'.join(line for line in lines if line and line != '-')


def greenhouse_description(posting):
    """Greenhouse `content` is HTML escaped as entities: unescape, then strip."""
    return html_to_text(html.unescape(posting.get('content') or ''))


def lever_description(posting):
    """
    descriptionPlain + each list as a headed bullet block.

    descriptionPlain already contains openingPlain and descriptionBodyPlain
    (true for all 1,567 tracked postings), so those aren't added again. Lists
    must be included: 45 postings have an empty descriptionPlain and all their
    content is in lists. additionalPlain is skipped — it's typically identical
    per company (onsite policy, EEO).
    """
    # "Plain" isn't always: some boards (Paytm) leave entities like &amp; in it.
    sections = [_tidy(html.unescape(posting.get('descriptionPlain') or ''))]
    for lst in posting.get('lists') or []:
        heading = (lst.get('text') or '').strip()
        body = html_to_text(lst.get('content') or '')
        sections.append('\n'.join(part for part in (heading, body) if part))
    return '\n\n'.join(s for s in sections if s)


def description_hash(text):
    """Stable fingerprint of a cleaned description; None when there's no text."""
    if not text:
        return None
    return hashlib.sha256(text.encode('utf-8')).hexdigest()
