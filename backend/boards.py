# Check if the company entered uses greenhouse or lever

import requests
from datetime import datetime

now = datetime.now()

def normalize(company_name):
    """ 
    Normalize the company name for testing. 
    input: company_name (str)
    output: normalized comapany_name (str)
    """
    return company_name.lower().replace(' ', '')
    
def check_greenhouse(board_token):
    """ 
    Make an API call to greenhouse job board using 
    the normalized comapny name as the board token.
    input: company_name (str), board_token (str)
    output: list of job postings (list) if found, otherwise None
    """
    url = f'https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs'
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()['jobs']

    else:
        return None

def check_lever(board_token):
    """ 
    Make an API call to lever job board using 
    the normalized comapny name as the board token.
    input: company_name (str), board_token (str)
    output: list of job postings (list) if found, otherwise None    
    """
    url = f'https://api.lever.co/v0/postings/{board_token}?mode=json'
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()
    else:
        return None
    

if __name__ == "__main__":
    company = input("Enter your company: ")
    token = normalize(company)
    
    gh_result = check_greenhouse(token)
    if gh_result:
        print(f"Found on Greenhouse: {len(gh_result)} postings")
    
    lever_result = check_lever(token)
    if lever_result:
        print(f"Found on Lever: {len(lever_result)} postings")

