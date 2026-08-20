"""
Download the sentence-transformers weights at build time.
"""

from sentence_transformers import SentenceTransformer

MODEL_NAME = 'all-MiniLM-L6-v2'

if __name__ == '__main__':
    SentenceTransformer(MODEL_NAME)
    print(f'cached {MODEL_NAME}')
