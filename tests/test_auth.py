"""
backend.auth against real RS256 tokens signed by a throwaway key, standing in
for Clerk. Only the JWKS fetch is faked; signature, expiry, issuer and azp
checks all run for real.
"""

import base64
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from postgrest.exceptions import APIError

from backend import auth

HOST = 'clerk.example.test'
ISSUER = f'https://{HOST}'
SITE = 'https://tracker.example.test'
PUBLISHABLE_KEY = 'pk_test_' + base64.b64encode(f'{HOST}$'.encode()).decode().rstrip('=')

CLERK_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def make_token(key=CLERK_KEY, **overrides):
    now = int(time.time())
    claims = {
        'iss': ISSUER, 'sub': 'user_abc', 'azp': SITE, 'email': 'me@example.com',
        'iat': now, 'nbf': now, 'exp': now + 60,
    }
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm='RS256', headers={'kid': 'k1'})


class FakeJWKS:
    """Answers every kid with Clerk's public key, as the real JWKS would."""

    def get_signing_key_from_jwt(self, token):
        return type('Key', (), {'key': CLERK_KEY.public_key()})()


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setenv('CLERK_PUBLISHABLE_KEY', PUBLISHABLE_KEY)
    monkeypatch.setenv('CLERK_AUTHORIZED_PARTIES', f'{SITE}/, http://localhost:5173')
    monkeypatch.setattr(auth.jwt, 'PyJWKClient', lambda *a, **kw: FakeJWKS())


class TestPublishableKey:
    def test_decodes_frontend_api_host(self):
        assert auth.issuer_from_publishable_key(PUBLISHABLE_KEY) == ISSUER

    @pytest.mark.parametrize('key', ['pk_test_', 'nonsense', 'pk_test_' + base64.b64encode(b'no-dollar').decode()])
    def test_malformed_key_is_a_server_error(self, key):
        with pytest.raises(auth.AuthError) as err:
            auth.issuer_from_publishable_key(key)
        assert err.value.status == 503

    def test_missing_key_is_a_server_error(self, monkeypatch):
        monkeypatch.delenv('CLERK_PUBLISHABLE_KEY')
        with pytest.raises(auth.AuthError) as err:
            auth.verify_token(make_token())
        assert err.value.status == 503


class TestVerifyToken:
    def test_valid_token_returns_claims(self):
        claims = auth.verify_token(make_token())
        assert claims['sub'] == 'user_abc'
        assert claims['email'] == 'me@example.com'

    @pytest.mark.parametrize('token', [
        make_token(key=OTHER_KEY),                          # not signed by Clerk
        make_token(exp=int(time.time()) - 60),              # expired
        make_token(nbf=int(time.time()) + 60),              # not valid yet
        make_token(iss='https://evil.example.test'),        # another Clerk instance
        make_token(azp='https://evil.example.test'),        # minted for another site
        make_token(azp=None),                               # no azp at all
        make_token(sub=None),                               # nobody
        'not-a-jwt',
    ])
    def test_rejected_tokens_are_401(self, token):
        with pytest.raises(auth.AuthError) as err:
            auth.verify_token(token)
        assert err.value.status == 401

    def test_unsigned_token_is_rejected(self):
        token = jwt.encode({'iss': ISSUER, 'sub': 'user_abc'}, key=None, algorithm='none')
        with pytest.raises(auth.AuthError):
            auth.verify_token(token)

    def test_pending_session_is_403(self):
        with pytest.raises(auth.AuthError) as err:
            auth.verify_token(make_token(sts='pending'))
        assert err.value.status == 403

    def test_azp_unchecked_when_no_parties_configured(self, monkeypatch):
        monkeypatch.setenv('CLERK_AUTHORIZED_PARTIES', '')
        assert auth.verify_token(make_token(azp='https://anywhere.test'))['sub'] == 'user_abc'

    def test_unreachable_jwks_is_503(self, monkeypatch):
        class Down:
            def get_signing_key_from_jwt(self, token):
                raise jwt.PyJWKClientConnectionError('timed out')

        monkeypatch.setattr(auth.jwt, 'PyJWKClient', lambda *a, **kw: Down())
        with pytest.raises(auth.AuthError) as err:
            auth.verify_token(make_token())
        assert err.value.status == 503


