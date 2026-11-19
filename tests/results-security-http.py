"""Read-only production authorization checks; password supplied only via environment.

Creates an Auth session and signs it out. Never opens rounds or emits votes.
Mutation RPC rejection probes use a nonexistent UUID and send no valid candidates.
"""
import json
import os
import urllib.request
import urllib.error

BASE = 'https://fepcnvcvgzxbjaoxnbcc.supabase.co'
KEY = 'sb_publishable_7sntAAImfvJpB0KhPVMFaQ_mE_FxQRj'
count = 0


def request(path, method='GET', body=None, token=None, extra=None):
    headers = {'apikey': KEY, 'Content-Type': 'application/json', **(extra or {})}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(BASE + path, method=method, headers=headers,
                                 data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            return response.status, {k.lower(): v for k, v in response.headers.items()}, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read()
        return error.code, {k.lower(): v for k, v in error.headers.items()}, json.loads(raw) if raw else None


def check(name, value):
    global count
    if not value:
        raise AssertionError(name)
    count += 1
    print(f'ok {count} - {name}', flush=True)


token = None
try:
    status, _, data = request('/auth/v1/token?grant_type=password', 'POST', {
        'email': 'resultados@imj.com', 'password': os.environ['IMJ_RESULTS_PASSWORD']})
    check('results account can sign in with real Auth', status == 200 and bool(data.get('access_token')))
    token = data['access_token']
    for table in ['member', 'candidate', 'cast_vote', 'election', 'election_member', 'attendance_voter']:
        status, _, _ = request(f'/rest/v1/{table}?select=*&limit=0', 'HEAD', extra={'Prefer': 'count=exact'})
        check(f'anonymous direct {table} rejected', status in [401, 403])
        status, headers, _ = request(f'/rest/v1/{table}?select=*&limit=0', 'HEAD', token=token, extra={'Prefer': 'count=exact'})
        check(f'results account sees no {table} rows', status in [401, 403] or
              (status == 200 and headers.get('content-range', '').endswith('/0')))
    for table in ['absence_reasons', 'church_attendance_settings', 'ministries', 'calendar_rules', 'event_rules', 'people', 'memberships', 'groups']:
        status, headers, _ = request(f'/rest/v1/{table}?select=*&limit=0', 'HEAD', token=token, extra={'Prefer': 'count=exact'})
        check(f'results account sees no {table} rows', status in [401, 403] or
              (status == 200 and headers.get('content-range', '').endswith('/0')))
    for rpc in ['voting_results_access', 'voting_results_snapshot']:
        status, _, _ = request('/rest/v1/rpc/' + rpc, 'POST', {})
        check('anonymous denied ' + rpc, status in [401, 403])
    status, _, data = request('/rest/v1/rpc/voting_results_access', 'POST', {}, token)
    check('authorized results permission confirmed by HTTP', status == 200 and data is True)
    status, _, snapshot = request('/rest/v1/rpc/voting_results_snapshot', 'POST', {}, token)
    check('authorized results selector loads', status == 200 and set(snapshot) == {'elections', 'rounds'})
    if snapshot['rounds']:
        round_id = snapshot['rounds'][0]['id']
        status, _, result = request('/rest/v1/rpc/voting_results_read', 'POST', {'p_round_id': round_id}, token)
        check('closed round aggregate results load', status == 200 and result['round']['status'] == 'closed')
        check('result rows contain no voter identities', all(set(row) == {'candidate_id', 'full_name', 'gender', 'vote_count'} for row in result['rows']))
    for rpc in ['voting_admin_snapshot', 'voting_staff_snapshot', 'voting_admin_close_active']:
        status, _, _ = request('/rest/v1/rpc/' + rpc, 'POST', {}, token)
        check('results account denied ' + rpc, status == 403)
    for rpc, args in [
        ('admin_set_active_pool', {'p_election_id': '00000000-0000-0000-0000-000000000000', 'p_target_pool': None}),
        ('admin_setup_tie_round_with_attendance', {'p_source_election_id': '00000000-0000-0000-0000-000000000000', 'p_gender': 'M', 'p_remaining_slots': 1, 'p_tied_candidate_ids': []})
    ]:
        for who, jwt in [('anonymous', None), ('results account', token)]:
            status, _, data = request('/rest/v1/rpc/' + rpc, 'POST', args, jwt)
            check(who + ' denied ' + rpc, status in [401, 403] and data.get('code') == '42501')
    status, _, listing = request('/storage/v1/object/list/candidate-photo', 'POST', {'prefix': '', 'limit': 1}, token)
    check('legacy photos hidden from results account', status in [401, 403] or (status == 200 and listing == []))
    print(f'PASS {count} live HTTP security checks', flush=True)
finally:
    if token:
        status, _, _ = request('/auth/v1/logout?scope=global', 'POST', token=token)
        check('verification session signed out', status in [200, 204])
