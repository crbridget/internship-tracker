"""
Download the sentence-transformers weights at build time.

score_relevance.py loads the model at import, so without this the first request
after a cold start pays a ~90MB download. Running this during the build bakes
the weights into the image instead.

Deliberately does not import score_relevance: that module also imports
write_to_database, which needs SUPABASE_URL/SUPABASE_KEY, and those are runtime
config that may not exist during a build.

Keep MODEL_NAME in sync with score_relevance.py.
"""

from sentence_transformers import SentenceTransformer

MODEL_NAME = 'all-MiniLM-L6-v2'

if __name__ == '__main__':
    SentenceTransformer(MODEL_NAME)
    print(f'cached {MODEL_NAME}')
