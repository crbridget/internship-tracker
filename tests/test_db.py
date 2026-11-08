from backend import db


def calls_named(query, name):
    return [c for c in query.calls if c[0] == name]


class TestUpsertJobPostings:
    def test_no_rows_makes_no_request(self, fake_supabase):
        db.upsert_job_postings([])
        assert fake_supabase.executed == []

    def test_sets_seen_timestamps_keeping_known_first_seen(self, fake_supabase):
        rows = [{'external_job_id': 'old'}, {'external_job_id': 'new'}]
        db.upsert_job_postings(rows, {'old': '2026-01-01T00:00:00'})
        old, new = rows
        assert old['first_seen_at'] == '2026-01-01T00:00:00'
        assert new['first_seen_at'] == new['last_seen_at']
        assert old['last_seen_at'] == new['last_seen_at']

    def test_rows_with_different_columns_go_in_separate_requests(self, fake_supabase):
        # A mixed-key bulk upsert could NULL the description of rows that omit it.
        rows = [
            {'external_job_id': '1', 'description': 'd', 'description_hash': 'h'},
            {'external_job_id': '2'},
            {'external_job_id': '3', 'description': 'd', 'description_hash': 'h'},
        ]
        db.upsert_job_postings(rows)

        batches = [calls_named(q, 'upsert')[0][1][0] for q in fake_supabase.executed]
        assert len(batches) == 2
        for batch in batches:
            assert len({frozenset(r) for r in batch}) == 1
        assert sorted(len(b) for b in batches) == [1, 2]

    def test_upserts_on_company_and_external_id(self, fake_supabase):
        db.upsert_job_postings([{'external_job_id': '1'}])
        [query] = fake_supabase.executed
        assert query.table == 'job_postings'
        assert calls_named(query, 'upsert')[0][2] == {'on_conflict': 'company_id,external_job_id'}

    def test_chunks_large_batches(self, fake_supabase):
        rows = [{'external_job_id': str(i)} for i in range(1201)]
        db.upsert_job_postings(rows, chunk_size=500)
        sizes = [len(calls_named(q, 'upsert')[0][1][0]) for q in fake_supabase.executed]
        assert sizes == [500, 500, 201]


class TestReads:
    def test_get_known_postings_maps_by_external_id(self, fake_supabase):
        fake_supabase.responder = lambda q: [
            {'external_job_id': 'a', 'first_seen_at': 't1', 'description_hash': 'h1'},
            {'external_job_id': 'b', 'first_seen_at': 't2', 'description_hash': None},
        ]
        assert db.get_known_postings(7) == {
            'a': {'first_seen_at': 't1', 'description_hash': 'h1'},
            'b': {'first_seen_at': 't2', 'description_hash': None},
        }
        [query] = fake_supabase.executed
        assert calls_named(query, 'select')[0][1] == ('external_job_id, first_seen_at, description_hash',)
        # Closed postings too, so a reopened posting keeps its first_seen_at.
        assert calls_named(query, 'eq') == [('eq', ('company_id', 7), {})]

    def test_posting_reads_never_select_description(self, fake_supabase):
        db.get_all_open_postings()
        db.get_open_internship_postings()
        db.get_recent_non_internship_postings()
        db.get_existing_postings_for_company(1)

        selects = [calls_named(q, 'select')[0][1][0] for q in fake_supabase.executed]
        assert len(selects) == 4
        for columns in selects:
            assert columns != '*'
            assert 'description' not in columns

    def test_fetch_all_rows_pages_until_a_short_page(self, fake_supabase):
        pages = iter([[{'id': i} for i in range(1000)], [{'id': 'last'}]])
        fake_supabase.responder = lambda q: next(pages)

        rows = db.get_all_open_postings()

        assert len(rows) == 1001
        ranges = [calls_named(q, 'range')[0][1] for q in fake_supabase.executed]
        assert ranges == [(0, 999), (1000, 1999)]


class TestApplications:
    def test_default_user_is_lowest_id_and_cached(self, fake_supabase):
        fake_supabase.responder = lambda q: [{'id': 3}]
        assert db.get_default_user_id() == 3
        assert db.get_default_user_id() == 3
        assert len(fake_supabase.executed) == 1
        [query] = fake_supabase.executed
        assert calls_named(query, 'order')[0][1] == ('id',)

    def test_default_user_missing_is_an_error(self, fake_supabase):
        import pytest
        with pytest.raises(RuntimeError):
            db.get_default_user_id()

    def test_list_embeds_posting_and_sorts_newest_first(self, fake_supabase):
        fake_supabase.responder = lambda q: [
            {'posting_id': 1, 'updated_at': '2026-11-01T00:00:00+00:00'},
            {'posting_id': 2, 'updated_at': '2026-11-05T00:00:00+00:00'},
        ]
        assert [r['posting_id'] for r in db.get_applications(7)] == [2, 1]
        [query] = fake_supabase.executed
        assert 'posting:job_postings(' in calls_named(query, 'select')[0][1][0]
        assert ('user_id', 7) in [c[1] for c in calls_named(query, 'eq')]

    def test_upsert_stamps_updated_at_and_keys_on_user_and_posting(self, fake_supabase):
        def respond(query):
            row = calls_named(query, 'upsert')[0][1][0]
            return [{**row, 'notes': None, 'applied_at': None, 'created_at': 't'}]

        fake_supabase.responder = respond
        stored = db.upsert_application({'user_id': 7, 'posting_id': 1, 'status': 'saved'})

        [query] = fake_supabase.executed
        assert calls_named(query, 'upsert')[0][2] == {'on_conflict': 'user_id,posting_id'}
        assert stored['updated_at']
        assert 'user_id' not in stored  # response shape matches GET /applications rows

    def test_delete_reports_whether_a_row_existed(self, fake_supabase):
        assert db.delete_application(7, 1) is False
        fake_supabase.responder = lambda q: [{'posting_id': 1}]
        assert db.delete_application(7, 1) is True
