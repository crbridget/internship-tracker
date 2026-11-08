from flask import Flask, abort, g, jsonify, make_response, request
from flask_cors import CORS
from postgrest.exceptions import APIError
from pydantic import ValidationError
from . import auth
from . import db
from . import boards
from . import models
from datetime import date, datetime
from . import scoring

FOREIGN_KEY_VIOLATION = '23503'  # Postgres error code

app = Flask(__name__)
CORS(app) # allow requests from other origins


def _body(model):
    """
    The request's JSON body validated as `model`, or a 400 with the first
    problem as {'error': ...}. A missing or non-JSON body is a 400 too.
    """
    try:
        return model.model_validate(request.get_json(silent=True))
    except ValidationError as err:
        abort(make_response(jsonify({'error': models.error_message(err)}), 400))


@app.route('/postings', methods=['GET'])
def get_postings():
    postings = db.get_all_open_postings()
    return jsonify(postings)

@app.route('/companies', methods=['GET'])
def get_companies():
    companies = db.get_all_active_companies()
    return jsonify(companies)

@app.route('/companies', methods=['POST'])
@auth.require_user
def post_companies():
    company_name = _body(models.AddCompanyRequest).company_name

    # if on greenhouse
    token = boards.normalize(company_name)
    gh_data = boards.check_greenhouse(token)
    if gh_data:
        row = db.company_dict_to_row(company_name, {
            'token': token, 'source': 'greenhouse',
            'status': 'active', 'verified_date': datetime.now()
        })
        db.upsert_company(row)
        return jsonify({'message': f'{company_name} found on Greenhouse', 'source': 'greenhouse'}), 200

    # if on lever
    lever_data = boards.check_lever(token)
    if lever_data:
        row = db.company_dict_to_row(company_name, {
            'token': token, 'source': 'lever',
            'status': 'active', 'verified_date': datetime.now()
        })
        db.upsert_company(row)
        return jsonify({'message': f'{company_name} found on Lever', 'source': 'lever'}), 200

    # if on neither
    return jsonify({'error': f'{company_name} not found on Greenhouse or Lever'}), 404

@app.route('/targets', methods=['POST'])
def post_targets():
    targets = _body(models.TargetsRequest).targets

    # Score the whole pool so the ranking is honest, but only return the top
    # slice. kind=fulltime scores ~10.6k postings; returning them all is a ~5MB
    # response and 10k DOM nodes for a list nobody scrolls.
    limit = request.args.get('limit', default=200, type=int)

    job_postings = _postings_for_kind(_requested_kind(), limit=None)
    scored = scoring.score_postings(targets, job_postings)

    # Scores are returned in the response and not persisted: they're specific to
    # this request's targets, so a single global column can't represent them.

    scored_sorted = sorted(scored, key=lambda j: j['relevance_score'], reverse=True)
    return jsonify(scored_sorted[:limit])

KINDS = ('internship', 'fulltime')


def _requested_kind():
    """?kind=internship|fulltime, defaulting to internship."""
    kind = request.args.get('kind', default='internship')
    return kind if kind in KINDS else 'internship'


def _postings_for_kind(kind, limit=50):
    """
    Open postings of one kind, newest first.

    limit=None means "everything of this kind", which /targets needs so it can
    score the whole pool rather than only the newest page.
    """
    if kind == 'fulltime':
        if limit is None:
            postings = db.get_all_open_postings()
        else:
            postings = db.get_recent_non_internship_postings(limit)
        matching = [j for j in postings if not scoring.is_internship(j['title'])]
    else:
        postings = db.get_open_internship_postings()
        matching = [j for j in postings if scoring.is_internship(j['title'])]

    # Undated postings sink rather than posing as newest.
    matching.sort(key=lambda j: j.get('first_published') or '', reverse=True)
    return matching if limit is None else matching[:limit]


@app.route('/internships', methods=['GET'])
def get_internships():
    limit = request.args.get('limit', default=50, type=int)
    return jsonify(_postings_for_kind(_requested_kind(), limit))


def _current_user_id():
    """The signed-in caller's users.id. Only valid under @auth.require_user."""
    return g.user_id


@app.route('/applications', methods=['GET'])
@auth.require_user
def get_applications():
    return jsonify(db.get_applications(_current_user_id()))


@app.route('/applications/<int:posting_id>', methods=['PUT'])
@auth.require_user
def put_application(posting_id):
    """Start tracking a posting, or change its status/notes."""
    update = _body(models.ApplicationUpdate)
    user_id = _current_user_id()
    existing = db.get_application(user_id, posting_id)

    row = {
        'user_id': user_id,
        'posting_id': posting_id,
        **update.model_dump(mode='json', exclude_unset=True),
    }
    # Stamp the date the first time it moves past 'saved'. Later status changes
    # (interviewing, rejected, ...) keep the original date.
    already_dated = existing is not None and existing['applied_at'] is not None
    if 'applied_at' not in row and update.status != 'saved' and not already_dated:
        row['applied_at'] = date.today().isoformat()

    try:
        stored = db.upsert_application(row)
    except APIError as err:
        if err.code == FOREIGN_KEY_VIOLATION:
            return jsonify({'error': f'posting {posting_id} does not exist'}), 404
        raise

    return jsonify(stored), 200 if existing else 201


@app.route('/applications/<int:posting_id>', methods=['DELETE'])
@auth.require_user
def delete_application(posting_id):
    """Stop tracking a posting."""
    if not db.delete_application(_current_user_id(), posting_id):
        return jsonify({'error': f'posting {posting_id} is not tracked'}), 404
    return '', 204

if __name__ == '__main__':
    app.run(debug=True, port=5000)