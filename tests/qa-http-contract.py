"""QA-only HTTP probe. Read publishable key and fixture ID from stdin, never log tokens."""
import concurrent.futures
import json
import sys
import urllib.error
import urllib.request

config = json.load(sys.stdin)
base = 'https://mldaqivoqhneqldjuryj.supabase.co'
headers = {'apikey': config['key'], 'Content-Type': 'application/json'}
checks = []

def rpc(name, args):
    req = urllib.request.Request(base + '/rest/v1/rpc/' + name,
        data=json.dumps(args).encode(), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            return res.status, json.load(res)
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read())

def check(name, passed):
    checks.append({'name': name, 'passed': bool(passed)})
    if not passed:
        print(json.dumps(checks)); raise AssertionError(name)

status, entered = rpc('voting_enter', {'p_cedula': 'QA-HTTP-20261013', 'p_latitude': 9, 'p_longitude': -79})
check('public HTTP arrival ready and attended', status == 200 and entered.get('state') == 'ready' and entered.get('attended'))
token = entered['token']
status, ballot = rpc('voting_ballot', {'p_token': token, 'p_latitude': 9, 'p_longitude': -79})
check('HTTP ballot loads current round', status == 200 and ballot.get('state') == 'ready' and len(ballot.get('candidates', [])) == 1)
status, outside = rpc('voting_submit', {'p_token': token, 'p_candidate_ids': [config['candidate_id']], 'p_latitude': 10, 'p_longitude': -79})
check('HTTP outside submit denied', status == 200 and outside.get('state') == 'location_denied')
status, admin = rpc('voting_admin_snapshot', {})
check('anonymous HTTP admin denied', status in (401, 403, 404))
args = {'p_token': token, 'p_candidate_ids': [config['candidate_id']], 'p_latitude': 9, 'p_longitude': -79}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(lambda _: rpc('voting_submit', args), range(6)))
check('six concurrent HTTP submits accept exactly one', sum(status == 200 and result.get('state') == 'accepted' for status, result in results) == 1)
check('concurrent retries return controlled states', all(status == 200 and result.get('state') in ('accepted', 'already_voted', 'session_expired') for status, result in results))
status, reenter = rpc('voting_enter', {'p_cedula': 'QA-HTTP-20261013', 'p_latitude': 9, 'p_longitude': -79})
check('HTTP reentry reports already voted', status == 200 and reenter.get('state') == 'already_voted')
print(json.dumps({'checks': checks, 'all_passed': True}))
