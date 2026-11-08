"""
Shapes of data crossing the API boundary.

Pydantic validates what arrives in request bodies, which nobody guarantees.
Database rows are not validated: Postgres already enforces their shape (the
status CHECK in migration 005 mirrors ApplicationStatus below).
"""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

ApplicationStatus = Literal['saved', 'applied', 'interviewing', 'offer', 'rejected']

# Whitespace-only counts as empty.
NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class RequestBody(BaseModel):
    """Base for request bodies: unknown fields are an error, not ignored."""
    model_config = ConfigDict(extra='forbid')


class AddCompanyRequest(RequestBody):
    """Body of POST /companies."""
    company_name: NonEmptyStr


class TargetsRequest(RequestBody):
    """Body of POST /targets: the roles to score postings against."""
    targets: list[NonEmptyStr] = Field(min_length=1)


class ApplicationUpdate(RequestBody):
    """
    Body of PUT /applications/<posting_id>.

    status is always required, so the same body can create a row. notes and
    applied_at are only changed when present: omitting notes keeps them, while
    sending null clears them.
    """
    status: ApplicationStatus
    notes: str | None = Field(default=None, max_length=10_000)
    applied_at: date | None = None


def error_message(err: ValidationError) -> str:
    """First validation error as one line, e.g. "status: Input should be ..."."""
    first = err.errors(include_url=False)[0]
    where = '.'.join(str(part) for part in first['loc'])
    return f"{where}: {first['msg']}" if where else first['msg']
