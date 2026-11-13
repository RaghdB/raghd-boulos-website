/* GitHub-only publishing transport. Credentials live only in this closure. */
(() => {
  'use strict';
  if (window.top !== window.self) throw new Error('Open the website editor in its own browser tab.');
  const REPO = 'RaghdB/raghd-boulos-website';
  const LIVE = 'https://raghdb.github.io/raghd-boulos-website/';
  const PATHS = Object.freeze({shared:'docs/_data/shared.json', architecture:'docs/_data/architecture.json', home:'docs/_data/home.json', interaction_design:'docs/_data/interaction_design.json', prototyping:'docs/_data/prototyping.json', visual_design:'docs/_data/visual_design.json'});
  const NAMES = Object.keys(PATHS);
  const encoder = new TextEncoder();
  const generated = /^\/assets\/uploads\/[a-f0-9]{32}\.(png|jpg|gif|webp)$/;
  const uploads = new Map();
  const previews = new Map();
  let credential = null, schema, initial, files, baseline, originalAssets, busy = false, restored = false, connectionVersion = 0;
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const sameKeys = (a, b) => object(a) && object(b) && Object.keys(a).length === Object.keys(b).length && Object.keys(b).every(key => Object.prototype.hasOwnProperty.call(a, key));
  const canonical = value => object(value) ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
  const equal = (a,b) => canonical(a) === canonical(b);
  const dataJSON = value => encoder.encode(JSON.stringify(value, null, 2) + '\n');
  const imagePaths = value => new Set(Object.values(value).flatMap(content => Object.values(content.images || {}).map(image => image.src)));
  const problem = message => new Error(message);

  async function snapshot(name) {
    const url = new URL(name, window.location.href);
    if (url.origin !== window.location.origin) throw problem('Invalid editor configuration.');
    const response = await fetch(url, {redirect:'error', cache:'no-store', credentials:'same-origin', referrerPolicy:'no-referrer'});
    if (!response.ok) throw problem('Could not load the website editor files. Reload this page.');
    return response.json();
  }

  function database() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(problem('This browser cannot save drafts. Use a browser with IndexedDB enabled.')); return; }
      const request = indexedDB.open('raghd-portfolio-editor', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(problem('Could not open draft storage. Enable website storage in this browser.'));
      request.onblocked = () => reject(problem('Close other editor tabs, then try saving again.'));
    });
  }

  async function storedDraft(value, writing = false) {
    const db = await database();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction('drafts', writing ? 'readwrite' : 'readonly');
        const store = transaction.objectStore('drafts');
        const request = writing ? store.put(value, 'portfolio') : store.get('portfolio');
        let result;
        request.onsuccess = () => { result = request.result; };
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = transaction.onabort = () => reject(problem('Could not save the draft and images. Check browser storage space and try again. Keep this tab open.'));
      });
    } finally { db.close(); }
  }

  function raster(bytes) {
    const u = new Uint8Array(bytes);
    const begins = signature => signature.every((n,i) => u[i] === n);
    if (begins([137,80,78,71,13,10,26,10])) return ['png','image/png'];
    if (begins([255,216,255])) return ['jpg','image/jpeg'];
    if (begins([71,73,70,56,55,97]) || begins([71,73,70,56,57,97])) return ['gif','image/gif'];
    if (u.length >= 12 && begins([82,73,70,70]) && u[8]===87 && u[9]===69 && u[10]===66 && u[11]===80) return ['webp','image/webp'];
    throw problem('Choose a PNG, JPEG, GIF or WebP image. SVG uploads are not supported.');
  }

  function safeImage(src) {
    if (typeof src !== 'string' || !src.startsWith('/assets/') || /[\\%?#\x00-\x1f\x7f]/.test(src) || src.includes('..')) throw problem('Choose an existing website image or upload a new image.');
    if (originalAssets.has(src)) return;
    if (generated.test(src) && uploads.has(src)) return;
    throw problem('An image is missing. Upload it again.');
  }

  function validate(value) {
    if (!sameKeys(value, PATHS)) throw problem('Submit all six website content forms. Reload the editor.');
    function walk(next, original, location) {
      if (object(original)) {
        if (!sameKeys(next, original)) throw problem('Unexpected fields in ' + location + '. Reload the editor.');
        Object.keys(original).forEach(key => walk(next[key], original[key], location + '.' + key));
        return;
      }
      if (typeof original !== 'string' || typeof next !== 'string' || next.length > 100000) throw problem('Invalid text in ' + location + '.');
      if (location.includes('.links.')) {
        let url;
        try { url = new URL(next); } catch (_) { throw problem('External links must use a valid https:// address.'); }
        if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || /[\s\x00-\x1f\x7f]/.test(next)) throw problem('External links must use a valid https:// address.');
      }
      if (location.includes('.images.') && location.endsWith('.src')) safeImage(next);
    }
    NAMES.forEach(name => walk(value[name], initial[name], name));
    if (NAMES.reduce((size,name) => size + dataJSON(value[name]).length, 0) > 1024*1024) throw problem('The content is too large. Shorten the text and try again.');
  }

  function draftRecord(next, nextBaseline) {
    const used = imagePaths(next);
    return {version:1, files:copy(next), baseline:copy(nextBaseline), uploads:[...uploads].filter(([path]) => used.has(path)).map(([path, value]) => ({path, bytes:value.bytes.slice(0), mime:value.mime}))};
  }

  function checkConfiguration(nextSchema, nextFiles) {
    if (!sameKeys(nextFiles, PATHS) || !Array.isArray(nextSchema.content) || nextSchema.content.length !== NAMES.length || new Set(nextSchema.content.map(entry=>entry.name)).size !== NAMES.length || nextSchema.content.some(entry=>!NAMES.includes(entry.name) || PATHS[entry.name] !== entry.path)) throw problem('The editor configuration is invalid.');
  }

  async function initialize() {
    const loaded = await Promise.all([snapshot('schema.json'), snapshot('content.json')]);
    schema = loaded[0];
    initial = loaded[1].files;
    checkConfiguration(schema, initial);
    files = copy(initial);
    baseline = copy(initial);
    originalAssets = imagePaths(initial);
    let saved;
    try { saved = await storedDraft(); }
    catch (_) { /* Reading a draft is optional; explicit saves still report storage errors. */ }
    if (saved) {
      if (saved.version !== 1 || !sameKeys(saved.baseline, PATHS) || !Array.isArray(saved.uploads)) throw problem('The saved draft is invalid. Keep a backup before clearing this site’s browser storage.');
      for (const upload of saved.uploads) {
        if (!generated.test(upload.path) || !(upload.bytes instanceof ArrayBuffer) || upload.bytes.byteLength > 10*1024*1024) throw problem('A saved draft image is invalid.');
        const [ext,mime] = raster(upload.bytes);
        if (mime !== upload.mime || !upload.path.endsWith('.' + ext)) throw problem('A saved draft image is invalid.');
        uploads.set(upload.path, {bytes:upload.bytes, mime});
      }
      // A published baseline may reference uploads not in the latest deployed snapshot.
      for (const src of imagePaths(saved.baseline)) if (generated.test(src)) originalAssets.add(src);
      validate(saved.baseline);
      validate(saved.files);
      files = copy(saved.files);
      baseline = copy(saved.baseline);
      restored = true;
    }
    validate(files);
  }

  // Opening the public login page must not load content or read browser drafts.
  let ready = null;
  function ensureReady() {
    requireConnection();
    if (!ready) ready = initialize();
    return ready;
  }

  function requireConnection() {
    if (!credential) throw problem('Connect the RaghdB GitHub account before opening the editor.');
  }

  async function api(route, method='GET', body=null, auth=credential) {
    if (typeof auth !== 'string' || !/^github_pat_[A-Za-z0-9_]{20,240}$/.test(auth)) throw problem('Connect GitHub with a fine-grained personal access token before publishing.');
    if (typeof route !== 'string' || !/^[A-Za-z0-9_/?=.-]+$/.test(route) || route.includes('..') || route.startsWith('/')) throw problem('Invalid GitHub request.');
    const url = new URL('https://api.github.com/' + route);
    if (url.protocol !== 'https:' || url.hostname !== 'api.github.com') throw problem('Invalid GitHub request.');
    let response;
    try {
      response = await fetch(url, {method, redirect:'error', credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer', headers:{'Authorization':'Bearer ' + auth, 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', ...(body ? {'Content-Type':'application/json'} : {})}, ...(body ? {body:JSON.stringify(body)} : {})});
    } catch (_) { throw problem('GitHub could not be reached. Your draft is safe. Check your internet connection and try again.'); }
    if (!response.ok) {
      if (response.status === 401) {
        credential = null;
        ++connectionVersion;
        for (const url of previews.values()) URL.revokeObjectURL(url);
        previews.clear();
        throw problem('The GitHub token is invalid or expired. Connect GitHub again.');
      }
      if (response.status === 403) throw problem('GitHub denied access. Check the token’s repository permissions, or wait if GitHub is limiting requests.');
      if (response.status === 404) throw problem('Give the token access to RaghdB/raghd-boulos-website and Contents read and write permission.');
      if (response.status === 409 || response.status === 422) throw problem('The website changed on GitHub while publishing. Nothing was force-pushed. Review remote changes before trying again.');
      throw problem('GitHub could not finish the request (HTTP ' + response.status + '). Your draft is safe.');
    }
    let result;
    try {
      const text = await response.text();
      if (text.length > 32*1024*1024) throw problem('Large response');
      result = JSON.parse(text);
    } catch (_) { throw problem('GitHub returned an unexpected response. Publishing stopped safely.'); }
    if (!object(result)) throw problem('GitHub returned an unexpected response.');
    return result;
  }

  async function verify(auth) {
    const user = await api('user', 'GET', null, auth);
    if (user.login !== 'RaghdB') throw problem('Connect the RaghdB GitHub account that owns this website.');
    const repo = await api('repos/' + REPO, 'GET', null, auth);
    if (repo.full_name !== REPO) throw problem('This token cannot access the website repository.');
    if (repo.permissions && repo.permissions.push === false) throw problem('Allow Contents read and write access to this website repository.');
  }

  window.websiteEditorConnect = async token => {
    if (busy) throw problem('Wait for the current save or publish to finish.');
    if (!token) return window.websiteEditorDisconnect();
    if (typeof token !== 'string' || !/^github_pat_[A-Za-z0-9_]{20,240}$/.test(token)) throw problem('Use a fine-grained GitHub personal access token beginning with github_pat_.');
    const version = ++connectionVersion;
    credential = null;
    await verify(token);
    if (connectionVersion !== version) throw problem('This connection attempt was cancelled.');
    credential = token;
    return {state:'connected', message:'GitHub connected. You can now publish.'};
  };

  window.websiteEditorDisconnect = () => {
    if (busy) throw problem('Wait for the current save or publish to finish.');
    ++connectionVersion;
    credential = null;
    for (const url of previews.values()) URL.revokeObjectURL(url);
    previews.clear();
    return {state:'idle', message:'Disconnected. The token has been forgotten.'};
  };

  window.websiteEditorImagePreview = src => {
    if (!credential) return '';
    if (uploads.has(src)) {
      if (!previews.has(src)) {
        const value = uploads.get(src);
        previews.set(src, URL.createObjectURL(new Blob([value.bytes], {type:value.mime})));
      }
      return previews.get(src);
    }
    if (typeof src !== 'string' || !src.startsWith('/assets/') || /[\\%?#\x00-\x1f\x7f]/.test(src) || src.includes('..')) return '';
    return new URL('../' + src.slice(1), window.location.href).href;
  };

  function sha(value) {
    if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value)) throw problem('GitHub returned an invalid revision. Publishing stopped safely.');
    return value;
  }

  function base64(bytes) {
    const data = new Uint8Array(bytes);
    let value = '';
    for (let i=0; i<data.length; i+=0x8000) value += String.fromCharCode(...data.subarray(i,i+0x8000));
    return btoa(value);
  }

  function unbase64(encoded) {
    const clean = encoded.replace(/\s/g,'');
    if (clean.length > 2*1024*1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw problem('GitHub returned an invalid content file.');
    let decoded;
    try { decoded = atob(clean); } catch (_) { throw problem('GitHub returned an invalid content file.'); }
    return Uint8Array.from(decoded, c => c.charCodeAt(0));
  }

  async function blobSHA(bytes) {
    const data = new Uint8Array(bytes);
    const header = encoder.encode('blob ' + data.byteLength + '\0');
    const combined = new Uint8Array(header.length + data.length);
    combined.set(header); combined.set(data,header.length);
    const digest = await crypto.subtle.digest('SHA-1',combined);
    return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
  }

  async function uploadBlob(bytes, auth) {
    const blob = await api('repos/' + REPO + '/git/blobs', 'POST', {content:base64(bytes), encoding:'base64'}, auth);
    return sha(blob.sha);
  }

  async function publish(next) {
    validate(next);
    const auth = credential;
    if (!auth) throw problem('Connect GitHub before publishing.');
    // Commit the entire draft and pending image bytes to browser storage first.
    await storedDraft(draftRecord(next, baseline), true);
    files = copy(next);
    await verify(auth);
    const prefix = 'repos/' + REPO + '/git/';
    const ref = await api(prefix + 'ref/heads/main', 'GET', null, auth);
    const head = sha(ref.object && ref.object.sha);
    const commit = await api(prefix + 'commits/' + head, 'GET', null, auth);
    const baseTree = sha(commit.tree && commit.tree.sha);
    const tree = await api(prefix + 'trees/' + baseTree + '?recursive=1', 'GET', null, auth);
    if (tree.truncated || !Array.isArray(tree.tree)) throw problem('The repository could not be checked completely. Publishing stopped safely.');
    const remote = new Map(tree.tree.map(entry => [entry.path,entry]));
    const current = {};
    for (const name of NAMES) {
      const entry = remote.get(PATHS[name]);
      if (!entry || entry.type !== 'blob' || entry.mode !== '100644') throw problem('Website content changed on GitHub. Publishing stopped to protect that edit. Review the remote and local differences.');
      const blob = await api(prefix + 'blobs/' + sha(entry.sha), 'GET', null, auth);
      let parsed;
      try {
        if (blob.encoding !== 'base64' || typeof blob.content !== 'string') throw problem('Invalid content');
        parsed = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(unbase64(blob.content)));
      } catch (_) { throw problem('A website content file on GitHub is invalid. Publishing stopped safely.'); }
      if (!equal(parsed, baseline[name])) throw problem('Website content changed on GitHub since this draft began. Publishing stopped to protect that edit. Review the remote and local differences before publishing.');
      current[name] = parsed;
    }
    const entries = [];
    for (const name of NAMES) if (!equal(current[name],next[name])) entries.push({path:PATHS[name],mode:'100644',type:'blob',sha:await uploadBlob(dataJSON(next[name]), auth)});
    for (const src of [...imagePaths(next)].sort()) {
      if (!generated.test(src) || !uploads.has(src)) continue;
      const value = uploads.get(src);
      const entry = remote.get('docs' + src);
      const checksum = await blobSHA(value.bytes);
      if (entry) {
        if (entry.type !== 'blob' || entry.mode !== '100644' || entry.sha !== checksum) throw problem('An uploaded image conflicts with a file on GitHub. Upload it again to create a new image.');
        continue;
      }
      entries.push({path:'docs' + src, mode:'100644',type:'blob',sha:await uploadBlob(value.bytes, auth)});
    }
    let revision = null;
    if (entries.length) {
      const newTree = await api(prefix + 'trees', 'POST', {base_tree:baseTree,tree:entries}, auth);
      const newCommit = await api(prefix + 'commits', 'POST', {message:'Update portfolio content', tree:sha(newTree.sha), parents:[head]}, auth);
      revision = sha(newCommit.sha);
      await api(prefix + 'refs/heads/main', 'PATCH', {sha:revision,force:false}, auth);
    }
    baseline = copy(next);
    try { await storedDraft(draftRecord(next, baseline), true); }
    catch (_) { throw problem('GitHub accepted the website update, but this browser could not save the updated publishing history. Keep this tab open and save the draft again before reloading.'); }
    return {ok:true, url:LIVE, ...(revision ? {commit:'https://github.com/' + REPO + '/commit/' + revision} : {}), message:revision ? 'Published to GitHub. The live website will update when GitHub Pages finishes building, usually within a few minutes.' : 'Your website is already up to date.'};
  }

  async function resetDraft() {
    // This also recovers from an invalid saved draft; wait for boot to settle first.
    await ensureReady().catch(() => {});
    const loaded = await Promise.all([snapshot('schema.json'), snapshot('content.json')]);
    checkConfiguration(loaded[0], loaded[1].files);
    const previous = {schema,initial,files,baseline,originalAssets};
    try {
      schema = loaded[0];
      initial = copy(loaded[1].files);
      originalAssets = imagePaths(initial);
      validate(initial);
      await storedDraft({version:1,files:copy(initial),baseline:copy(initial),uploads:[]},true);
      files = copy(initial); baseline = copy(initial); restored = false;
      uploads.clear();
      for (const url of previews.values()) URL.revokeObjectURL(url);
      previews.clear();
      ready = Promise.resolve();
      return {ok:true,files:copy(files),message:'The saved draft was discarded. The current deployed website content is loaded.'};
    } catch (error) {
      ({schema,initial,files,baseline,originalAssets} = previous);
      throw error;
    }
  }

  window.websiteEditorApi = async (path, body=null) => {
    if (path === '/api/connection' && body === null) return {state:credential?'connected':'idle', message:credential?'GitHub connected.':'Connect GitHub to publish.'};
    requireConnection();
    if (path === '/api/reset') {
      if (!sameKeys(body,{})) throw problem('Unexpected request fields.');
      if (busy) throw problem('Another save or publish is running. Please wait.');
      busy = true;
      try { return await resetDraft(); } finally { busy = false; }
    }
    await ensureReady();
    // A disconnect may have happened while the snapshots or draft were loading.
    requireConnection();
    if (path === '/api/content' && body === null) return {schema:copy(schema),files:copy(files),status:{authenticated:!!credential,repo:REPO,draftRestored:restored,message:restored ? 'Your saved draft and images were restored in this browser.' : 'Connect GitHub to publish. Drafts are saved only in this browser.'}};
    if (busy) throw problem('Another save or publish is running. Please wait.');
    busy = true;
    try {
      if (path === '/api/save' || path === '/api/publish') {
        if (!sameKeys(body,{files:null})) throw problem('Unexpected request fields.');
        const next = copy(body.files);
        validate(next);
        if (path === '/api/publish') return await publish(next);
        await storedDraft(draftRecord(next,baseline),true);
        files = next;
        return {ok:true,message:'Saved in this browser, including uploaded images. Click Publish to website when you’re ready.'};
      }
      if (path === '/api/upload') {
        if (!sameKeys(body,{filename:null,mime:null,data:null}) || typeof body.filename !== 'string' || typeof body.mime !== 'string' || typeof body.data !== 'string' || body.data.length > 14*1024*1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.data)) throw problem('Invalid image upload.');
        let bytes;
        try { const value = atob(body.data); bytes = Uint8Array.from(value,c=>c.charCodeAt(0)); } catch (_) { throw problem('Invalid image upload.'); }
        if (!bytes.length || bytes.length > 10*1024*1024) throw problem('Choose an image smaller than 10 MB.');
        const [ext,mime] = raster(bytes);
        const suffix = body.filename.split('.').pop().toLowerCase();
        if (body.mime !== mime || (suffix !== ext && !(ext==='jpg' && suffix==='jpeg'))) throw problem('The image format does not match its filename.');
        const key = [...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('');
        const src = '/assets/uploads/' + key + '.' + ext;
        uploads.set(src,{bytes:bytes.buffer,mime});
        return {path:src};
      }
      throw problem('Unknown editor request.');
    } finally { busy = false; }
  };
})();
