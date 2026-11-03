import pytest


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
    @pytest.mark.parametrize('body', [{}, {'targets': []}, {'targets': 'swe'}])
    def test_rejects_missing_or_non_list_targets(self, client, body):
        response = client.post('/targets', json=body)
        assert response.status_code == 400

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
    def test_requires_company_name(self, client):
        assert client.post('/companies', json={}).status_code == 400

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
