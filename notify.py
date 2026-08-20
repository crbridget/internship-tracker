"""
Email digest of newly discovered internships.

Sends over Gmail SMTP using nothing but the standard library, so the GitHub
Actions cron can do this on requirements-poll.txt alone — no torch, no mail SDK.

Configured entirely through environment variables. When they're absent this
no-ops and says so rather than raising, so local poll runs behave exactly as
they did before mail existed.

  GMAIL_USER          the sending address
  GMAIL_APP_PASSWORD  a Google App Password, not the account password
  NOTIFY_TO           recipient(s), comma-separated; defaults to GMAIL_USER
  NOTIFY_ROLES        roles to watch, comma-separated. Unset means notify on
                      every new internship.
"""

import html
import os
import smtplib

import internship_filter
from email.message import EmailMessage

SMTP_HOST = 'smtp.gmail.com'
SMTP_PORT = 465  # implicit TLS

# A newly added company can dump its whole board into one digest. Cap it so the
# email stays readable and well short of Gmail's message size limits.
MAX_ITEMS = 50


def _config():
    """(user, password, recipients) or None when mail isn't configured."""
    user = os.environ.get('GMAIL_USER')
    password = os.environ.get('GMAIL_APP_PASSWORD')
    to = os.environ.get('NOTIFY_TO') or user

    if not user or not password or not to:
        return None

    recipients = [addr.strip() for addr in to.split(',') if addr.strip()]
    return user, password, recipients


def _describe(posting):
    """company · location, skipping whichever pieces are missing."""
    parts = [posting.get('company_name'), posting.get('location')]
    return ' · '.join(p for p in parts if p)


def _plain_body(postings, hidden):
    lines = []
    for posting in postings:
        lines.append(posting['title'])
        detail = _describe(posting)
        if detail:
            lines.append(f'  {detail}')
        if posting.get('apply_url'):
            lines.append(f"  {posting['apply_url']}")
        lines.append('')
    if hidden:
        lines.append(f'...and {hidden} more.')
    return '\n'.join(lines)


def _html_body(postings, hidden):
    items = []
    for posting in postings:
        # Titles and locations come from third-party job boards — escape them.
        title = html.escape(posting['title'])
        url = html.escape(posting.get('apply_url') or '', quote=True)
        detail = html.escape(_describe(posting))
        link = (
            f'<a href="{url}" style="color:#b74e03;text-decoration:none">{title}</a>'
            if url else title
        )
        items.append(
            '<li style="margin-bottom:14px">'
            f'<div style="font-weight:600;font-size:15px">{link}</div>'
            f'<div style="color:#75594a;font-size:13px">{detail}</div>'
            '</li>'
        )

    more = f'<p style="color:#75594a;font-size:13px">...and {hidden} more.</p>' if hidden else ''
    return (
        '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;'
        'color:#432616">'
        '<ul style="list-style:none;padding:0">'
        + ''.join(items) +
        '</ul>'
        + more +
        '</div>'
    )


def send_new_internships(postings):
    """
    Email a digest of new internship postings. Returns True only if mail was sent.

    Each posting needs title and apply_url; company_name and location are used
    when present.
    """
    if not postings:
        print('notify: no new internships, nothing to send')
        return False

    roles = internship_filter.parse_roles(os.environ.get('NOTIFY_ROLES'))
    if roles:
        matched = [p for p in postings if internship_filter.matches_any_role(p['title'], roles)]
        print(
            f'notify: {len(matched)}/{len(postings)} new internships match '
            f'NOTIFY_ROLES ({", ".join(roles)})'
        )
        postings = matched
        if not postings:
            return False
    else:
        print('notify: NOTIFY_ROLES is unset, so every new internship qualifies')

    count = len(postings)
    label = f"{count} new internship{'' if count == 1 else 's'}"

    config = _config()
    if config is None:
        print(
            f'notify: {label} found, but mail is not configured '
            '(set GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_TO) — skipping send'
        )
        return False

    user, password, recipients = config
    shown = postings[:MAX_ITEMS]
    hidden = len(postings) - len(shown)
    message = EmailMessage()
    message['Subject'] = label
    message['From'] = user
    message['To'] = ', '.join(recipients)
    message.set_content(_plain_body(shown, hidden))
    message.add_alternative(_html_body(shown, hidden), subtype='html')

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30) as smtp:
        smtp.login(user, password)
        smtp.send_message(message)

    print(f"notify: emailed {label} to {', '.join(recipients)}")
    return True
