from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import write_to_database
import re


model = SentenceTransformer('all-MiniLM-L6-v2')

# Word-boundary match
INTERNSHIP_RE = re.compile(r'\b(intern|internship|co-?op)\b', re.IGNORECASE)


def is_internship(title):
    return bool(INTERNSHIP_RE.search(title))

def get_desc_embeddings(target_role_descs):
    return model.encode(target_role_descs)  

def get_job_title_embeddings(job_postings):
    titles = [job['title'] for job in job_postings]
    return model.encode(titles) 

def get_relevance_score(targets, jobs):
    targets = targets.astype('float32')
    jobs = jobs.astype('float32')
    similarity_matrix = cosine_similarity(targets, jobs)
    max_scores = similarity_matrix.max(axis=0)
    return max_scores

def score_postings(targets, job_postings):
    """Filter to internship postings, score them against targets, return scored list."""
    filtered = [job for job in job_postings if is_internship(job['title'])]

    if not filtered:
        return []

    target_embeddings = get_desc_embeddings(targets)
    job_embeddings = get_job_title_embeddings(filtered)
    scores = get_relevance_score(target_embeddings, job_embeddings)

    results = []
    for job, score in zip(filtered, scores):
        job['relevance_score'] = float(score)
        results.append(job)

    return results

if __name__ == '__main__':
    targets = []
    print("Enter target role descriptions (one per line, blank line to finish):")
    while True:
        line = input()
        if not line:
            break
        targets.append(line)

    job_postings = write_to_database.get_all_open_postings()
    job_postings = [job for job in job_postings if is_internship(job['title'])]
    companies = write_to_database.get_all_active_companies()
    company_lookup = {c['id']: c for c in companies}

    target_embeddings = get_desc_embeddings(targets)
    job_embeddings = get_job_title_embeddings(job_postings)
    scores = get_relevance_score(target_embeddings, job_embeddings)

    for job, score in zip(job_postings, scores):
        company = company_lookup.get(job['company_id'], {})
        print(f"{score:.3f} — {job['title']} @ {company.get('company_name', 'Unknown')}")




