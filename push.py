#!/usr/bin/env python3
"""Upload project source to kianodd/underground-empire via PAT Git Data API (serial)."""
import base64, hashlib, json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
GH = os.path.expanduser('~/workspace/custom-connectors/custom.github-pat/bin/gh.py')
REPO = 'kianodd/underground-empire'
SKIP_DIRS = {'node_modules', 'dist', '.git'}
SKIP_FILES = set()

def gh(method, path, body=None, ok_status=(200, 201, 204)):
    args = ['python3', GH, method, path]
    tmp = None
    if body is not None:
        fd, tmp = tempfile.mkstemp(suffix='.json')
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(body, f)
        args.append('@' + tmp)
    try:
        r = subprocess.run(args, capture_output=True, text=True)
    finally:
        if tmp: os.unlink(tmp)
    out = (r.stdout or '').strip()
    try:
        parsed = json.loads(out[out.find('{'):])
    except Exception:
        print('GH RAW FAIL', method, path, out[:1000], (r.stderr or '')[:500]); sys.exit(1)
    if parsed.get('status') not in ok_status:
        return None, parsed
    return parsed.get('result'), parsed

def main():
    files = []
    for dp, dns, fns in os.walk(ROOT):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for f in fns:
            if f in SKIP_FILES: continue
            p = os.path.join(dp, f)
            files.append((os.path.relpath(p, ROOT), p))
    files.sort()
    print(f'files: {len(files)}')
    repo, _ = gh('GET', f'/repos/{REPO}')
    if repo is None:
        repo, _ = gh('POST', '/user/repos', {'name': 'underground-empire', 'private': False, 'description': 'Underground Empire - Persian RTL PWA tycoon game', 'auto_init': False})
        print('repo created', repo['full_name'])
    else:
        print('repo exists', repo['full_name'])
    # Git Data API cannot create blobs on an empty repo (409) — seed via Contents API
    ref_check, _ = gh('GET', f'/repos/{REPO}/git/refs/heads/main')
    if ref_check is None:
        seed, parsed = gh('PUT', f'/repos/{REPO}/contents/.seed', {'message': 'seed', 'content': base64.b64encode(b'seed').decode()})
        assert seed is not None, parsed
        print('repo seeded via contents API')
    blobs = []
    for rel, p in files:
        data = open(p, 'rb').read()
        sha_local = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        blob, _ = gh('POST', f'/repos/{REPO}/git/blobs', {'content': base64.b64encode(data).decode(), 'encoding': 'base64'})
        assert blob['sha'] == sha_local, (rel, blob['sha'], sha_local)
        blobs.append({'path': rel, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
        print('blob', rel, blob['sha'][:8])
    tree, _ = gh('POST', f'/repos/{REPO}/git/trees', {'tree': blobs})
    commit, _ = gh('POST', f'/repos/{REPO}/git/commits', {'message': 'Underground Empire v4 - free timed crafting queue, economy rebalance, UI text cleanup', 'tree': tree['sha'], 'parents': []})
    ref, _ = gh('POST', f'/repos/{REPO}/git/refs', {'ref': 'refs/heads/main', 'sha': commit['sha']})
    if ref is None:
        gh('PATCH', f'/repos/{REPO}/git/refs/heads/main', {'sha': commit['sha'], 'force': True})
    print('commit', commit['sha'])
    pages, parsed = gh('POST', f'/repos/{REPO}/pages', {'build_type': 'workflow'})
    if pages is None:
        gh('PUT', f'/repos/{REPO}/pages', {'build_type': 'workflow'})
    print('pages enabled (workflow)')
    # verify remote tree SHA diff
    remote, _ = gh('GET', f'/repos/{REPO}/git/trees/{tree["sha"]}?recursive=1')
    remote_map = {e['path']: e['sha'] for e in remote.get('tree', []) if e['type'] == 'blob'}
    local_map = {b['path']: b['sha'] for b in blobs}
    missing = [p for p in local_map if remote_map.get(p) != local_map[p]]
    print(f'verify: local={len(local_map)} remote={len(remote_map)} mismatches={len(missing)} {missing[:5]}')
    assert not missing

if __name__ == '__main__':
    main()