class FakeUsers:
    """The users table, for user_id_for."""

    def __init__(self, monkeypatch, rows=()):
        self.rows = [dict(r) for r in rows]
        self.creates = 0
        monkeypatch.setattr(auth.db, 'get_user_id_by_clerk_id', self.by_clerk)
        monkeypatch.setattr(auth.db, 'get_user_by_email', self.by_email)
        monkeypatch.setattr(auth.db, 'set_clerk_user_id', self.link)
        monkeypatch.setattr(auth.db, 'create_user', self.create)

    def by_clerk(self, clerk_id):
        return next((r['id'] for r in self.rows if r['clerk_user_id'] == clerk_id), None)

    def by_email(self, email):
        return next((r for r in self.rows if r['email'] == email), None)

    def link(self, user_id, clerk_id):
        next(r for r in self.rows if r['id'] == user_id)['clerk_user_id'] = clerk_id

    def create(self, email, clerk_id):
        self.creates += 1
        self.rows.append({'id': len(self.rows) + 1, 'email': email, 'clerk_user_id': clerk_id})
        return len(self.rows)


class TestUserIdFor:
    def test_linked_user(self, monkeypatch):
        FakeUsers(monkeypatch, [{'id': 1, 'email': 'me@example.com', 'clerk_user_id': 'user_abc'}])
        assert auth.user_id_for('user_abc', 'me@example.com') == 1

    def test_links_existing_row_by_email_case_insensitively(self, monkeypatch):
        users = FakeUsers(monkeypatch, [{'id': 1, 'email': 'me@example.com', 'clerk_user_id': None}])
        assert auth.user_id_for('user_abc', ' Me@Example.com ') == 1
        assert users.rows[0]['clerk_user_id'] == 'user_abc'
        assert users.creates == 0

    def test_creates_new_user(self, monkeypatch):
        users = FakeUsers(monkeypatch)
        assert auth.user_id_for('user_new', 'new@example.com') == 1
        assert users.rows == [{'id': 1, 'email': 'new@example.com', 'clerk_user_id': 'user_new'}]

    def test_email_owned_by_another_clerk_account_is_409(self, monkeypatch):
        users = FakeUsers(monkeypatch, [{'id': 1, 'email': 'me@example.com', 'clerk_user_id': 'user_old'}])
        with pytest.raises(auth.AuthError) as err:
            auth.user_id_for('user_abc', 'me@example.com')
        assert err.value.status == 409
        assert users.rows[0]['clerk_user_id'] == 'user_old'

    def test_new_user_without_email_claim_is_403(self, monkeypatch):
        FakeUsers(monkeypatch)
        with pytest.raises(auth.AuthError) as err:
            auth.user_id_for('user_abc', None)
        assert err.value.status == 403

    def test_cached_after_first_lookup(self, monkeypatch):
        users = FakeUsers(monkeypatch)
        auth.user_id_for('user_abc', 'me@example.com')
        monkeypatch.setattr(auth.db, 'get_user_id_by_clerk_id', lambda c: pytest.fail('not cached'))
        assert auth.user_id_for('user_abc', 'me@example.com') == 1
        assert users.creates == 1

    def test_lost_create_race_reads_the_winner(self, monkeypatch):
        users = FakeUsers(monkeypatch)

        def create(email, clerk_id):
            users.rows.append({'id': 5, 'email': email, 'clerk_user_id': clerk_id})
            raise APIError({'code': '23505', 'message': 'duplicate key'})

        monkeypatch.setattr(auth.db, 'create_user', create)
        assert auth.user_id_for('user_abc', 'me@example.com') == 5
