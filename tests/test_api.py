import pytest

from tests.conftest import TEST_USER_ID


def posting(pid, title, published='2026-10-01'):
    return {'id': pid, 'title': title, 'first_published': published}


@pytest.fixture
def client(api, monkeypatch):
    internships = [
        posting(1, 'Software Intern', '2026-10-01'),
        posting(2, 'Data Co-op', '2026-10-03'),
        posting(3, 'Internal Audit Manager', '2026-10-02'),  # ILIKE false positive
        posting(4, 'ML Intern', None),
    ]
    everything = internships + [
        posting(5, 'Backend Engineer', '2026-10-05'),
        posting(6, 'Data Scientist', '2026-10-04'),
    ]
    monkeypatch.setattr(api.db, 'get_open_internship_postings', lambda: [dict(p) for p in internships])
    monkeypatch.setattr(api.db, 'get_all_open_postings', lambda: [dict(p) for p in everything])
    monkeypatch.setattr(api.db, 'get_recent_non_internship_postings', lambda limit: [dict(p) for p in everything])
    return api.app.test_client()


def ids(response):
    return [p['id'] for p in response.get_json()]


class TestInternships:
    def test_internships_newest_first_with_undated_last(self, client):
        assert ids(client.get('/internships')) == [2, 1, 4]

    def test_drops_ilike_false_positives(self, client):
        assert 3 not in ids(client.get('/internships'))

    def test_fulltime_excludes_internships(self, client):
        assert ids(client.get('/internships?kind=fulltime')) == [5, 6, 3]

    def test_limit(self, client):
        assert ids(client.get('/internships?limit=2')) == [2, 1]

    def test_unknown_kind_falls_back_to_internship(self, client):
        assert ids(client.get('/internships?kind=bogus')) == [2, 1, 4]


class TestTargets:
    @pytest.mark.parametrize('body', [
        None,
        {},
        {'targets': []},
        {'targets': 'swe'},
        {'targets': [1, None]},     # passed the old isinstance(list) check
        {'targets': ['data', '  ']},
        ['data'],                   # used to 500: list has no .get
    ])
    def test_rejects_invalid_targets(self, client, body):
        response = client.post('/targets', json=body)
        assert response.status_code == 400
        assert isinstance(response.get_json()['error'], str)

    def test_strips_whitespace_from_targets(self, client, api, monkeypatch):
        seen = []
        original = api.scoring_stub.score_postings
        monkeypatch.setattr(api.scoring_stub, 'score_postings',
                            lambda targets, postings: seen.append(targets) or original(targets, postings))
        client.post('/targets', json={'targets': ['  data  ']})
        assert seen == [['data']]

    def test_sorted_by_score_descending(self, client, api):
        api.scoring_stub.scores = {'Software Intern': 0.2, 'Data Co-op': 0.9, 'ML Intern': 0.5}
        response = client.post('/targets', json={'targets': ['data']})
        assert ids(response) == [2, 4, 1]
        assert response.get_json()[0]['relevance_score'] == 0.9

    def test_fulltime_scores_whole_non_internship_pool(self, client, api):
        api.scoring_stub.scores = {'Data Scientist': 0.8, 'Backend Engineer': 0.1}
        response = client.post('/targets?kind=fulltime', json={'targets': ['data']})
        # Every non-internship is scored, including the ILIKE false positive (3).
        assert ids(response) == [6, 5, 3]

    def test_limit_applies_after_ranking(self, client, api):
        api.scoring_stub.scores = {'ML Intern': 0.99}
        response = client.post('/targets?limit=1', json={'targets': ['ml']})
        assert ids(response) == [4]


class TestAddCompany:
    @pytest.fixture(autouse=True)
    def _signed_in(self, client, signed_in):
        client.environ_base['HTTP_AUTHORIZATION'] = 'Bearer test-token'

    @pytest.mark.parametrize('body', [None, {}, {'company_name': '   '}, {'company_name': 42}])
    def test_rejects_invalid_company_name(self, client, api, monkeypatch, body):
        monkeypatch.setattr(api.boards, 'check_greenhouse', lambda token: pytest.fail('should not call'))
        response = client.post('/companies', json=body)
        assert response.status_code == 400
        assert isinstance(response.get_json()['error'], str)

    def test_company_name_is_stripped(self, client, api, monkeypatch):
        upserted = []
        monkeypatch.setattr(api.boards, 'check_greenhouse', lambda token: [{'id': 1}])
        monkeypatch.setattr(api.db, 'upsert_company', upserted.append)
        client.post('/companies', json={'company_name': '  Big Co  '})
        assert upserted[0]['company_name'] == 'Big Co'

    def test_found_on_greenhouse(self, client, api, monkeypatch):
        upserted = []
        monkeypatch.setattr(api.boards, 'check_greenhouse', lambda token: [{'id': 1}])
        monkeypatch.setattr(api.db, 'upsert_company', upserted.append)

        response = client.post('/companies', json={'company_name': 'Big Co'})

        assert response.status_code == 200
        assert response.get_json()['source'] == 'greenhouse'
        assert upserted[0]['source_token'] == 'bigco'

    def test_falls_through_to_lever(self, client, api, monkeypatch):
        upserted = []
        monkeypatch.setattr(api.boards, 'check_greenhouse', lambda token: None)
        monkeypatch.setattr(api.boards, 'check_lever', lambda token: [{'id': 'x'}])
        monkeypatch.setattr(api.db, 'upsert_company', upserted.append)

        response = client.post('/companies', json={'company_name': 'Zoox'})

        assert response.get_json()['source'] == 'lever'
        assert upserted[0]['source'] == 'lever'

    def test_not_found_on_either(self, client, api, monkeypatch):
        monkeypatch.setattr(api.boards, 'check_greenhouse', lambda token: None)
        monkeypatch.setattr(api.boards, 'check_lever', lambda token: None)
        monkeypatch.setattr(api.db, 'upsert_company', lambda row: pytest.fail('should not insert'))

        assert client.post('/companies', json={'company_name': 'Nope'}).status_code == 404


