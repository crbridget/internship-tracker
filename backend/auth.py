"""
Sign-in via Clerk.

The frontend sends Clerk's session token as `Authorization: Bearer <token>`.
It's a JWT signed by Clerk; verifying the signature against Clerk's public keys
(JWKS) proves who sent the request without calling Clerk per request.

Configuration (environment):
  CLERK_PUBLISHABLE_KEY     same value as the frontend's VITE_CLERK_PUBLISHABLE_KEY.
                            It encodes the instance's Frontend API host, which is
                            the token issuer and serves the JWKS.
  CLERK_AUTHORIZED_PARTIES  comma-separated origins allowed to have minted the
                            token, e.g. https://internship-tracker-bety.vercel.app.
                            Checked against the token's azp claim when set.

The token must also carry an `email` claim (added in Clerk's dashboard, see the
README), used to create or link the users row on first sign-in.
"""

import base64
import functools
import os

import jwt
from flask import g, jsonify, request
from postgrest.exceptions import APIError

from . import db

UNIQUE_VIOLATION = '23505'  # Postgres error code


class AuthError(Exception):
    def __init__(self, message, status=401):
        super().__init__(message)
        self.message = message
        self.status = status


def issuer_from_publishable_key(key):
    """
    pk_test_<base64("<frontend api host>$")> -> "https://<frontend api host>".
    This is how Clerk's own SDKs find the instance from the key.
    """
    try:
        encoded = key.split('_', 2)[2]
        host = base64.b64decode(encoded + '=' * (-len(encoded) % 4)).decode()
    except (IndexError, ValueError):
        raise AuthError('CLERK_PUBLISHABLE_KEY is malformed', 503)
    if not host.endswith('$'):
        raise AuthError('CLERK_PUBLISHABLE_KEY is malformed', 503)
    return f'https://{host[:-1]}'


@functools.cache
def _config():
    key = os.environ.get('CLERK_PUBLISHABLE_KEY', '').strip()
    if not key:
        raise AuthError('sign-in is not configured on the server (CLERK_PUBLISHABLE_KEY)', 503)
    issuer = issuer_from_publishable_key(key)
    parties = [
        origin.strip().rstrip('/')
        for origin in os.environ.get('CLERK_AUTHORIZED_PARTIES', '').split(',')
        if origin.strip()
    ]
    # Keys are cached in-process; Clerk rotates them rarely.
    jwks = jwt.PyJWKClient(f'{issuer}/.well-known/jwks.json', cache_keys=True, lifespan=3600)
    return issuer, parties, jwks


def verify_token(token):
    """The token's claims if Clerk signed it and it's current, else AuthError."""
    issuer, parties, jwks = _config()
    try:
        key = jwks.get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            key,
            algorithms=['RS256'],
            issuer=issuer,
            leeway=5,  # seconds of clock skew between Clerk and this server
            options={'require': ['exp', 'nbf', 'iat', 'iss', 'sub']},
        )
    except jwt.PyJWKClientConnectionError:
        raise AuthError("could not reach Clerk to verify sign-in", 503)
    except (jwt.PyJWKClientError, jwt.InvalidTokenError):
        raise AuthError('sign-in expired or invalid, please sign in again')

    if parties and claims.get('azp') not in parties:
        raise AuthError('token was not issued for this site')
    # A pending session has sign-up steps left (e.g. verifying an email).
    if claims.get('sts') == 'pending':
        raise AuthError('finish signing up first', 403)
    return claims


@functools.lru_cache(maxsize=4096)
def user_id_for(clerk_user_id, email):
    """
    The users.id for a Clerk account, linking or creating the row the first
    time. Cached: the mapping never changes once made. Failures aren't cached.
    """
    user_id = db.get_user_id_by_clerk_id(clerk_user_id)
    if user_id is not None:
        return user_id

    if not email:
        raise AuthError(
            "session token has no email claim; add it in Clerk's dashboard (see README)", 403
        )
    email = email.strip().lower()

    existing = db.get_user_by_email(email)
    if existing is not None:
        if existing['clerk_user_id'] not in (None, clerk_user_id):
            raise AuthError('this email is already linked to a different account', 409)
        db.set_clerk_user_id(existing['id'], clerk_user_id)
        return existing['id']

    try:
        return db.create_user(email, clerk_user_id)
    except APIError as err:
        # Two first requests raced; the other one created the row.
        if err.code == UNIQUE_VIOLATION:
            user_id = db.get_user_id_by_clerk_id(clerk_user_id)
            if user_id is not None:
                return user_id
        raise


def require_user(view):
    """
    Route decorator: 401 unless the request carries a valid Clerk session
    token. Inside the route, g.user_id is the caller's users.id.
    """
    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        scheme, _, token = request.headers.get('Authorization', '').partition(' ')
        if scheme.lower() != 'bearer' or not token.strip():
            return jsonify({'error': 'sign in required'}), 401
        try:
            claims = verify_token(token.strip())
            g.user_id = user_id_for(claims['sub'], claims.get('email'))
        except AuthError as err:
            return jsonify({'error': err.message}), err.status
        return view(*args, **kwargs)

    return wrapped
