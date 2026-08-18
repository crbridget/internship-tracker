
from supabase import create_client 
import os 
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

supabase = create_client(url, key)


def _fetch_all_rows(table, filters, page_size=1000, or_filter=None):
    """
    Fetch every matching row, a page at a time.

    PostgREST caps a single response at 1000 rows, so an unpaged select
    silently truncates once a table grows past that — no error, just
    missing data. Keep requesting until a short page comes back.

    or_filter is a raw PostgREST `or` expression, applied on top of the
    equality filters.
    """
    rows = []
    offset = 0
    while True:
        query = supabase.table(table).select('*')
        for column, value in filters.items():
            query = query.eq(column, value)
        if or_filter:
            query = query.or_(or_filter)

        batch = query.range(offset, offset + page_size - 1).execute().data
        rows.extend(batch)

        if len(batch) < page_size:
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
    """ insert aor update a company row into the company table, keyed on source token"""
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


def get_existing_postings_for_company(company_id):
    """ Fetch all open job postings for a specific company"""
    return _fetch_all_rows('job_postings', {'company_id': company_id, 'status': 'open'})

def get_all_open_postings():
    """Fetch all open job postings, across all companies"""
    return _fetch_all_rows('job_postings', {'status': 'open'})

# Deliberately coarser than score_relevance.is_internship(): its job is only to
# stop us pulling ~9,700 rows over the network to keep ~100 of them. All three
# patterns are needed — '*intern*' alone would silently drop every co-op
# posting. False positives ('internal', 'international', 'cooperative') are
# expected here and get dropped by the regex on the way through.
_INTERNSHIP_TITLE_FILTER = (
    'title.ilike.*intern*,'
    'title.ilike.*co-op*,'
    'title.ilike.*coop*'
)

def get_open_internship_postings():
    """Fetch open postings whose title plausibly names an internship."""
    return _fetch_all_rows(
        'job_postings',
        {'status': 'open'},
        or_filter=_INTERNSHIP_TITLE_FILTER,
    )

def update_posting_relevance_scores(postings, chunk_size=500):
    """
    Write relevance_score for many postings in one request per chunk.

    Replaces a loop of one UPDATE per posting. Each of those was its own HTTPS
    round-trip to Supabase — ~0.3s from Render, so 121 postings cost ~36s.

    Takes whole posting rows rather than {id, score} pairs on purpose: upsert
    compiles to INSERT ... ON CONFLICT, and Postgres builds the full tuple and
    checks NOT NULL before it ever detects the conflict, so partial rows can be
    rejected outright.
    """
    for i in range(0, len(postings), chunk_size):
        chunk = postings[i:i + chunk_size]
        supabase.table('job_postings').upsert(chunk, on_conflict='id').execute()


def update_posting_relevance_score(posting_id, score):
    """Update the relevance_score for a specific posting, by its id"""
    response = supabase.table('job_postings').update({
        'relevance_score': score
    }).eq('id', posting_id).execute()
    return response


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