class TestApplications:
    USER = TEST_USER_ID

    @pytest.fixture(autouse=True)
    def _signed_in(self, client, signed_in):
        client.environ_base['HTTP_AUTHORIZATION'] = 'Bearer test-token'

    @pytest.fixture
    def store(self, api, monkeypatch):
        """
        In-memory stand-in for the applications table, keyed by posting_id.
        Upserts merge like PostgREST does: only the columns sent are changed.
        """
        rows = {}
        monkeypatch.setattr(api.db, 'get_application',
                            lambda user_id, pid: rows.get(pid))

        def upsert(row):
            assert row['user_id'] == self.USER
            merged = {'notes': None, 'applied_at': None, **rows.get(row['posting_id'], {}), **row}
            rows[row['posting_id']] = merged
            return merged

        monkeypatch.setattr(api.db, 'upsert_application', upsert)
        monkeypatch.setattr(api.db, 'delete_application',
                            lambda user_id, pid: rows.pop(pid, None) is not None)
        return rows

    def test_saving_does_not_set_applied_at(self, client, store):
        response = client.put('/applications/1', json={'status': 'saved'})
        assert response.status_code == 201
        assert response.get_json()['applied_at'] is None

    def test_applying_stamps_today(self, client, store, api):
        client.put('/applications/1', json={'status': 'saved'})
        response = client.put('/applications/1', json={'status': 'applied'})
        assert response.status_code == 200
        assert response.get_json()['applied_at'] == api.date.today().isoformat()

    def test_later_status_keeps_original_applied_at(self, client, store):
        client.put('/applications/1', json={'status': 'applied', 'applied_at': '2026-10-01'})
        response = client.put('/applications/1', json={'status': 'interviewing'})
        assert response.get_json()['applied_at'] == '2026-10-01'

    def test_omitted_notes_are_kept_and_null_clears_them(self, client, store):
        client.put('/applications/1', json={'status': 'saved', 'notes': 'referral from Sam'})
        kept = client.put('/applications/1', json={'status': 'applied'}).get_json()
        assert kept['notes'] == 'referral from Sam'
        cleared = client.put('/applications/1', json={'status': 'applied', 'notes': None}).get_json()
        assert cleared['notes'] is None

    @pytest.mark.parametrize('body', [
        None,
        {},
        {'status': 'ghosted'},
        {'status': 'saved', 'applied_at': 'last tuesday'},
        {'status': 'saved', 'user_id': 99},  # can't write someone else's row
    ])
    def test_rejects_invalid_bodies(self, client, store, body):
        response = client.put('/applications/1', json=body)
        assert response.status_code == 400
        assert isinstance(response.get_json()['error'], str)
        assert store == {}

    def test_unknown_posting_is_404(self, client, store, api, monkeypatch):
        from postgrest.exceptions import APIError

        def violate(row):
            raise APIError({'code': '23503', 'message': 'violates foreign key'})

        monkeypatch.setattr(api.db, 'upsert_application', violate)
        assert client.put('/applications/999', json={'status': 'saved'}).status_code == 404

    def test_delete(self, client, store):
        client.put('/applications/1', json={'status': 'saved'})
        assert client.delete('/applications/1').status_code == 204
        assert store == {}
        assert client.delete('/applications/1').status_code == 404

    def test_list_is_scoped_to_current_user(self, client, store, api, monkeypatch):
        seen = []
        monkeypatch.setattr(api.db, 'get_applications', lambda user_id: seen.append(user_id) or [])
        assert client.get('/applications').get_json() == []
        assert seen == [self.USER]


class TestSignInRequired:
    """Without a valid token, private routes refuse before doing any work."""

    @pytest.mark.parametrize('method, path, body', [
        ('get', '/applications', None),
        ('put', '/applications/1', {'status': 'saved'}),
        ('delete', '/applications/1', None),
        ('post', '/companies', {'company_name': 'Big Co'}),
    ])
    @pytest.mark.parametrize('header', [None, 'test-token', 'Basic abc', 'Bearer ', 'Bearer bad'])
    def test_private_routes_reject_missing_or_bad_tokens(
        self, client, api, monkeypatch, method, path, body, header
    ):
        from backend.auth import AuthError

        def reject(token):
            raise AuthError('sign-in expired or invalid, please sign in again')

        monkeypatch.setattr(api.auth, 'verify_token', reject)
        for name in ('get_applications', 'upsert_application', 'delete_application', 'upsert_company'):
            monkeypatch.setattr(api.db, name, lambda *a: pytest.fail(f'{name} called'))

        headers = {'Authorization': header} if header is not None else {}
        response = getattr(client, method)(path, json=body, headers=headers)

        assert response.status_code == 401
        assert isinstance(response.get_json()['error'], str)

    def test_public_routes_need_no_token(self, client):
        assert client.get('/internships').status_code == 200
        assert client.post('/targets', json={'targets': ['data']}).status_code == 200

    def test_auth_errors_keep_their_status(self, client, api, monkeypatch):
        from backend.auth import AuthError

        def unconfigured(token):
            raise AuthError('sign-in is not configured on the server', 503)

        monkeypatch.setattr(api.auth, 'verify_token', unconfigured)
        response = client.get('/applications', headers={'Authorization': 'Bearer x'})
        assert response.status_code == 503
