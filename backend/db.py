
from supabase import create_client
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

supabase = create_client(url, key)


# Columns the API and frontend need from job_postings. Deliberately excludes
# description (~6KB each): select('*') on the ~11k open postings would pull
# ~70MB per /targets request. Read descriptions by name where they're needed.
POSTING_COLUMNS = (
    'id, company_id, external_job_id, title, location, apply_url, '
    'first_published, source_updated_at, first_seen_at, last_seen_at, status'
)


def _fetch_all_rows(table, filters, page_size=1000, or_filter=None, columns='*'):
    """
    Supabase limits at 1000 rows per request.
    This function loops through every page until all the data is fetched.
    """
    rows = []
    offset = 0
    while True:
        query = supabase.table(table).select(columns)
        for column, value in filters.items():
            query = query.eq(column, value)
        if or_filter:
            query = query.or_(or_filter)

        batch = query.range(offset, offset + page_size - 1).execute().data
        rows.extend(batch)

        if len(batch) < page_size: # ends loop when number of rows < 1000
            return rows
        offset += page_size


def company_dict_to_row(company_name, info):
    """ Turn dictionary into a row to be inserted in table """
    return {
        'company_name': company_name,
        'source_token': info['token'],
        'source': info['source'],
        'status': info['status'],
        'verified_date': info['verified_date'].isoformat()
    }

def upsert_company(company_dict):
    """ insert or update a company row into the company table, keyed on source token"""
    response = supabase.table('companies').upsert(
        company_dict,
        on_conflict='source_token'
        ).execute()
    print(response)

def update_company_status(source_token, new_status, failures, checked_at):
    """ Update companies status, number of consecutive api call failures, and date last checked """
    response = supabase.table('companies').update({
        'status': new_status,
        'consecutive_failures': failures,
        'last_checked': checked_at.isoformat()
    }).eq('source_token', source_token).execute()
    print(response)

def get_all_active_companies():
    """ Fetch all companies with the active status"""
    return _fetch_all_rows('companies', {'status': 'active'})

def upsert_job_posting(job_posting):
    """ Insert new job posting or update if already in database """
    job_posting['last_seen_at'] = datetime.now().isoformat()
    job_posting.setdefault('first_seen_at', job_posting['last_seen_at'])  # only set on first insert
    
    response = supabase.table('job_postings').upsert(
        job_posting,
        on_conflict='company_id,external_job_id'
    ).execute()
    print(response)
    return response


def get_known_postings(company_id):
    """
    Every posting stored for a company, open or closed:
    external_job_id -> {'first_seen_at', 'description_hash'}.

    first_seen_at keeps re-upserts from resetting it; description_hash lets the
    poller skip rewriting descriptions that haven't changed.
    """
    rows = _fetch_all_rows(
        'job_postings',
        {'company_id': company_id},
        columns='external_job_id, first_seen_at, description_hash',
    )
    return {
        row['external_job_id']: {
            'first_seen_at': row['first_seen_at'],
            'description_hash': row['description_hash'],
        }
        for row in rows
    }


def upsert_job_postings(job_postings, first_seen_by_id=None, chunk_size=500):
    """
    Upsert many postings in one request per chunk (500).
    """
    if not job_postings:
        return

    known = first_seen_by_id or {}
    now = datetime.now().isoformat()
    for posting in job_postings:
        posting['last_seen_at'] = now
        posting['first_seen_at'] = known.get(posting['external_job_id'], now)

    # Rows don't all carry the same columns (the poller omits description when
    # it's unchanged). A bulk upsert with mixed keys can NULL the missing ones,
    # so each request only ever holds rows with identical keys.
    groups = {}
    for posting in job_postings:
        groups.setdefault(frozenset(posting), []).append(posting)

    for rows in groups.values():
        for i in range(0, len(rows), chunk_size):
            supabase.table('job_postings').upsert(
                rows[i:i + chunk_size],
                on_conflict='company_id,external_job_id',
            ).execute()


def close_postings(company_id, external_job_ids):
    """Mark a batch of postings closed in a single request."""
    if not external_job_ids:
        return

    supabase.table('job_postings').update({'status': 'closed'}) \
        .eq('company_id', company_id) \
        .in_('external_job_id', list(external_job_ids)) \
        .execute()


def get_existing_postings_for_company(company_id):
    """ Fetch the external ids of all open job postings for a specific company"""
    return _fetch_all_rows(
        'job_postings',
        {'company_id': company_id, 'status': 'open'},
        columns='external_job_id',
    )

def get_all_open_postings():
    """Fetch all open job postings, across all companies"""
    return _fetch_all_rows('job_postings', {'status': 'open'}, columns=POSTING_COLUMNS)


_INTERNSHIP_TITLE_FILTER = (
    'title.ilike.*intern*,'
    'title.ilike.*co-op*,'
    'title.ilike.*coop*'
)

