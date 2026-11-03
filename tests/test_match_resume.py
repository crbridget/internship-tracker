import numpy as np
import pytest

from backend import match_resume


class FakeModel:
    """
    Embeds by keyword: dimension 0 counts 'python', dimension 1 counts 'sales'.
    Always returns unit vectors, like all-MiniLM-L6-v2's built-in Normalize
    layer. Records what it was asked to encode.
    """

    def __init__(self):
        self.encoded = []

    def get_embedding_dimension(self):
        return 2

    def encode(self, chunks, batch_size=None):
        self.encoded.append(list(chunks))
        vecs = np.array([[c.count('python'), c.count('sales')] for c in chunks], dtype='float32')
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        vecs = vecs / np.where(norms == 0, 1, norms)
        return vecs


@pytest.fixture
def model(monkeypatch):
    fake = FakeModel()
    monkeypatch.setattr(match_resume, '_model', lambda: fake)
    return fake


class TestChunk:
    def test_splits_into_word_windows(self):
        assert match_resume.chunk('a b c d e', size=2) == ['a b', 'c d', 'e']

    def test_empty(self):
        assert match_resume.chunk('') == []
        assert match_resume.chunk(None) == []

    def test_default_size_stays_under_model_limit(self):
        chunks = match_resume.chunk('word ' * 1000)
        assert all(len(c.split()) <= match_resume.CHUNK_WORDS for c in chunks)
        assert len(chunks) == 7


class TestEmbedDocuments:
    def test_one_unit_vector_per_document(self, model):
        vecs = match_resume.embed_documents(['python', 'sales sales'])
        assert vecs.shape == (2, 2)
        np.testing.assert_allclose(np.linalg.norm(vecs, axis=1), [1, 1])

    def test_mean_of_chunks(self, model, monkeypatch):
        # One word per chunk: a 'python' chunk and a 'sales' chunk average to
        # the diagonal.
        monkeypatch.setattr(match_resume, 'chunk', lambda text: text.split())
        [vec] = match_resume.embed_documents(['python sales'])
        np.testing.assert_allclose(vec, [2 ** -0.5, 2 ** -0.5], rtol=1e-6)

    def test_all_chunks_encoded_in_one_call(self, model):
        match_resume.embed_documents(['python', 'sales', 'python sales'])
        assert len(model.encoded) == 1

    def test_empty_document_gets_zero_vector(self, model):
        vecs = match_resume.embed_documents(['', 'python'])
        np.testing.assert_array_equal(vecs[0], [0, 0])

    def test_no_text_at_all_skips_the_model(self, model):
        vecs = match_resume.embed_documents(['', None])
        assert model.encoded == []
        assert vecs.shape == (2, 2)


class TestMatch:
    def test_ranks_by_similarity_and_adds_score(self, model):
        postings = [
            {'id': 1, 'description': 'sales sales sales'},
            {'id': 2, 'description': 'python python'},
            {'id': 3, 'description': 'python sales'},
        ]
        ranked = match_resume.match('python developer', postings)
        assert [p['id'] for p in ranked] == [2, 3, 1]
        assert ranked[0]['resume_score'] == pytest.approx(1.0)
        assert ranked[-1]['resume_score'] == pytest.approx(0.0)

    def test_no_postings(self, model):
        assert match_resume.match('anything', []) == []


class TestReadResume:
    def test_reads_text_file(self, tmp_path):
        path = tmp_path / 'resume.txt'
        path.write_text('Python, SQL, pandas', encoding='utf-8')
        assert match_resume.read_resume(str(path)) == 'Python, SQL, pandas'
