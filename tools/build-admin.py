#!/usr/bin/env python3
"""Package the dependency-free public editor. Development helper, not a runtime dependency."""
import base64,hashlib,re,shutil
from pathlib import Path
root=Path(__file__).resolve().parent.parent
html=(root/'tools/editor-ui.html').read_text()
api=(root/'tools/github-editor-api.js').read_text()
assert '</script' not in api.lower()
html=html.replace('<script>', '<script>'+api+'</script>\n<script>',1)
# CSP hashes cover only packaged, trusted scripts and styles. No CDN or eval.
values={}
for tag in ('script','style'):
 values[tag]=["'sha256-"+base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()+"'" for s in re.findall('<'+tag+r'>(.*?)</'+tag+'>',html,re.S)]
policy="default-src 'none'; script-src "+' '.join(values['script'])+"; style-src "+' '.join(values['style'])+"; connect-src 'self' https://api.github.com; img-src 'self' blob: data:; object-src 'none'; base-uri 'none'; form-action 'none'"
html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',html)
html=html.replace('<meta charset="utf-8">','<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+policy+'"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow">',1)
assert not re.search(r'\sstyle=',html)
admin=root/'docs/admin';admin.mkdir(exist_ok=True)
(admin/'index.html').write_text(html)
shutil.copyfile(root/'tools/editor-schema.json',admin/'schema.json')
keys=['shared','home','visual_design','interaction_design','architecture','prototyping']
body=',\n'.join('  "'+k+'": {{ site.data.'+k+' | jsonify }}' for k in keys)
(admin/'content.json').write_text('---\nlayout: null\n---\n{ "files": {\n'+body+'\n} }\n')
print('Packaged browser editor with strict script/style hashes.')
