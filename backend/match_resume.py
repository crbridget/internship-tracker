"""
Rank open internships by how well their descriptions match a resume.

    python -m backend.match_resume path/to/resume.pdf [--top 20]

Both the resume and each job description are split into ~150-word chunks,
since MiniLM reads only 256 tokens and ignores the rest. Each chunk is embedded,
and a document's vector is the mean of its chunk vectors, renormalized. Score is
cosine similarity between the resume vector and each posting's vector.

Everything is computed live on each run: ~350 internship descriptions embed in
seconds. Scaling to all ~11k postings would mean precomputing and storing the
description embeddings instead.
"""

import argparse

import numpy as np

from . import db
from .titles import is_internship

# ~200 MiniLM tokens: under the 256-token limit with room for long words.
CHUNK_WORDS = 150


def _model():
    # Imported lazily: loading MiniLM takes seconds, and tests stub this out.
    from .scoring import model
    return model


def read_resume(path):
    """Resume text from a .pdf, or any plain-text file."""
    if path.lower().endswith('.pdf'):
        from pypdf import PdfReader
        return '\n'.join(page.extract_text() or '' for page in PdfReader(path).pages)
    with open(path, encoding='utf-8') as f:
        return f.read()


def chunk(text, size=CHUNK_WORDS):
    """Split text into consecutive windows of at most `size` words."""
    words = (text or '').split()
    return [' '.join(words[i:i + size]) for i in range(0, len(words), size)]


def embed_documents(texts):
    """
    One unit vector per document: the mean of its chunk embeddings.

    All chunks from all documents go to the model in one call, which is much
    faster than encoding document by document. A document with no text gets a
    zero vector, so it scores 0 against anything.
    """
    chunks, owners = [], []
    for i, text in enumerate(texts):
        for piece in chunk(text):
            chunks.append(piece)
            owners.append(i)

    model = _model()
    dim = model.get_embedding_dimension()
    sums = np.zeros((len(texts), dim), dtype='float32')
    if chunks:
        # No normalize_embeddings=True: all-MiniLM-L6-v2 ends in its own
        # Normalize layer, so chunk vectors already have unit length and each
        # chunk counts equally in the mean. A model without that layer would
        # need it back.
        vectors = model.encode(chunks, batch_size=64)
        np.add.at(sums, np.array(owners), vectors)

    norms = np.linalg.norm(sums, axis=1, keepdims=True)
    return sums / np.where(norms == 0, 1, norms)


def match(resume_text, postings):
    """
    Score postings against the resume, best first.

    Adds 'resume_score' to each posting. Vectors are unit length, so the dot
    product is the cosine similarity.
    """
    if not postings:
        return []
    resume_vec = embed_documents([resume_text])[0]
    job_vecs = embed_documents([p['description'] for p in postings])
    # macOS Accelerate BLAS raises spurious divide/overflow flags on matmul
    # even when every input and output is finite (checked: no NaN/inf, matches
    # float64 to ~1e-8). Silenced here only, not globally.
    with np.errstate(divide='ignore', over='ignore', invalid='ignore'):
        scores = job_vecs @ resume_vec

    for posting, score in zip(postings, scores):
        posting['resume_score'] = float(score)
    return sorted(postings, key=lambda p: p['resume_score'], reverse=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('resume', help='path to a .pdf or .txt resume')
    parser.add_argument('--top', type=int, default=20, help='how many matches to print')
    args = parser.parse_args()

    resume_text = read_resume(args.resume)
    if not resume_text.strip():
        raise SystemExit(f'No text extracted from {args.resume} (scanned PDF? try a .txt copy)')

    # The title filter in SQL is loose (ILIKE matches "Internal"); is_internship
    # is the exact check. Postings without a description can't be compared.
    postings = [
        p for p in db.get_open_internship_descriptions()
        if is_internship(p['title']) and p.get('description')
    ]
    companies = {c['id']: c['company_name'] for c in db.get_all_active_companies()}

    ranked = match(resume_text, postings)

    print(f'\n{len(postings)} internships scored against {args.resume} '
          f'({len(resume_text.split())} words)\n')
    for p in ranked[:args.top]:
        company = companies.get(p['company_id'], 'Unknown')
        print(f"{p['resume_score']:.3f}  {p['title']} @ {company}\n       {p['apply_url']}")


if __name__ == '__main__':
    main()
