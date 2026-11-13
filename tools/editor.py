#!/usr/bin/env python3
"""Local-only portfolio editor. Uses the user's existing GitHub CLI login."""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import re
import shutil
import subprocess
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
REPO = 'RaghdB/raghd-boulos-website'
BRANCH = 'main'
LIVE = 'https://raghdb.github.io/raghd-boulos-website/'
SCHEMA = json.loads((ROOT / 'tools/editor-schema.json').read_text())
ENTRIES = {x['name']: x for x in SCHEMA['content']}
PATHS = {k: x['path'] for k, x in ENTRIES.items()}
TOKEN = secrets.token_hex(32)
STATE = ROOT / '.editor-state.json'
UPLOADS = ROOT / '.editor-uploads'
MAX_BODY = 15 * 1024 * 1024
LOCK = threading.Lock()
BASELINE = None

def gh(route, method='GET', payload=None):
    command = ['gh', 'api', '--hostname', 'github.com', '-H', 'Accept: application/vnd.github+json', '-H', 'X-GitHub-Api-Version: 2022-11-28', '--method', method, route]
    if payload is not None:
        command += ['--input', '-']
    try:
        result = subprocess.run(command, input=json.dumps(payload) if payload is not None else None, text=True, capture_output=True, timeout=45, cwd=ROOT)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ValueError('GitHub could not be reached. Your local draft is safe. Check your connection and GitHub CLI login.') from exc
    if result.returncode:
        raise ValueError('GitHub rejected the request. Check your connection and run gh auth login if needed. Nothing was force-pushed.')
    return json.loads(result.stdout)

def authenticated():
    if not shutil.which('gh'):
        return False
    try:
        return subprocess.run(['gh', 'auth', 'status', '--hostname', 'github.com'], capture_output=True, timeout=15).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False

def local_files():
    return {key: json.loads((ROOT / path).read_text()) for key, path in PATHS.items()}

