# Check if the company entered uses greenhouse or lever

import requests

def normalize(company_name):
    return company_name.lower().replace(' ', '')
    
def check_greenhouse(board_token):
    url = f'https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs'
    response = requests.get(url)
    if response.status_code == 200:
        print(f"Success! {board_token} uses Greenhouse")
        return True
    else:
        print(f"Failed. {board_token} does not use Greenhouse")
        return False

def check_lever(board_token):
    url = f'https://api.lever.co/v0/postings/{board_token}?mode=json'
    response = requests.get(url)
    if response.status_code == 200:
        print(f"Success! {board_token} uses Lever")
        return True
    else:
        print(f"Failed. {board_token} does not use Lever")
        return False

if __name__ == "__main__":
    company = input("Enter your company: ")
    token = normalize(company)
    check_greenhouse(token)
    check_lever(token)