"""
Shared test setup.

backend.db builds a Supabase client at import time from SUPABASE_URL/KEY, and
load_dotenv() would otherwise pick up the real .env. Setting fakes here, before
any backend module is imported, means tests can never reach the live database.
load_dotenv() doesn't override variables that are already set.
"""

import os
import sys
import types

os.environ['SUPABASE_URL'] = 'http://localhost:54321'
os.environ['SUPABASE_KEY'] = 'test-key'

import pytest 

from backend import db  


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    """Records the chained calls of one supabase.table(...)...execute()."""

    def __init__(self, client, table):
        self.client = client
        self.table = table
        self.calls = []

    def __getattr__(self, name):
        def method(*args, **kwargs):
            self.calls.append((name, args, kwargs))
            return self
        return method

    def execute(self):
        self.client.executed.append(self)
        return FakeResult(self.client.responder(self))


class FakeSupabase:
    """
    Stand-in for the Supabase client. `responder(query)` decides what each
    executed query returns; default is no rows.
    """

    def __init__(self, responder=None):
        self.responder = responder or (lambda query: [])
        self.executed = []

    def table(self, name):
        return FakeQuery(self, name)


@pytest.fixture(autouse=True)
def fake_supabase(monkeypatch):
    """Every test gets a recording fake; nothing talks to a real database."""
    client = FakeSupabase()
    monkeypatch.setattr(db, 'supabase', client)
    # Cached across calls in production; a test's fake must not see another's.
    db.get_default_user_id.cache_clear()
    return client


@pytest.fixture
def api(monkeypatch):
    """
    The Flask app with backend.scoring replaced by a stub.

    The real module loads MiniLM at import (slow, ~90MB download on a cold
    cache). The API tests check routing and filtering, not embeddings, so the
    stub scores by a canned lookup instead.
    """
    from backend import titles

    stub = types.ModuleType('backend.scoring')
    stub.is_internship = titles.is_internship
    stub.scores = {}

    def score_postings(targets, postings):
        for job in postings:
            job['relevance_score'] = stub.scores.get(job['title'], 0.0)
        return postings

    stub.score_postings = score_postings
    monkeypatch.setitem(sys.modules, 'backend.scoring', stub)
    # Fresh import each test so the app binds this test's stub. Both the
    # sys.modules entry and the package attribute must go: `from backend import
    # api` returns the attribute if it's set, skipping the re-import.
    import backend
    monkeypatch.delitem(sys.modules, 'backend.api', raising=False)
    monkeypatch.delattr(backend, 'api', raising=False)
    monkeypatch.setattr(backend, 'scoring', stub, raising=False)

    from backend import api as api_module
    api_module.app.testing = True
    api_module.scoring_stub = stub
    return api_module