# "full-time" here means "not an internship". The database has no
# employment-type column, so the title is the only signal — this lumps in
# contract and part-time roles too.
#
# Deliberately NOT the negation of _INTERNSHIP_TITLE_FILTER: ILIKE has no word
# boundaries, so inverting it would drop 98 real full-time roles like
# "Internal Audit Manager" and "International Payroll Lead".
def get_recent_non_internship_postings(limit=50, overfetch=3):
    """
    Newest open postings that aren't internships, ordered in the database.

    Over-fetches because internships can only be excluded in Python: they're
    ~1% of postings, so limit*3 comfortably covers the shortfall without
    pulling the whole table.

    nullsfirst=False is load-bearing: Postgres puts NULLs first on DESC, and
    1,354 postings have no first_published — without it "newest" returns
    undated rows.
    """
    rows = (supabase.table('job_postings')
            .select(POSTING_COLUMNS)
            .eq('status', 'open')
            .order('first_published', desc=True, nullsfirst=False)
            .limit(limit * overfetch)
            .execute().data)
    return rows


def get_open_internship_descriptions():
    """
    Open internship-titled postings *with* their description, for resume
    matching. Only ~350 rows match the title filter, so pulling descriptions
    here is cheap, unlike across all ~11k open postings.
    """
    return _fetch_all_rows(
        'job_postings',
        {'status': 'open'},
        or_filter=_INTERNSHIP_TITLE_FILTER,
        columns=POSTING_COLUMNS + ', description',
    )


def get_open_internship_postings():
    """Fetch open postings whose title plausibly names an internship."""
    return _fetch_all_rows(
        'job_postings',
        {'status': 'open'},
        or_filter=_INTERNSHIP_TITLE_FILTER,
        columns=POSTING_COLUMNS,
    )


# ---- users -----------------------------------------------------------------

# Callers go through backend.auth.user_id_for, which decides when to link or
# create; these are the raw queries.

def get_user_id_by_clerk_id(clerk_user_id):
    """users.id for a Clerk account, or None if it isn't linked yet."""
    rows = (supabase.table('users').select('id')
            .eq('clerk_user_id', clerk_user_id).execute().data)
    return rows[0]['id'] if rows else None


def get_user_by_email(email):
    """{'id', 'clerk_user_id'} for an email, or None. Emails are stored lowercase."""
    rows = (supabase.table('users').select('id, clerk_user_id')
            .eq('email', email).execute().data)
    return rows[0] if rows else None


def set_clerk_user_id(user_id, clerk_user_id):
    """Link an existing user row to a Clerk account."""
    (supabase.table('users').update({'clerk_user_id': clerk_user_id})
     .eq('id', user_id).execute())


def create_user(email, clerk_user_id):
    """Insert a user row and return its id."""
    rows = (supabase.table('users')
            .insert({'email': email, 'clerk_user_id': clerk_user_id})
            .execute().data)
    return rows[0]['id']


# ---- applications ----------------------------------------------------------

APPLICATION_COLUMNS = 'posting_id, status, notes, applied_at, created_at, updated_at'


def get_applications(user_id):
    """
    Every posting this user is tracking, with the posting embedded under
    'posting', most recently updated first. Includes closed postings.
    """
    rows = _fetch_all_rows(
        'applications',
        {'user_id': user_id},
        columns=f'{APPLICATION_COLUMNS}, posting:job_postings({POSTING_COLUMNS})',
    )
    rows.sort(key=lambda r: r['updated_at'], reverse=True)
    return rows


def get_application(user_id, posting_id):
    """One application row, or None if the posting isn't tracked."""
    rows = (supabase.table('applications')
            .select(APPLICATION_COLUMNS)
            .eq('user_id', user_id)
            .eq('posting_id', posting_id)
            .execute().data)
    return rows[0] if rows else None


def upsert_application(row):
    """Insert or update one application, returning it as stored."""
    row = {**row, 'updated_at': datetime.now(timezone.utc).isoformat()}
    stored = (supabase.table('applications')
              .upsert(row, on_conflict='user_id,posting_id')
              .execute().data)
    return {key: stored[0][key] for key in APPLICATION_COLUMNS.split(', ')}


def delete_application(user_id, posting_id):
    """Stop tracking a posting. Returns whether a row existed."""
    deleted = (supabase.table('applications')
               .delete()
               .eq('user_id', user_id)
               .eq('posting_id', posting_id)
               .execute().data)
    return bool(deleted)



## TESTING
if __name__ == "__main__":
    name = 'Klaviyo'
    token = 'klaviyo'
    test_company = {
        'token': 'klaviyo',
        'source': 'greenhouse',
        'status': 'active',
        'verified_date': datetime.now()
    }
    row = company_dict_to_row(name, test_company)
    upsert_company(row)

    # test update
    update_company_status(token, 'inactive', 1, datetime.now())

    # test getting active companies
    active = get_all_active_companies()
    print("Active companies:", active)

    # flip Klaviyo back to active
    update_company_status(token, 'active', 0, datetime.now())

    # test job posting upsert
    companies = supabase.table('companies').select('id').eq('company_name', name).execute()
    klaviyo_id = companies.data[0]['id']

    test_posting = {
    'company_id': klaviyo_id,
    'external_job_id': 'test123',
    'title': 'Test Data Analyst Role',
    'apply_url': 'https://example.com/test-job',
    'status': 'open'
}
    upsert_job_posting(test_posting)

    # test fetching postings back
    postings = get_existing_postings_for_company(klaviyo_id)
    print("Existing postings:", postings)



