from backend import boards
from backend import db
from datetime import datetime

companies_to_try = [
    # Known for large structured internship programs
    'Datadog', 'Samsara', 'Toast', 'Roblox', 'Unity', 'Zoom',
    'Okta', 'Twilio', 'DocuSign', 'Box', 'Dropbox', 'Zscaler',
    'CrowdStrike', 'SentinelOne', 'Palo Alto Networks', 'Snowflake',

    # Quant/trading (often have big summer intern classes)
    'Jane Street', 'Akuna Capital', 'DRW', 'Susquehanna', 'IMC Trading',
    'Optiver', 'Belvedere Trading', 'Tower Research Capital',

    # Fintech with visible intern pipelines
    'Affirm', 'Marqeta', 'Wise', 'Block', 'SoFi', 'Upstart',

    # Well-known for early-career tech recruiting
    'Roblox', 'Niantic', 'Peloton', 'Etsy', 'Yelp', 'Nextdoor',
    'Faire', 'Flexport', 'Samsara', 'Benchling', 'Carta',

    # Data/analytics-specific
    'Sigma Computing', 'ThoughtSpot', 'Fivetran', 'Alation',
    'Monte Carlo Data', 'dbt Labs'
]

for name in companies_to_try:
    token = boards.normalize(name)
    
    gh_data = boards.check_greenhouse(token)
    if gh_data:
        row = db.company_dict_to_row(name, {
            'token': token, 'source': 'greenhouse',
            'status': 'active', 'verified_date': datetime.now()
        })
        db.upsert_company(row)
        print(f"{name}: found on Greenhouse")
        continue

    lever_data = boards.check_lever(token)
    if lever_data:
        row = db.company_dict_to_row(name, {
            'token': token, 'source': 'lever',
            'status': 'active', 'verified_date': datetime.now()
        })
        db.upsert_company(row)
        print(f"{name}: found on Lever")
        continue

    print(f"{name}: not found on either")