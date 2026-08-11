# Check if the company entered uses greenhouse or lever

import requests
from datetime import datetime

companies = {}
now = datetime.now()

def normalize(company_name):
    """ 
    Normalize the company name for testing. 
    input: company_name (str)
    output: normalized comapany_name (str)
    """
    return company_name.lower().replace(' ', '')
    
def check_greenhouse(company_name, board_token):
    """ 
    Make an API call to greenhouse job board using 
    the normalized comapny name as the board token.
    input: company_name (str), board_token(str)
    output: success or fail message (str), True or False (boolean)
    """
    url = f'https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs'
    response = requests.get(url)
    if response.status_code == 200:
        print(f"Success! {board_token} uses Greenhouse")
        companies[company_name] = {
            'token': board_token,
            'source': 'greenhouse',
            'verified_date': now,
            'status': 'active'
        }
        return True
        

    else:
        print(f"Failed. {board_token} does not use Greenhouse")
        return False

def check_lever(company_name, board_token):
    """ 
    Make an API call to lever job board using 
    the normalized comapny name as the board token.
    input: company_name (str), board_token(str)
    output: success or fail message (str), True or False (boolean)
    """
    url = f'https://api.lever.co/v0/postings/{board_token}?mode=json'
    response = requests.get(url)
    if response.status_code == 200:
        print(f"Success! {board_token} uses Lever")
        companies[company_name] = {
            'token': board_token,
            'source': 'greenhouse',
            'verified_date': now,
            'status': 'active'
        }
        return True
    else:
        print(f"Failed. {board_token} does not use Lever")
        return False
    

if __name__ == "__main__":
    company = input("Enter your company: ")
    token = normalize(company)
    check_greenhouse(company, token)
    check_lever(company, token)
    print(companies)

