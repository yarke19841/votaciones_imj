"""QA-only Auth/Storage/concurrency contract. Secrets arrive on stdin, never output.

Run after qa-staff-fixture.sql. Used photos are retained by history policies; remove only synthetic SQL references
before deleting this run's objects through Storage API. Logout runs automatically;
reconcile printed fixture IDs via SQL before deleting disposable Auth users.
This is HTTP integration, not a browser or file-picker acceptance test.
"""
import base64
import concurrent.futures
import json
import sys
import urllib.error
import urllib.request

CONFIG = json.load(sys.stdin)
BASE = 'https://mldaqivoqhneqldjuryj.supabase.co'
CHECKS, FIXTURE, TOKENS = [], {}, {}
PHOTO_PATHS = ['qa-staff-20261014/official.png', 'qa-staff-20261014/practice.png']
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')


def request(path, method='GET', body=None, token=None, binary=False):
    headers = {'apikey': CONFIG['key']}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if body is not None:
        headers['Content-Type'] = 'image/png' if binary else 'application/json'
        body = body if binary else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = response.read()
            return response.status, data if binary else (json.loads(data) if data else None)
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            data = json.loads(raw)
        except ValueError:
            data = None
        return error.code, data


def rpc(name, args=None, token=None):
    return request('/rest/v1/rpc/' + name, 'POST', args or {}, token)


def check(name, condition):
    CHECKS.append({'name': name, 'passed': bool(condition)})
    if not condition:
        raise AssertionError(name)


def save(name, args, field):
    status, value = rpc(name, args, TOKENS['admin'])
    check('HTTP ' + field + ' created', status == 200 and isinstance(value, str))
    FIXTURE[field] = value
    return value


def main():
    for role in ('admin', 'leader'):
        status, session = request('/auth/v1/token?grant_type=password', 'POST', {
            'email': 'qa-voting-20261014-' + role + '@example.invalid',
            'password': CONFIG['password'],
        })
        check('real Auth password login ' + role, status == 200 and bool(session.get('access_token')))
        TOKENS[role] = session['access_token']
        uid = session['user']['id']
        status, profiles = request('/rest/v1/profiles?select=role,is_active&user_id=eq.' + uid, token=TOKENS[role])
        check('own profile RLS read ' + role, status == 200 and len(profiles) == 1
              and profiles[0]['role'] == role and profiles[0]['is_active'])
    status, _ = request('/auth/v1/token?grant_type=password', 'POST', {
        'email': 'qa-voting-20261014-admin@example.invalid', 'password': 'not-the-test-password',
    })
    check('invalid password rejected', status == 400)
    status, _ = rpc('voting_admin_snapshot', token=TOKENS['admin'])
    check('admin authenticated snapshot allowed', status == 200)
    status, _ = rpc('voting_admin_snapshot', token=TOKENS['leader'])
    check('leader administrative snapshot denied', status == 403)
    status, _ = rpc('voting_staff_snapshot', token=TOKENS['leader'])
    check('leader staff snapshot allowed', status == 200)
    status, _ = request('/storage/v1/object/voting-photos/qa-staff-20261014/denied.png',
                        'POST', PNG, TOKENS['leader'], True)
    check('leader photo upload denied', status in (400, 401, 403))
    for path in PHOTO_PATHS:
        status, _ = request('/storage/v1/object/voting-photos/' + path, 'POST', PNG, TOKENS['admin'], True)
        check('admin uploads real PNG ' + path.rsplit('/', 1)[-1], status == 200)
        status, data = request('/storage/v1/object/authenticated/voting-photos/' + path,
                               token=TOKENS['admin'], binary=True)
        check('admin downloads identical PNG ' + path.rsplit('/', 1)[-1], status == 200 and data == PNG)
        status, _ = request('/storage/v1/object/authenticated/voting-photos/' + path, binary=True)
        check('anonymous photo hidden before opening ' + path.rsplit('/', 1)[-1], status != 200)
    eid = save('voting_admin_save_election', {
        'p_id': None, 'p_year': 2098, 'p_title': 'QA staff HTTP 20261014',
        'p_male_slots': 1, 'p_female_slots': 0,
        'p_latitude': 9, 'p_longitude': -79, 'p_radius_meters': 150,
    }, 'election_id')
    rounds = []
    for practice in (False, True):
        kind = 'practice' if practice else 'official'
        cid = save('voting_admin_save_candidate', {
            'p_id': None, 'p_election_id': None if practice else eid,
            'p_full_name': 'QA staff HTTP 20261014 ' + kind, 'p_gender': 'M',
            'p_photo_url': PHOTO_PATHS[1 if practice else 0], 'p_practice': practice, 'p_active': True,
        }, kind + '_candidate_id')
        rid = save('voting_admin_save_round', {
            'p_id': None, 'p_election_id': eid, 'p_kind': kind, 'p_number': 1,
            'p_attendance_policy': 'new', 'p_male_slots': 1, 'p_female_slots': 0,
            'p_candidate_ids': [cid],
        }, kind + '_round_id')
        rounds.append(rid)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        opened = list(pool.map(lambda rid: rpc('voting_admin_open_round', {'p_round_id': rid}, TOKENS['admin']), rounds))
    check('two simultaneous opens accept exactly one', sum(status == 200 for status, _ in opened) == 1)
    status, snap = rpc('voting_admin_snapshot', token=TOKENS['admin'])
    active = [r for r in snap['rounds'] if r['status'] == 'open']
    check('snapshot confirms one open round', status == 200 and len(active) == 1)
    winner = active[0]['round_kind']
    for path in PHOTO_PATHS:
        status, data = request('/storage/v1/object/authenticated/voting-photos/' + path, binary=True)
        check('only active round photo accessible ' + path.rsplit('/', 1)[-1],
              (status == 200 and data == PNG) if path.endswith(winner + '.png') else status != 200)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        closed = list(pool.map(lambda _: rpc('voting_admin_close_active', token=TOKENS['admin']), range(2)))
    check('simultaneous closes close active only once', sum(status == 200 for status, _ in closed) == 1)
    status, snap = rpc('voting_admin_snapshot', token=TOKENS['admin'])
    check('snapshot confirms no open round after close', status == 200 and not any(r['status'] == 'open' for r in snap['rounds']))
    for path in PHOTO_PATHS:
        status, _ = request('/storage/v1/object/authenticated/voting-photos/' + path, binary=True)
        check('anonymous photo inaccessible after close ' + path.rsplit('/', 1)[-1], status != 200)


try:
    main()
except Exception as error:
    FIXTURE['failure'] = str(error) if isinstance(error, AssertionError) else type(error).__name__
finally:
    if TOKENS.get('admin'):
        # API cleanup, never direct SQL deletion of storage.objects.
        status, deleted = request('/storage/v1/object/voting-photos', 'DELETE', {'prefixes': PHOTO_PATHS}, TOKENS['admin'])
        CHECKS.append({'name': 'historical photos protected from Storage deletion', 'passed': status == 200 and len(deleted or []) == 0})
        for role, token in TOKENS.items():
            status, _ = request('/auth/v1/logout?scope=global', 'POST', {}, token)
            CHECKS.append({'name': 'Auth sessions signed out ' + role, 'passed': status == 204})
    print(json.dumps({'checks': CHECKS, 'fixture': FIXTURE,
                      'all_passed': bool(CHECKS) and all(c['passed'] for c in CHECKS) and 'failure' not in FIXTURE}))
