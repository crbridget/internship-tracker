
from supabase import create_client 
import os 
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

supabase = create_client(url, key)


def company_dict_to_row(company_name, info):
    return {
        'company_name': company_name,
        'source_token': info['token'],
        'source': info['source'],
        'status': info['status'],
        'verified_date': info['verified_date'].isoformat()
    }

def insert_company(company_dict):
    """ insert a company row into the company table """
    response = supabase.table('company').insert(company_dict).execute()
    print(response)

def update_company_status():
    pass

def get_all_active_companies():
    pass

def insert_job_posting():
    pass

def update_job_posting():
    pass

def get_existing_postings_for_company(company_id):
    pass


if __name__ == "__main__":
    name = 'Klaviyo'
    test_company = {
        'token': 'klaviyo',
        'source': 'greenhouse',
        'status': 'active',
        'verified_date': datetime.now()
    }
    row = company_dict_to_row(name, test_company)
    insert_company(row)