def json_bytes(data):
    return (json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode()

def blob_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

def read_tree():
    head = gh(f'repos/{REPO}/git/ref/heads/{BRANCH}')['object']['sha']
    commit = gh(f'repos/{REPO}/git/commits/{head}')
    tree = gh(f'repos/{REPO}/git/trees/{commit["tree"]["sha"]}?recursive=1')
    if tree.get('truncated'):
        raise ValueError('The repository is too large to check safely. Publishing stopped.')
    return head, commit['tree']['sha'], {entry['path']: entry for entry in tree['tree']}

def get_baseline():
    global BASELINE
    if BASELINE is not None:
        return BASELINE
    if STATE.exists():
        BASELINE = json.loads(STATE.read_text())['baseline']
    else:
        # Git blob hashes of the local starting files. An unknown remote edit
        # produces a conflict rather than being silently overwritten.
        BASELINE = {path: blob_sha((ROOT / path).read_bytes()) for path in PATHS.values()}
        STATE.write_text(json.dumps({'baseline': BASELINE}, indent=2))
    return BASELINE

def checked_path(path):
    target = ROOT / path
    if target.is_symlink() or any(p.is_symlink() for p in target.parents if p != ROOT.parent):
        raise ValueError('Symlink paths cannot be edited.')
    if not target.resolve().is_relative_to(ROOT):
        raise ValueError('Invalid content path.')
    return target

def validate(files):
    if not isinstance(files, dict) or set(files) != set(ENTRIES):
        raise ValueError('The editor must submit exactly the six configured content forms.')
    originals = local_files()
    def walk(value, initial, location):
        if isinstance(initial, dict):
            if not isinstance(value, dict) or set(value) != set(initial):
                raise ValueError(f'Unexpected fields in {location}. Reload the editor.')
            for k in initial:
                walk(value[k], initial[k], location + '.' + k)
        elif not isinstance(value, str) or len(value) > 100000:
            raise ValueError(f'Invalid text in {location}.')
        elif '.links.' in location:
            u = urlparse(value)
            if u.scheme != 'https' or not u.netloc or any(c in value for c in '\r\n\x00'):
                raise ValueError('External links must use a valid https:// address.')
        elif '.images.' in location and location.endswith('.src'):
            if not value.startswith('/assets/') or '..' in value or '\\' in value or '?' in value or '#' in value or any(ord(c) < 32 for c in value):
                raise ValueError('Choose an image from this website’s assets.')
            path = 'docs' + value
            if path.startswith('docs/assets/uploads/'):
                candidate = UPLOADS / Path(path).name
                published = ROOT / path
                if candidate.is_symlink() or published.is_symlink() or not candidate.is_file() and not published.is_file():
                    raise ValueError('An uploaded image is missing. Upload it again.')
            elif not checked_path(path).is_file():
                raise ValueError('The selected image does not exist.')
    for key in ENTRIES:
        walk(files[key], originals[key], key)
    if sum(len(json_bytes(v)) for v in files.values()) > 1024 * 1024:
        raise ValueError('The content is too large.')
    return files

def save(files):
    validate(files)
    get_baseline()
    for key, path in PATHS.items():
        target = checked_path(path)
        tmp = target.with_suffix('.json.tmp')
        tmp.write_bytes(json_bytes(files[key])); os.replace(tmp, target)

def publish(files):
    global BASELINE
    validate(files)
    baseline = get_baseline()
    head, base_tree, remote = read_tree()
    for path in PATHS.values():
        if remote.get(path, {}).get('sha') != baseline.get(path):
            raise RuntimeError('Website content changed on GitHub since this editor’s baseline. Publishing stopped to protect that edit. Resolve the remote/local differences before trying again.')
    entries = []
    newbaseline = dict(baseline)
    for key, path in PATHS.items():
        data = json_bytes(files[key])
        sha = blob_sha(data)
        newbaseline[path] = sha
        if sha != remote[path]['sha']:
            blob = gh(f'repos/{REPO}/git/blobs', 'POST', {'content': base64.b64encode(data).decode(), 'encoding': 'base64'})
            entries.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
    # Include only staged raster uploads referenced by the submitted content.
    for content in files.values():
        for image in content.get('images', {}).values():
            src = image['src']
            if not src.startswith('/assets/uploads/'):
                continue
            name = Path(src).name
            source = UPLOADS / name
            path = 'docs' + src
            if source.is_symlink():
                raise ValueError('Invalid upload path.')
            if source.is_file():
                data = source.read_bytes()
                if remote.get(path, {}).get('sha') == blob_sha(data):
                    continue
                blob = gh(f'repos/{REPO}/git/blobs', 'POST', {'content': base64.b64encode(data).decode(), 'encoding': 'base64'})
                entries.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
    if not entries:
        save(files)
        return {'ok': True, 'message': 'Your website is already up to date.', 'url': LIVE}
    entries = list({entry['path']: entry for entry in entries}.values())
    tree = gh(f'repos/{REPO}/git/trees', 'POST', {'base_tree': base_tree, 'tree': entries})
    commit = gh(f'repos/{REPO}/git/commits', 'POST', {'message': 'Update portfolio content', 'tree': tree['sha'], 'parents': [head]})
    # Non-force update rejects a concurrent push instead of overwriting it.
    gh(f'repos/{REPO}/git/refs/heads/{BRANCH}', 'PATCH', {'sha': commit['sha'], 'force': False})
    current = gh(f'repos/{REPO}/git/ref/heads/{BRANCH}')['object']['sha']
    if current != commit['sha']:
        raise RuntimeError('GitHub moved again after publishing. Check the repository before publishing another edit.')
    save(files)
    for content in files.values():
        for image in content.get('images', {}).values():
            src = image['src']
            if src.startswith('/assets/uploads/'):
                staged = UPLOADS / Path(src).name
                if staged.is_file() and not staged.is_symlink():
                    target = checked_path('docs' + src)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(staged.read_bytes())
    BASELINE = newbaseline
    STATE.write_text(json.dumps({'baseline': newbaseline}, indent=2))
    return {'ok': True, 'message': 'Published to GitHub. The live website will update when GitHub Pages finishes building, usually within a few minutes.', 'url': LIVE, 'commit': f'https://github.com/{REPO}/commit/{commit["sha"]}'}

def raster(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'): return 'png'
    if data.startswith(b'\xff\xd8\xff'): return 'jpg'
    if data.startswith((b'GIF87a', b'GIF89a')): return 'gif'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP': return 'webp'
    raise ValueError('Only PNG, JPEG, GIF and WebP images are accepted. SVG and executable files are not accepted.')

class Handler(BaseHTTPRequestHandler):
    server_version = 'LocalPortfolioEditor'
    def log_message(self, *_args): pass
    def setup(self):
        super().setup(); self.connection.settimeout(20)
    @property
    def origin(self): return f'http://127.0.0.1:{self.server.server_port}'
    def guard(self, mutation=False):
        if self.headers.get_all('Host') != [f'127.0.0.1:{self.server.server_port}']:
            raise PermissionError('Invalid host.')
        if self.path.startswith('/api/'):
            token = self.headers.get('X-Editor-Token', '')
            if not hmac.compare_digest(token, TOKEN): raise PermissionError('Reopen the editor using the launcher.')
        if mutation:
            if self.headers.get('Origin') != self.origin: raise PermissionError('Invalid request origin.')
            if self.headers.get('Content-Type') != 'application/json': raise PermissionError('JSON requests only.')
    def response(self, code, body, mime='application/json; charset=utf-8'):
        if isinstance(body, dict): body = json.dumps(body).encode()
        elif isinstance(body, str): body = body.encode()
        self.send_response(code)
        for key, value in {'Content-Type': mime, 'Content-Length': str(len(body)), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"}.items(): self.send_header(key, value)
        self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        try:
            self.guard()
            if self.path == '/':
                self.response(200, (ROOT / 'tools/editor-ui.html').read_bytes(), 'text/html; charset=utf-8')
            elif self.path == '/api/content':
                get_baseline()
                ok = authenticated()
                self.response(200, {'schema': SCHEMA, 'files': local_files(), 'status': {'authenticated': ok, 'repo': REPO, 'message': 'GitHub connected' if ok else 'Sign in once: run gh auth login in Terminal, then reload this editor.'}})
            elif self.path.startswith('/assets/'):
                known = {image['src'] for content in local_files().values() for image in content.get('images', {}).values()}
                staged = re.fullmatch(r'/assets/uploads/[a-f0-9]{32}\.(png|jpg|webp|gif)', self.path)
                if self.path not in known and not staged:
                    self.response(404, {'error': 'Not found.'}); return
                target = checked_path('docs' + self.path)
                if staged and not target.is_file(): target = UPLOADS / Path(self.path).name
                if not target.is_file() or target.is_symlink():
                    self.response(404, {'error': 'Not found.'}); return
                mime = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml'}.get(target.suffix.lower())
                if not mime:
                    self.response(404, {'error': 'Not found.'}); return
                self.response(200, target.read_bytes(), mime)
            else: self.response(404, {'error': 'Not found.'})
        except PermissionError as exc: self.response(403, {'error': str(exc)})
        except Exception: self.response(500, {'error': 'Could not load the local editor. Check your project files.'})
    def do_POST(self):
        acquired = False
        try:
            self.guard(True)
            lengths = self.headers.get_all('Content-Length') or []
            if len(lengths) != 1 or self.headers.get('Transfer-Encoding'): raise ValueError('Invalid request length.')
            size = int(lengths[0])
            if size < 1 or size > MAX_BODY: raise ValueError('Request is too large.')
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict): raise ValueError('Invalid request.')
            acquired = LOCK.acquire(blocking=False)
            if not acquired:
                self.response(409, {'error': 'Another save or publish is running. Please wait.'}); return
            if self.path in ('/api/save', '/api/publish'):
                if set(body) != {'files'}: raise ValueError('Unexpected fields.')
                if self.path == '/api/save':
                    save(body['files']); self.response(200, {'ok': True, 'message': 'Saved on this Mac. Click Publish to website when you’re ready.'})
                else:
                    self.response(200, publish(body['files']))
            elif self.path == '/api/upload':
                if set(body) != {'filename','mime','data'}: raise ValueError('Unexpected upload fields.')
                data = base64.b64decode(body['data'], validate=True)
                if len(data) > 10 * 1024 * 1024: raise ValueError('Choose an image smaller than 10 MB.')
                extension = raster(data)
                allowed = {'png': ('image/png', '.png'), 'jpg': ('image/jpeg', '.jpg', '.jpeg'), 'gif': ('image/gif', '.gif'), 'webp': ('image/webp', '.webp')}[extension]
                if body['mime'] != allowed[0] or Path(body['filename']).suffix.lower() not in allowed[1:]: raise ValueError('The image format does not match its filename.')
                name = secrets.token_hex(16) + '.' + extension
                UPLOADS.mkdir(exist_ok=True)
                (UPLOADS / name).write_bytes(data)
                self.response(200, {'path': '/assets/uploads/' + name})
            else: self.response(404, {'error': 'Not found.'})
        except PermissionError as exc: self.response(403, {'error': str(exc)})
        except RuntimeError as exc: self.response(409, {'error': str(exc)})
        except (ValueError, TypeError, KeyError) as exc: self.response(400, {'error': str(exc)})
        except Exception: self.response(500, {'error': 'The operation failed. Your local draft is still available.'})
        finally:
            if acquired: LOCK.release()
    def do_OPTIONS(self): self.response(405, {'error': 'Not allowed.'})

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    server.daemon_threads = True
    url = f'http://127.0.0.1:{server.server_port}/#{TOKEN}'
    print('Local website editor is running. Close this Terminal window to stop it.', flush=True)
    webbrowser.open(url)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()
