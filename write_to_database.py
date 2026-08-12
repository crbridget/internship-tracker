
from supabase import create_client 
import os 
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

supabase = create_client(url, key)


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
    response = supabase.table('companies').select('*').eq('status', 'active').execute()
    return response.data

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
    response = supabase.table('job_postings').select('*').eq('company_id', company_id).eq('status', 'open').execute()
    return response.data



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



