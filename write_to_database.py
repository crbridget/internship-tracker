
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
    Supabase limits at 1000 rows per request.
    This function loops through every page until all the data is fetched.
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


def get_first_seen_by_external_id(company_id):
    """
    Takes company ID and returns look up, mapping external_job_id -> first_seen_at for every posting.
    """
    seen = {}
    offset = 0
    page_size = 1000
    while True:
        batch = (supabase.table('job_postings')
                 .select('external_job_id, first_seen_at')
                 .eq('company_id', company_id)
                 .range(offset, offset + page_size - 1)
                 .execute().data)
        for row in batch:
            seen[row['external_job_id']] = row['first_seen_at']
        if len(batch) < page_size:
            return seen
        offset += page_size


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

    for i in range(0, len(job_postings), chunk_size):
        supabase.table('job_postings').upsert(
            job_postings[i:i + chunk_size],
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
    """ Fetch all open job postings for a specific company"""
    return _fetch_all_rows('job_postings', {'company_id': company_id, 'status': 'open'})

def get_all_open_postings():
    """Fetch all open job postings, across all companies"""
    return _fetch_all_rows('job_postings', {'status': 'open'})


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



