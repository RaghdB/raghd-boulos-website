#!/usr/bin/env python3
"""Package the GitHub-only visual builder; no build tooling is needed at runtime."""
import base64,hashlib,re
from pathlib import Path
root=Path(__file__).resolve().parent.parent
html=(root/'tools/builder-ui.html').read_text()
api=(root/'tools/builder-api.js').read_text()
api=re.sub(r'</script',lambda _: '<\\/script',api,flags=re.I)
html=html.replace('<script src="vendor/grapes.min.js"></script>','<script>'+api+'</script>\n<script src="vendor/grapes.min.js"></script>',1)
vendor=root/'docs/admin/vendor'
js_hash=base64.b64encode(hashlib.sha384((vendor/'grapes.min.js').read_bytes()).digest()).decode()
css_hash=base64.b64encode(hashlib.sha384((vendor/'grapes.min.css').read_bytes()).digest()).decode()
html=html.replace('<script src="vendor/grapes.min.js">',f'<script src="vendor/grapes.min.js" integrity="sha384-{js_hash}" crossorigin="anonymous">')
html=html.replace('<link rel="stylesheet" href="vendor/grapes.min.css">',f'<link rel="stylesheet" href="vendor/grapes.min.css" integrity="sha384-{css_hash}" crossorigin="anonymous">')
hashes=["'sha256-"+base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()+"'" for s in re.findall(r'<script>(.*?)</script>',html,re.S)]
policy="default-src 'none'; script-src 'self' "+' '.join(hashes)+"; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' blob: data:; connect-src 'self' https://api.github.com; frame-src 'self' about: https://cdn.embedly.com; object-src 'none'; base-uri 'none'; form-action 'none'"
html=html.replace('<meta charset="utf-8">','<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+policy+'"><meta name="robots" content="noindex,nofollow">',1)
(root/'docs/admin/index.html').write_text(html)
print('Packaged Portfolio Studio with pinned local vendor assets and CSP.')
