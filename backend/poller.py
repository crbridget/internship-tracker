from . import db
from . import boards
from . import titles
from . import text
from datetime import datetime


def normalize_greenhouse_posting(posting):
    """Map a raw Greenhouse job dict to job_posting schema."""
    return {
        'external_job_id': str(posting['id']),
        'title': posting.get('title'),
        'location': posting.get('location', {}).get('name'),
        'apply_url': posting.get('absolute_url'),
        'first_published': posting.get('first_published'),
        'source_updated_at': posting.get('updated_at'),
        'status': 'open',
        'description': text.greenhouse_description(posting),
    }


def normalize_lever_posting(posting):
    """Map a raw Lever job dict to job_posting schema."""
    return {
        'external_job_id': str(posting['id']),
        'title': posting.get('text'),
        'location': posting.get('categories', {}).get('location'),
        'apply_url': posting.get('hostedUrl'),
        'first_published': None,  # lever doesn't provide this
        'source_updated_at': None,
        'status': 'open',
        'description': text.lever_description(posting),
    }


def poll_company(company):
    """
    Poll one company's board, upsert postings, detect closures, update status.

    Returns the internship postings seen here for the first time, for the email
    digest. Empty list when the check failed or nothing new turned up.
    """
    company_id = company['id']
    source_token = company['source_token']
    source = company['source']
    checked_at = datetime.now()

    # 1. Make the API call using the already-known source
    if source == 'greenhouse':
        raw_postings = boards.check_greenhouse(source_token, content=True)
        normalize_fn = normalize_greenhouse_posting
    elif source == 'lever':
        raw_postings = boards.check_lever(source_token)
        normalize_fn = normalize_lever_posting
    else:
        print(f"Unknown source for {company['company_name']}, skipping")
        return []

    # 2. Handle failure, increment consecutive_failures, mark inactive if 3 or more errors
    if raw_postings is None:
        new_failures = company.get('consecutive_failures', 0) + 1
        new_status = 'inactive' if new_failures >= 3 else 'active'
        db.update_company_status(source_token, new_status, new_failures, checked_at)
        print(f"{company['company_name']}: check failed ({new_failures} consecutive failures)")
        return []

    # 3. if success: reset failures, confirm active
    db.update_company_status(source_token, 'active', 0, checked_at)

    # 4. Get what's currently marked open in the database, for diffing
    existing_postings = db.get_existing_postings_for_company(company_id)
    existing_ids = {p['external_job_id'] for p in existing_postings}

    # 5. Upsert every posting from the fresh API response. Descriptions are
    #    only written when new or changed: they're ~6KB each, and rewriting all
    #    ~11k every 30 minutes would be ~60MB of identical writes per poll.
    known = db.get_known_postings(company_id)
    first_seen = {ext_id: k['first_seen_at'] for ext_id, k in known.items()}
    rows = []
    fresh_ids = set()
    for raw_posting in raw_postings:
        row = normalize_fn(raw_posting)
        row['company_id'] = company_id
        fresh_ids.add(row['external_job_id'])

        new_hash = text.description_hash(row['description'])
        stored = known.get(row['external_job_id'])
        if stored is not None and stored['description_hash'] == new_hash:
            del row['description']  # unchanged: leave the stored copy alone
        else:
            row['description_hash'] = new_hash
        rows.append(row)
    db.upsert_job_postings(rows, first_seen)

    # 6. Anything that was open before but missing now has closed
    closed_ids = existing_ids - fresh_ids
    db.close_postings(company_id, closed_ids)

    # 7. Anything absent from first_seen is new
    new_internships = [
        {**row, 'company_name': company['company_name']}
        for row in rows
        if row['external_job_id'] not in first_seen
        and titles.is_internship(row['title'])
    ]

    print(
        f"{company['company_name']}: {len(fresh_ids)} open, "
        f"{len(closed_ids)} newly closed, {len(new_internships)} new internships"
    )
    return new_internships


if __name__ == "__main__":
    companies = db.get_all_active_companies()

    for company in companies:
        poll_company(company)