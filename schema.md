Storage Schema 

entity: company
- one to many relationship with job posting
- columns: id, comapany_name, source_token, source, status, verified_date, last_checked, consecutive failures

entity: job posting
- many to one relationship with company
- columns: id, company_id, external_job_id, title, location, description, apply_url, first_published, source_updated_at, first_seen_at, last_seen_at, status, relevance_score, user_label