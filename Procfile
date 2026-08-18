# --workers 1: each worker loads its own copy of the MiniLM model, so a second
#   worker roughly doubles memory. Scale with more RAM before more workers.
# --timeout 120: /targets scores every internship and then issues one UPDATE per
#   posting, which can run well past gunicorn's 30s default.
# $PORT: assigned by the host at runtime — do not hardcode 5000.
web: gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --timeout 120
