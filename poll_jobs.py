import requests
from datetime import datetime 
import time 
import write_to_database


# get list of companies to poll

# for each company, check if greenhouse or lever, make API call

# on success - extract job postings

# normalize output

# compare what is already stored to fresh api call response
# any IDs not present that were before: mark as closed

# for each posting returned -> map source fields to schema columns

