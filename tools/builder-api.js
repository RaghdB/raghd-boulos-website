/* No services, runtimes, or credentials outside GitHub and this browser session. */
(() => {
  'use strict';
  if (window.top !== window.self) throw new Error('Open the website builder in its own browser tab.');
  const REPO='RaghdB/raghd-boulos-website', BASE='/raghd-boulos-website/', PROJECT='docs/admin/builder-project.json';
  const DEFINITIONS=[
    ['home','About / home','docs/index.html','661e9c7f28757519ad027cc3',''],
    ['visual_design','Visual design','docs/visual-design/index.html','661ee5427576a66ad05a9bc2','visual-design/'],
    ['interaction_design','Interaction design','docs/interaction-design/index.html','661fe396ed17359e8e6f36fa','interaction-design/'],
    ['architecture','Architecture','docs/architecture/index.html','661fe59759381a47898511b3','architecture/'],
    ['prototyping','Prototyping','docs/prototyping/index.html','6620475e20fffe115b4a72e3','prototyping/']
  ];
  const DATA=['shared','home','visual_design','interaction_design','architecture','prototyping'];
  const TRACKED=[...DEFINITIONS.map(p=>p[2]),...DATA.map(n=>'docs/_data/'+n+'.json'),PROJECT];
  const OUTLINE='.wf-force-outline-none[tabindex="-1"]:focus{outline:none;}';
  const CSS=BASE+'assets/raghdboulos.webflow.30e67bcab-02df00ad.css';
  const SCRIPTS=Object.freeze([
    {src:BASE+'assets/jquery-3.5.1.min.dc5e7f18c8.js',integrity:'sha256-9/aliU8dGd2tb6OSsuzixeV4y/faTqgFtohetphbbj0=',crossorigin:'anonymous'},
    {src:BASE+'assets/webflow.a5132c13f.js',integrity:'sha256-mxjHt/UrLmzRx+qQDGp3fiJWGhxclmQFL+ZSWQOfQxI=',crossorigin:'anonymous'}
  ]);
  const TOUCH='!function(o,c){var n=c.documentElement,t=" w-mod-";n.className+=t+"js",("ontouchstart"in o||o.DocumentTouch&&c instanceof DocumentTouch)&&(n.className+=t+"touch")}(window,document);';
  const EMBED='https://cdn.embedly.com/widgets/media.html?src=https%3A%2F%2Fplayer.vimeo.com%2Fvideo%2F936007252%3Fapp_id%3D122963&dntp=1&display_name=Vimeo&url=https%3A%2F%2Fvimeo.com%2F936007252&image=https%3A%2F%2Fi.vimeocdn.com%2Fvideo%2F1835907043-6549528bdcae514a3b36de0f2e9633f8c345b49836a0ba31d7e98c25a1745069-d_640&key=c4e54deccf4d4ec997a64902e9a30300&type=text%2Fhtml&schema=vimeo';
  const TAGS=new Set('a abbr address article aside b blockquote br button caption code col colgroup dd del details div dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i iframe img label li main mark nav ol p picture pre s section small source span strong sub summary sup table tbody td th thead time tr u ul video'.split(' '));
  const ATTRS=new Set('id class title role tabindex alt width height loading decoding colspan rowspan scope datetime controls autoplay muted loop playsinline preload type sizes'.split(' '));
  const encoder=new TextEncoder(), decoder=new TextDecoder('utf-8',{fatal:true});
  const uploads=new Map(), previews=new Map();
  let token=null, generation=0, busy=false, loading=null, model=null, baseline=null, knownAssets=new Set(), draftRestored=false;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const keys=(value,list)=>object(value)&&Object.keys(value).length===list.length&&list.every(k=>Object.prototype.hasOwnProperty.call(value,k));
  const error=message=>new Error(message);
  const json=value=>encoder.encode(JSON.stringify(value,null,2)+'\n');
  const sha=value=>{if(typeof value!=='string'||!/^[a-f0-9]{40}$/.test(value))throw error('GitHub returned an invalid revision. Publishing stopped safely.');return value;};
  const requireAuth=()=>{if(!token)throw error('Connect the RaghdB GitHub account before opening the builder.');};
  function clearToken(){
    token=null;++generation;
    for(const url of previews.values())URL.revokeObjectURL(url);
    previews.clear();uploads.clear();
    loading=null;model=null;baseline=null;knownAssets=new Set();draftRestored=false;
  }
  function assetList(){return [...knownAssets].filter(src=>normalizedAsset(src)===src&&/\.(png|jpe?g|gif|webp|svg)$/i.test(src)).sort().map(src=>({type:'image',src,name:src.split('/').pop()}));}
  function metadata(definition,title){return {title,htmlAttrs:{class:'','data-wf-domain':'raghdb.github.io','data-wf-page':definition[3],'data-wf-site':'64c4be4867694090d91bb285'},bodyAttrs:{class:'body-3'},styles:[CSS],scripts:clone(SCRIPTS)};}
  function normalizedAsset(value){
    if(typeof value!=='string'||!/^[A-Za-z0-9_./-]+$/.test(value)||value.includes('..'))return null;
    if(value.startsWith('/assets/'))value=BASE+value.slice(1);
    if(!value.startsWith(BASE+'assets/'))return null;
    return value;
  }
  const generated=src=>new RegExp('^'+BASE+'assets/uploads/[a-f0-9]{32}\\.(png|jpg|gif|webp)$').test(src);
  function asset(value,images=false){
    const src=normalizedAsset(value);
    if(!src||(!knownAssets.has(src)&&!uploads.has(src)))throw error('Choose an existing website asset or upload a new image.');
    if(images&&!/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(src))throw error('Choose an image file.');
    return src;
  }
  function resolved(value,definition){
    if(typeof value!=='string'||/[\x00-\x20\x7f\\]/.test(value))return null;
    try{return new URL(value,'https://raghdb.github.io'+BASE+definition[4]);}catch(_){return null;}
  }
  function localAsset(value,definition,images=false){
    const url=resolved(value,definition);
    if(!url||url.origin!=='https://raghdb.github.io'||url.search||url.hash)throw error('Images and CSS resources must use this website’s assets.');
    return asset(url.pathname,images);
  }
  function link(value,definition){
    const url=resolved(value,definition);
    if(!url||url.username||url.password)return '#';
    if(url.protocol==='mailto:'||url.protocol==='tel:')return url.href;
    if(url.protocol!=='https:')return '#';
    if(url.origin!=='https://raghdb.github.io')return url.href;
    const allowed=DEFINITIONS.map(p=>BASE+p[4]);
    if(!allowed.includes(url.pathname)&&!allowed.map(p=>p+'index.html').includes(url.pathname))return '#';
    return url.pathname+url.search+url.hash;
  }
  function sanitizeCSS(value,definition){
    if(typeof value!=='string'||value.length>1024*1024)throw error('The page CSS is too large or invalid.');
    // Escapes and comments cannot hide network functions or style-tag boundaries.
    if(/[\\\x00-\x08\x0b\x0c\x0e-\x1f\x7f<]/.test(value))throw error('CSS contains unsupported characters.');
    let css=value.replace(/\/\*[\s\S]*?\*\//g,'');
    if(/@|expression\s*\(|javascript\s*:|behavior\s*:|-moz-binding|image-set\s*\(|-webkit-image-set\s*\(/i.test(css.replace(/@(media|supports|container|keyframes|-webkit-keyframes)\b/gi,'')))throw error('CSS imports and executable or external resources are not supported.');
    css=css.replace(/url\(\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^)'"\s]+))\s*\)/gi,(_,a,b,c)=>'url("'+localAsset(a??b??c,definition)+'")');
    if(/url\s*\(/i.test(css.replace(/url\("[^"\n]+"\)/g,'')))throw error('Invalid CSS resource.');
    return css;
  }
  function sanitizeHTML(value,definition){
    if(typeof value!=='string'||value.length>2*1024*1024)throw error('The page content is too large or invalid.');
    const doc=new DOMParser().parseFromString('<!doctype html><html><body>'+value+'</body></html>','text/html');
    for(const node of [...doc.body.querySelectorAll('*')]){
      if(!TAGS.has(node.localName)){node.remove();continue;}
      if(node.namespaceURI!=='http://www.w3.org/1999/xhtml'){node.remove();continue;}
      const original=[...node.attributes];
      for(const attribute of original){
        const name=attribute.name.toLowerCase(), v=attribute.value;
        if(ATTRS.has(name)||/^aria-[a-z-]+$/.test(name)||/^data-(?:wf|w)-[a-z0-9-]+$/.test(name)){
          if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v)||v.length>10000)node.removeAttribute(attribute.name);
          continue;
        }
        node.removeAttribute(attribute.name);
      }
      const attribute=name=>original.find(a=>a.name.toLowerCase()===name)?.value;
      if(attribute('style'))node.setAttribute('style',sanitizeCSS(attribute('style'),definition));
      if(node.localName==='a'){node.setAttribute('href',link(attribute('href')||'#',definition));node.setAttribute('rel','noopener noreferrer');if(attribute('target')==='_blank')node.setAttribute('target','_blank');}
      if(node.localName==='button')node.setAttribute('type','button');
      if(node.localName==='img'||node.localName==='source'){
        if(attribute('src'))node.setAttribute('src',localAsset(attribute('src'),definition,true));
        if(attribute('srcset')){
          const candidates=attribute('srcset').split(',').map(item=>{
            const match=item.trim().match(/^(\S+)(?:\s+(\d+(?:\.\d+)?[wx]))?$/);
            if(!match)throw error('Invalid responsive image.');
            return localAsset(match[1],definition,true)+(match[2]?' '+match[2]:'');
          });
          node.setAttribute('srcset',candidates.join(', '));
        }
      }
      if(node.localName==='video'){
        if(attribute('src'))node.setAttribute('src',localAsset(attribute('src'),definition));
        if(attribute('poster'))node.setAttribute('poster',localAsset(attribute('poster'),definition,true));
      }
      if(node.localName==='iframe'){
        if(attribute('src')!==EMBED){node.remove();continue;}
        node.setAttribute('src',EMBED);node.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');
        node.setAttribute('allow','fullscreen');node.setAttribute('allowfullscreen','');node.setAttribute('referrerpolicy','no-referrer');
      }
    }
    return doc.body.innerHTML;
  }
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderLiquid(source,data){
    // Published static pages have no frontmatter and must never be reinterpreted as Liquid.
    if(!/^---\s*\n/.test(source))return source;
    let html=source.replace(/^---\s*\nlayout:\s*null\s*\n---\s*\n/,'');
    const get=path=>{
      const parts=path.split('.');let value=data;
      for(const key of parts){if(!object(value)||!Object.prototype.hasOwnProperty.call(value,key))throw error('An original page references missing content.');value=value[key];}
      if(typeof value!=='string')throw error('Unsupported original page content.');return value;
    };
    html=html.replace(/{%\s*assign safe_link = site\.data\.([a-z0-9_.]+) \| slice: 0, 8\s*%}{%\s*if safe_link == 'https:\/\/'\s*%}([\s\S]*?){%\s*else\s*%}#{%\s*endif\s*%}/g,(_,path,yes)=>get(path).startsWith('https://')?yes:'#');
    html=html.replace(/{{\s*site\.data\.([a-z0-9_.]+)((?:\s*\|\s*[a-z_]+)*)\s*}}/g,(_,path,filters)=>{
      let value=get(path);
      const list=filters.split('|').map(x=>x.trim()).filter(Boolean);
      if(!list.length||list.some(x=>!['escape','newline_to_br','relative_url'].includes(x)))throw error('This page contains an unsupported template filter.');
      for(const filter of list){if(filter==='escape')value=escape(value);else if(filter==='newline_to_br')value=value.replace(/\r?\n/g,'<br />\n');else if(filter==='relative_url')value=value.startsWith('/assets/')?BASE+value.slice(1):value;}
      return value;
    });
    if(/{[{%]|[%}]}/.test(html))throw error('This page uses unsupported Liquid. Publishing stopped to preserve the original source.');
    return html;
  }
  function sanitizePages(value){
    if(!Array.isArray(value)||value.length!==DEFINITIONS.length||new Set(value.map(p=>p?.id)).size!==DEFINITIONS.length)throw error('The builder must include the five configured pages.');
    const pages=DEFINITIONS.map(definition=>{
      const page=value.find(p=>p?.id===definition[0]);
      if(!keys(page,['id','name','html','css','meta'])||typeof page.name!=='string'||page.name.length>100||!object(page.meta)||typeof page.meta.title!=='string'||page.meta.title.length>500)throw error('Invalid page data.');
      return {id:definition[0],name:page.name,html:sanitizeHTML(page.html,definition),css:sanitizeCSS(page.css,definition),meta:metadata(definition,page.meta.title)};
    });
    if(json(pages).length>8*1024*1024)throw error('The builder project is too large.');
    return pages;
  }
  function exported(page){
    const attrs=value=>Object.entries(value).map(([key,v])=>' '+key+'="'+escape(v)+'"').join('');
    return '<!DOCTYPE html>\n<html'+attrs(page.meta.htmlAttrs)+'><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+escape(page.meta.title)+'</title><link rel="stylesheet" href="'+CSS+'"><link rel="icon" href="'+BASE+'assets/favicon.ico"><style>'+OUTLINE+page.css+'</style><script>'+TOUCH+'</script></head><body'+attrs(page.meta.bodyAttrs)+'>'+page.html+SCRIPTS.map(script=>'<script src="'+script.src+'" integrity="'+script.integrity+'" crossorigin="anonymous"></script>').join('')+'</body></html>\n';
  }

  async function api(route,method='GET',body=null,auth=token){
    if(typeof auth!=='string'||!/^github_pat_[A-Za-z0-9_]{20,240}$/.test(auth))throw error('Connect GitHub with a fine-grained personal access token.');
    if(!/^[A-Za-z0-9_/?=.-]+$/.test(route)||route.includes('..')||route.startsWith('/'))throw error('Invalid GitHub request.');
    let response;
    try{response=await fetch('https://api.github.com/'+route,{method,redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{Authorization:'Bearer '+auth,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});}
    catch(_){throw error('GitHub could not be reached. Your draft is safe. Check your connection.');}
    if(!response.ok){
      if(response.status===401){clearToken();throw error('The GitHub token is invalid or expired. Connect GitHub again.');}
      if(response.status===403||response.status===404)throw error('GitHub denied access. Give this token Contents read and write permission for RaghdB/raghd-boulos-website.');
      if(response.status===409||response.status===422)throw error('The website changed on GitHub while publishing. Nothing was force-pushed. Reload the latest website before publishing again.');
      throw error('GitHub could not finish the request (HTTP '+response.status+'). Your draft is safe.');
    }
    try{const text=await response.text();if(text.length>32*1024*1024)throw error('Large response');const result=JSON.parse(text);if(!object(result))throw error('Invalid response');return result;}catch(_){throw error('GitHub returned an unexpected response. Publishing stopped safely.');}
  }
  async function verify(auth){
    const user=await api('user','GET',null,auth);if(user.login!=='RaghdB')throw error('Connect the RaghdB GitHub account that owns this website.');
    const repo=await api('repos/'+REPO,'GET',null,auth);if(repo.full_name!==REPO||repo.permissions?.push===false)throw error('Allow Contents read and write access for this website repository.');
  }
  function db(){return new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(error('Enable browser storage to save builder drafts.'));return;}
    const request=indexedDB.open('raghd-visual-builder',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts');request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(error('Could not open browser draft storage.'));request.onblocked=()=>reject(error('Close other builder tabs and try again.'));
  });}
  async function storage(value,write=false){
    requireAuth();const database=await db();
    try{return await new Promise((resolve,reject)=>{
      const transaction=database.transaction('drafts',write?'readwrite':'readonly'),store=transaction.objectStore('drafts');
      const request=write?store.put(value,'portfolio'):store.get('portfolio');let result;
      request.onsuccess=()=>{result=request.result;};transaction.oncomplete=()=>resolve(result);
      transaction.onerror=transaction.onabort=()=>reject(error('Could not save the draft and images. Check browser storage space and keep this tab open.'));
    });}finally{database.close();}
  }
  function base64(bytes){let result='';const u=new Uint8Array(bytes);for(let i=0;i<u.length;i+=32768)result+=String.fromCharCode(...u.subarray(i,i+32768));return btoa(result);}
  function decode(value,max=12*1024*1024){
    if(typeof value!=='string'||value.length>Math.ceil(max*4/3)+1024)throw error('Invalid file data.');
    const clean=value.replace(/\s/g,'');if(!/^[A-Za-z0-9+/]*={0,2}$/.test(clean))throw error('Invalid file data.');
    try{const result=Uint8Array.from(atob(clean),c=>c.charCodeAt(0));if(result.length>max)throw error('Too large');return result;}catch(_){throw error('Invalid or oversized file data.');}
  }
  function raster(bytes){
    const u=new Uint8Array(bytes),starts=s=>s.every((n,i)=>u[i]===n);
    if(starts([137,80,78,71,13,10,26,10]))return ['png','image/png'];if(starts([255,216,255]))return ['jpg','image/jpeg'];
    if(starts([71,73,70,56,55,97])||starts([71,73,70,56,57,97]))return ['gif','image/gif'];
    if(u.length>=12&&starts([82,73,70,70])&&u[8]===87&&u[9]===69&&u[10]===66&&u[11]===80)return ['webp','image/webp'];
    throw error('Choose a PNG, JPEG, GIF or WebP image. SVG uploads are not supported.');
  }
  async function tree(auth){
    const prefix='repos/'+REPO+'/git/',ref=await api(prefix+'ref/heads/main','GET',null,auth),head=sha(ref.object?.sha);
    const commit=await api(prefix+'commits/'+head,'GET',null,auth),base=sha(commit.tree?.sha),result=await api(prefix+'trees/'+base+'?recursive=1','GET',null,auth);
    if(result.truncated||!Array.isArray(result.tree))throw error('The repository could not be checked completely. Publishing stopped safely.');
    return {head,base,entries:new Map(result.tree.map(entry=>[entry.path,entry]))};
  }
  function revisionSet(remote){const result={};for(const path of TRACKED){const entry=remote.entries.get(path);if(!entry&&path===PROJECT){result[path]=null;continue;}if(!entry||entry.type!=='blob'||entry.mode!=='100644')throw error('A required website source file is missing or has an unsafe file mode.');result[path]=sha(entry.sha);}return result;}
  async function textBlob(checksum,auth){const blob=await api('repos/'+REPO+'/git/blobs/'+sha(checksum),'GET',null,auth);if(blob.encoding!=='base64')throw error('Unsupported GitHub file encoding.');return decoder.decode(decode(blob.content));}
  function record(pages,nextBaseline=baseline){return {version:1,pages:clone(pages),baseline:clone(nextBaseline),uploads:[...uploads].map(([path,value])=>({path,bytes:value.bytes.slice(0),mime:value.mime}))};}
  async function importRemote(restore){
    const auth=token,current=await tree(auth),revisions=revisionSet(current);
    requireAuth();knownAssets=new Set([...current.entries].filter(([path,entry])=>path.startsWith('docs/assets/')&&entry.type==='blob'&&entry.mode==='100644').map(([path])=>BASE+path.slice('docs/'.length)));
    const data={};for(const name of DATA){data[name]=JSON.parse(await textBlob(revisions['docs/_data/'+name+'.json'],auth));}
    let pages=[];
    for(const definition of DEFINITIONS){
      const source=renderLiquid(await textBlob(revisions[definition[2]],auth),data),doc=new DOMParser().parseFromString(source,'text/html');
      const css=[...doc.head.querySelectorAll('style')].map(style=>style.textContent).join('\n').replace(OUTLINE,'');
      pages.push({id:definition[0],name:definition[1],html:doc.body.innerHTML,css,meta:metadata(definition,doc.title||definition[1])});
    }
    if(revisions[PROJECT]){
      const project=JSON.parse(await textBlob(revisions[PROJECT],auth));
      if(!keys(project,['version','pages'])||project.version!==1)throw error('The saved builder project is invalid.');
      const projectPages=sanitizePages(project.pages);
      // A manual HTML edit takes precedence over a stale builder project.
      const matches=await Promise.all(DEFINITIONS.map(async definition=>await blobSHA(encoder.encode(exported(projectPages.find(page=>page.id===definition[0]))))===revisions[definition[2]]));
      if(matches.every(Boolean))pages=projectPages;
    }
    pages=sanitizePages(pages);baseline=revisions;draftRestored=false;
    if(restore){
      const saved=await storage();
      if(saved){
        if(!keys(saved,['version','pages','baseline','uploads'])||saved.version!==1||!keys(saved.baseline,TRACKED)||!TRACKED.every(path=>saved.baseline[path]===null&&path===PROJECT||typeof saved.baseline[path]==='string'&&/^[a-f0-9]{40}$/.test(saved.baseline[path]))||!Array.isArray(saved.uploads))throw error('The saved builder draft is invalid. Reset the draft to load GitHub content.');
        for(const upload of saved.uploads){
          if(!keys(upload,['path','bytes','mime'])||!generated(upload.path)||!(upload.bytes instanceof ArrayBuffer)||upload.bytes.byteLength>10*1024*1024)throw error('A saved draft image is invalid.');
          const [ext,mime]=raster(upload.bytes);if(mime!==upload.mime||!upload.path.endsWith('.'+ext))throw error('A saved draft image is invalid.');uploads.set(upload.path,{bytes:upload.bytes,mime});
        }
        pages=sanitizePages(saved.pages);baseline=clone(saved.baseline);draftRestored=true;
      }
    }
    requireAuth();model=pages;return {pages:clone(model),assets:assetList(),draftRestored,message:draftRestored?'Your saved builder draft and images were restored.':'Loaded the current website from GitHub.'};
  }
  async function ensureLoaded(){requireAuth();if(!loading)loading=importRemote(true);await loading;requireAuth();}
  async function locked(operation){requireAuth();if(busy)throw error('Another builder operation is running. Please wait.');busy=true;try{return await operation();}finally{busy=false;}}
  async function uploadBlob(bytes,auth){const result=await api('repos/'+REPO+'/git/blobs','POST',{content:base64(bytes),encoding:'base64'},auth);return sha(result.sha);}
  async function blobSHA(bytes){const u=new Uint8Array(bytes),header=encoder.encode('blob '+u.length+'\0'),data=new Uint8Array(header.length+u.length);data.set(header);data.set(u,header.length);return [...new Uint8Array(await crypto.subtle.digest('SHA-1',data))].map(n=>n.toString(16).padStart(2,'0')).join('');}
  async function publish(input){
    await ensureLoaded();if(!keys(input,['pages']))throw error('Unexpected project fields.');const pages=sanitizePages(input.pages),auth=token;
    await storage(record(pages),true);model=pages;await verify(auth);
    const current=await tree(auth),revisions=revisionSet(current);
    if(TRACKED.some(path=>revisions[path]!==baseline[path]))throw error('The website changed on GitHub since this draft began. Publishing stopped to protect that edit. Reset to the latest website before applying your changes again.');
    const entries=[],newBaseline=clone(revisions);
    for(const definition of DEFINITIONS){const bytes=encoder.encode(exported(pages.find(p=>p.id===definition[0]))),checksum=await blobSHA(bytes);if(checksum!==revisions[definition[2]]){entries.push({path:definition[2],mode:'100644',type:'blob',sha:await uploadBlob(bytes,auth)});newBaseline[definition[2]]=checksum;}}
    const projectBytes=json({version:1,pages}),projectSHA=await blobSHA(projectBytes);
    if(projectSHA!==revisions[PROJECT]){entries.push({path:PROJECT,mode:'100644',type:'blob',sha:await uploadBlob(projectBytes,auth)});newBaseline[PROJECT]=projectSHA;}
    const used=new Set();for(const page of pages){for(const src of uploads.keys())if(page.html.includes(src)||page.css.includes(src))used.add(src);}
    for(const src of [...used].sort()){
      const value=uploads.get(src),path='docs/'+src.slice(BASE.length),checksum=await blobSHA(value.bytes),existing=current.entries.get(path);
      if(existing){if(existing.type!=='blob'||existing.mode!=='100644'||existing.sha!==checksum)throw error('An uploaded image conflicts with a file on GitHub. Upload it again.');continue;}
      entries.push({path,mode:'100644',type:'blob',sha:await uploadBlob(value.bytes,auth)});
    }
    let revision=null;
    if(entries.length){
      const prefix='repos/'+REPO+'/git/',newTree=await api(prefix+'trees','POST',{base_tree:current.base,tree:entries},auth);
      const commit=await api(prefix+'commits','POST',{message:'Update portfolio with visual builder',tree:sha(newTree.sha),parents:[current.head]},auth);revision=sha(commit.sha);
      await api(prefix+'refs/heads/main','PATCH',{sha:revision,force:false},auth);
    }
    baseline=newBaseline;
    try{await storage(record(pages,newBaseline),true);}catch(_){throw error('GitHub accepted the update, but this browser could not save publishing history. Keep this tab open and save the draft before reloading.');}
    return {ok:true,message:revision?'Published to GitHub. The website will update when GitHub Pages finishes building.':'Your website is already up to date.',url:'https://raghdb.github.io'+BASE,...(revision?{commit:'https://github.com/'+REPO+'/commit/'+revision}:{})};
  }
  window.BuilderAPI=Object.freeze({
    async connect(value){if(busy)throw error('Wait for the current operation to finish.');if(typeof value!=='string'||!/^github_pat_[A-Za-z0-9_]{20,240}$/.test(value))throw error('Use a fine-grained GitHub token beginning with github_pat_.');clearToken();const version=generation;await verify(value);if(version!==generation)throw error('This connection attempt was cancelled.');token=value;return {authenticated:true,message:'GitHub connected.'};},
    disconnect(){if(busy)throw error('Wait for the current operation to finish.');clearToken();return {authenticated:false,message:'Disconnected. The token has been forgotten.'};},
    status(){return {authenticated:!!token,busy,draftRestored};},
    load(){return locked(async()=>{await ensureLoaded();return {pages:clone(model),assets:assetList(),draftRestored,message:draftRestored?'Your saved builder draft and images were restored.':'Loaded the current website.'};});},
    save(input){return locked(async()=>{await ensureLoaded();if(!keys(input,['pages']))throw error('Unexpected project fields.');const pages=sanitizePages(input.pages);await storage(record(pages),true);model=pages;return {ok:true,message:'Saved in this browser, including uploaded images.'};});},
    publish(input){return locked(()=>publish(input));},
    upload(body){return locked(async()=>{await ensureLoaded();if(!keys(body,['filename','mime','data'])||typeof body.filename!=='string'||typeof body.mime!=='string'||typeof body.data!=='string'||/\s/.test(body.data))throw error('Invalid image upload.');const bytes=decode(body.data,10*1024*1024);if(!bytes.length)throw error('Choose a nonempty image smaller than 10 MB.');const [ext,mime]=raster(bytes),suffix=body.filename.split('.').pop().toLowerCase();if(body.mime!==mime||(suffix!==ext&&!(ext==='jpg'&&suffix==='jpeg')))throw error('The image format does not match its filename.');const name=[...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('')+'.'+ext,src=BASE+'assets/uploads/'+name;uploads.set(src,{bytes:bytes.buffer,mime});return {path:src};});},
    reset(){return locked(async()=>{if(loading)await loading.catch(()=>{});const old={model,baseline,knownAssets,draftRestored,uploads:new Map(uploads)};try{uploads.clear();const result=await importRemote(false);await storage(record(model),true);for(const url of previews.values())URL.revokeObjectURL(url);previews.clear();loading=Promise.resolve();return {ok:true,...result};}catch(problem){if(token){({model,baseline,knownAssets,draftRestored}=old);uploads.clear();for(const [path,value]of old.uploads)uploads.set(path,value);}throw problem;}});},
    imagePreview(src){requireAuth();const path=asset(src,true);if(!uploads.has(path))return path;if(!previews.has(path)){const value=uploads.get(path);previews.set(path,URL.createObjectURL(new Blob([value.bytes],{type:value.mime})));}return previews.get(path);}
  });
})();
