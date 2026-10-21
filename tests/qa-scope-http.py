"""QA-only role/scope HTTP contract. One JSON config line on stdin; no secrets output.

Run qa-scope-fixture.sql first. Leaves eligibility for SQL reconciliation/cleanup.
Only reserved synthetic people and election IDs are modified.
"""
import json
import sys
import urllib.error
import urllib.request

CONFIG = json.loads(sys.stdin.readline())
BASE = 'https://mldaqivoqhneqldjuryj.supabase.co'
EID = '662a785b-51cf-4357-80da-b0b366792504'
TOKENS, CHECKS = {}, []


def request(path, body, token=None):
    headers = {'apikey': CONFIG['key'], 'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        return error.code, None


def rpc(name, body, role):
    return request('/rest/v1/rpc/' + name, body, TOKENS[role])


def check(name, condition):
    CHECKS.append({'name': name, 'passed': bool(condition)})
    print(json.dumps(CHECKS[-1]), file=sys.stderr, flush=True)
    if not condition:
        raise AssertionError(name)


def enable(role, person, enabled=True):
    return rpc('voting_enable_person', {'p_election_id': EID, 'p_person_id': person,
        'p_cedula': 'QA-SCOPE-' + str(abs(person)), 'p_enabled': enabled}, role)


try:
    for role in ('admin', 'leader', 'pastor'):
        status, session = request('/auth/v1/token?grant_type=password', {
            'email': 'qa-voting-20261014-' + role + '@example.invalid', 'password': CONFIG['password']})
        check('Auth login ' + role, status == 200 and bool(session.get('access_token')))
        TOKENS[role] = session['access_token']
        status, _ = rpc('voting_staff_snapshot', {}, role)
        check('staff snapshot ' + role, status == 200)
    for role, expected in [('admin', {-14101401,-14101402,-14101403,-14101404}),
                           ('leader', {-14101401}), ('pastor', {-14101401,-14101402})]:
        status, rows = rpc('voting_staff_people', {'p_election_id': EID}, role)
        actual = {r['person_id'] for r in rows if r['person_id'] in {-14101401,-14101402,-14101403,-14101404}}
        check('exact synthetic roster scope ' + role, status == 200 and actual == expected)
    check('leader enables own list', enable('leader', -14101401)[0] == 200)
    for person in (-14101402,-14101403,-14101404):
        check('leader rejects other list ' + str(person), enable('leader', person)[0] == 403)
    check('pastor enables own territory other list', enable('pastor', -14101402)[0] == 200)
    for person in (-14101403,-14101404):
        check('pastor rejects outside/inactive territory ' + str(person), enable('pastor', person)[0] == 403)
    check('admin enables other territory', enable('admin', -14101403)[0] == 200)
    check('leader cannot revoke other territory', enable('leader', -14101403, False)[0] == 403)
    check('pastor cannot revoke other territory', enable('pastor', -14101403, False)[0] == 403)
    check('pastor revokes own territory', enable('pastor', -14101402, False)[0] == 200)
    for role in ('leader','pastor'):
        check(role + ' cannot read administrative snapshot', rpc('voting_admin_snapshot', {}, role)[0] == 403)
        check(role + ' cannot close elections', rpc('voting_admin_close_active', {}, role)[0] == 403)
        check(role + ' cannot grant location exception', rpc('voting_admin_set_exception', {
            'p_round_id': '6fd1998c-ce23-4284-a278-8f49f9863b5b', 'p_person_id': -14101401,
            'p_valid_from':'2026-10-14T00:00:00Z','p_valid_until':'2026-10-15T00:00:00Z',
            'p_reason':'QA scope must be rejected'}, role)[0] == 403)
except Exception as error:
    CHECKS.append({'name': str(error) if isinstance(error, AssertionError) else type(error).__name__, 'passed': False})
finally:
    for role, token in TOKENS.items():
        status, _ = request('/auth/v1/logout?scope=global', {}, token)
        CHECKS.append({'name': 'logout ' + role, 'passed': status == 204})
    print(json.dumps({'checks':CHECKS,'all_passed':bool(CHECKS) and all(c['passed'] for c in CHECKS)}), flush=True)
