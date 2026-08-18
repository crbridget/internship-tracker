from flask import Flask, jsonify, request
from flask_cors import CORS
import write_to_database
import greenhouse_lever_check
from datetime import datetime
import score_relevance

app = Flask(__name__)
CORS(app) # allow requests from other origins

@app.route('/postings', methods=['GET'])
def get_postings():
    postings = write_to_database.get_all_open_postings()
    return jsonify(postings)

@app.route('/companies', methods=['GET'])
def get_companies():
    companies = write_to_database.get_all_active_companies()
    return jsonify(companies)

@app.route('/companies', methods=['POST'])
def post_companies():
    data = request.get_json() # converts raw json to python dict
    company_name = data.get('company_name') # gets company name

    if not company_name: # input validation
        return jsonify({'error': 'company_name is required'}), 400

    # if on greenhouse
    token = greenhouse_lever_check.normalize(company_name)
    gh_data = greenhouse_lever_check.check_greenhouse(token)
    if gh_data:
        row = write_to_database.company_dict_to_row(company_name, {
            'token': token, 'source': 'greenhouse',
            'status': 'active', 'verified_date': datetime.now()
        })
        write_to_database.upsert_company(row)
        return jsonify({'message': f'{company_name} found on Greenhouse', 'source': 'greenhouse'}), 200

    # if on lever
    lever_data = greenhouse_lever_check.check_lever(token)
    if lever_data:
        row = write_to_database.company_dict_to_row(company_name, {
            'token': token, 'source': 'lever',
            'status': 'active', 'verified_date': datetime.now()
        })
        write_to_database.upsert_company(row)
        return jsonify({'message': f'{company_name} found on Lever', 'source': 'lever'}), 200

    # if on neither
    return jsonify({'error': f'{company_name} not found on Greenhouse or Lever'}), 404

@app.route('/targets', methods=['POST'])
def post_targets():
    data = request.get_json()
    targets = data.get('targets')

    if not targets or not isinstance(targets, list): # error handling
        return jsonify({'error': 'targets must be a non-empty list of strings'}), 400

    job_postings = write_to_database.get_all_open_postings()
    scored = score_relevance.score_postings(targets, job_postings)

    for job in scored:
        write_to_database.update_posting_relevance_score(job['id'], job['relevance_score'])

    scored_sorted = sorted(scored, key=lambda j: j['relevance_score'], reverse=True)
    return jsonify(scored_sorted)

@app.route('/internships', methods=['GET'])
def get_internships():
    limit = request.args.get('limit', default=50, type=int)
    postings = write_to_database.get_all_open_postings()
    internships = [j for j in postings if score_relevance.is_internship(j['title'])]
    internships.sort(key=lambda j: j.get('first_published') or '', reverse=True)
    return jsonify(internships[:limit])

if __name__ == '__main__':
    app.run(debug=True, port=5000)