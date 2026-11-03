import html

import pytest

from backend import poller, text


def gh_raw(job_id, title='Software Engineer', content='<p>Build things</p>'):
    return {
        'id': job_id,
        'title': title,
        'location': {'name': 'Boston'},
        'absolute_url': f'https://boards.greenhouse.io/x/jobs/{job_id}',
        'first_published': '2026-10-01T00:00:00Z',
        'updated_at': '2026-10-02T00:00:00Z',
        'content': html.escape(content),
    }


class TestNormalizers:
    def test_greenhouse(self):
        row = poller.normalize_greenhouse_posting(gh_raw(42, content='<p>Ship it</p>'))
        assert row == {
            'external_job_id': '42',
            'title': 'Software Engineer',
            'location': 'Boston',
            'apply_url': 'https://boards.greenhouse.io/x/jobs/42',
            'first_published': '2026-10-01T00:00:00Z',
            'source_updated_at': '2026-10-02T00:00:00Z',
            'status': 'open',
            'description': 'Ship it',
        }

    def test_lever(self):
        raw = {
            'id': 'abc-123',
            'text': 'Robotics Intern',
            'categories': {'location': 'Foster City'},
            'hostedUrl': 'https://jobs.lever.co/x/abc-123',
            'descriptionPlain': 'Help build robots.',
            'lists': [{'text': 'You will', 'content': '<li>Weld</li>'}],
        }
        row = poller.normalize_lever_posting(raw)
        assert row['external_job_id'] == 'abc-123'
        assert row['title'] == 'Robotics Intern'
        assert row['location'] == 'Foster City'
        assert row['first_published'] is None
        assert row['description'] == 'Help build robots.\n\nYou will\n- Weld'

    def test_missing_location_is_none(self):
        raw = gh_raw(1)
        del raw['location']
        assert poller.normalize_greenhouse_posting(raw)['location'] is None


class FakeDb:
    """Records what poll_company asks the db layer to do."""

    def __init__(self, known=None, open_ids=()):
        self.known = known or {}
        self.open_ids = list(open_ids)
        self.status_updates = []
        self.upserted = None
        self.first_seen_arg = None
        self.closed = None

    def update_company_status(self, token, status, failures, checked_at):
        self.status_updates.append((token, status, failures))

    def get_existing_postings_for_company(self, company_id):
        return [{'external_job_id': i} for i in self.open_ids]

    def get_known_postings(self, company_id):
        return self.known

    def upsert_job_postings(self, rows, first_seen):
        self.upserted = rows
        self.first_seen_arg = first_seen

    def close_postings(self, company_id, ids):
        self.closed = set(ids)


COMPANY = {
    'id': 7,
    'company_name': 'Acme',
    'source': 'greenhouse',
    'source_token': 'acme',
    'consecutive_failures': 0,
}


@pytest.fixture
def run(monkeypatch):
    """poll_company against a fake db and a canned board response."""
    def _run(raw_postings, fake_db, company=COMPANY):
        calls = []

        def check_greenhouse(token, content=False):
            calls.append(content)
            return raw_postings

        monkeypatch.setattr(poller, 'db', fake_db)
        monkeypatch.setattr(poller.boards, 'check_greenhouse', check_greenhouse)
        result = poller.poll_company(company)
        return result, calls
    return _run


def known(first_seen, description):
    return {'first_seen_at': first_seen, 'description_hash': text.description_hash(description)}


class TestPollCompany:
    def test_requests_descriptions_from_greenhouse(self, run):
        _, calls = run([gh_raw(1)], FakeDb())
        assert calls == [True]

    def test_new_posting_writes_description_and_hash(self, run):
        fake = FakeDb()
        run([gh_raw(1, content='<p>Build things</p>')], fake)
        [row] = fake.upserted
        assert row['description'] == 'Build things'
        assert row['description_hash'] == text.description_hash('Build things')
        assert row['company_id'] == 7

    def test_unchanged_description_is_not_rewritten(self, run):
        fake = FakeDb(known={'1': known('2026-09-01', 'Build things')}, open_ids=['1'])
        run([gh_raw(1, content='<p>Build things</p>')], fake)
        [row] = fake.upserted
        assert 'description' not in row
        assert 'description_hash' not in row

    def test_changed_description_is_rewritten(self, run):
        fake = FakeDb(known={'1': known('2026-09-01', 'Old text')}, open_ids=['1'])
        run([gh_raw(1, content='<p>New text</p>')], fake)
        [row] = fake.upserted
        assert row['description'] == 'New text'
        assert row['description_hash'] == text.description_hash('New text')

    def test_rows_stored_before_hashing_get_backfilled(self, run):
        # Every existing row has description_hash NULL after migration 004.
        fake = FakeDb(known={'1': {'first_seen_at': '2026-09-01', 'description_hash': None}})
        run([gh_raw(1, content='<p>Build things</p>')], fake)
        assert fake.upserted[0]['description'] == 'Build things'

    def test_first_seen_is_passed_through_for_known_postings(self, run):
        fake = FakeDb(known={'1': known('2026-09-01', 'x')})
        run([gh_raw(1)], fake)
        assert fake.first_seen_arg == {'1': '2026-09-01'}

    def test_missing_postings_are_closed(self, run):
        fake = FakeDb(open_ids=['1', '2', '3'])
        run([gh_raw(1), gh_raw(3)], fake)
        assert fake.closed == {'2'}

    def test_returns_only_new_internships(self, run):
        fake = FakeDb(known={'1': known('2026-09-01', 'Build things')})
        new, _ = run([
            gh_raw(1, title='Software Intern'),       # known: not new
            gh_raw(2, title='Data Science Intern'),   # new internship
            gh_raw(3, title='Internal Tools Lead'),   # new, not an internship
        ], fake)
        assert [p['external_job_id'] for p in new] == ['2']
        assert new[0]['company_name'] == 'Acme'

    def test_success_resets_failures(self, run):
        fake = FakeDb()
        run([gh_raw(1)], fake, company={**COMPANY, 'consecutive_failures': 2})
        assert fake.status_updates == [('acme', 'active', 0)]

    def test_failure_increments_and_writes_nothing(self, run):
        fake = FakeDb()
        result, _ = run(None, fake, company={**COMPANY, 'consecutive_failures': 1})
        assert result == []
        assert fake.status_updates == [('acme', 'active', 2)]
        assert fake.upserted is None and fake.closed is None

    def test_third_failure_marks_inactive(self, run):
        fake = FakeDb()
        run(None, fake, company={**COMPANY, 'consecutive_failures': 2})
        assert fake.status_updates == [('acme', 'inactive', 3)]

    def test_unknown_source_is_skipped(self, run):
        fake = FakeDb()
        result, calls = run([gh_raw(1)], fake, company={**COMPANY, 'source': 'workday'})
        assert result == [] and calls == []
        assert fake.status_updates == []
