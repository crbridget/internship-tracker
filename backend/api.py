from flask import Flask, jsonify, request
from flask_cors import CORS
from . import db
from . import boards
from datetime import datetime
from . import scoring

app = Flask(__name__)
CORS(app) # allow requests from other origins

@app.route('/postings', methods=['GET'])
def get_postings():
    postings = db.get_all_open_postings()
    return jsonify(postings)

@app.route('/companies', methods=['GET'])
def get_companies():
    companies = db.get_all_active_companies()
    return jsonify(companies)

@app.route('/companies', methods=['POST'])
def post_companies():
    data = request.get_json() # converts raw json to python dict
    company_name = data.get('company_name') # gets company name

    if not company_name: # input validation
        return jsonify({'error': 'company_name is required'}), 400

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
    data = request.get_json()
    targets = data.get('targets')

    if not targets or not isinstance(targets, list): # error handling
        return jsonify({'error': 'targets must be a non-empty list of strings'}), 400

    job_postings = db.get_open_internship_postings()
    scored = scoring.score_postings(targets, job_postings)

    db.update_posting_relevance_scores(scored)

    scored_sorted = sorted(scored, key=lambda j: j['relevance_score'], reverse=True)
    return jsonify(scored_sorted)

@app.route('/internships', methods=['GET'])
def get_internships():
    limit = request.args.get('limit', default=50, type=int)
    postings = db.get_open_internship_postings()
    internships = [j for j in postings if scoring.is_internship(j['title'])]
    internships.sort(key=lambda j: j.get('first_published') or '', reverse=True)
    return jsonify(internships[:limit])

if __name__ == '__main__':
    app.run(debug=True, port=5000)