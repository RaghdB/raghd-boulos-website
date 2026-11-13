import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const source=fs.readFileSync('tools/builder-api.js','utf8');
const BASE='/raghd-boulos-website/', TOKEN='github_pat_'+'a'.repeat(30);
const pagePaths=['docs/index.html','docs/visual-design/index.html','docs/interaction-design/index.html','docs/architecture/index.html','docs/prototyping/index.html'];
const dataPaths=['shared','home','visual_design','interaction_design','architecture','prototyping'].map(n=>'docs/_data/'+n+'.json');
const gitSHA=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
const files=new Map([...pagePaths,...dataPaths].map(path=>[path,fs.readFileSync(path)]));
const originals=new Map(files);
function walk(path){return fs.readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path+'/'+entry.name):[path+'/'+entry.name]);}
const assets=walk('docs/assets');
let record,dbReads=0,requests=[],wrongOwner=false,expired=false,conflict=false,rejectRef=false,head='a'.repeat(40),treeSHA='b'.repeat(40),counter=1;
const blobs=new Map([...files.values()].map(bytes=>[gitSHA(bytes),bytes]));
const trees=new Map(),commits=new Map();
const clone=structuredClone;
const response=value=>({ok:true,status:200,text:async()=>JSON.stringify(value)});
async function fetchMock(url,options){
  assert.equal(new URL(url).origin,'https://api.github.com');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
  requests.push({url,options});const route=url.slice('https://api.github.com/'.length),body=options.body&&JSON.parse(options.body);
  if(route==='user')return expired?{ok:false,status:401}:response({login:wrongOwner?'SomeoneElse':'RaghdB'});
  if(route==='repos/RaghdB/raghd-boulos-website')return response({full_name:'RaghdB/raghd-boulos-website',permissions:{push:true}});
  if(route.endsWith('/ref/heads/main'))return response({object:{sha:head}});
  if(route.endsWith('/commits/'+head))return response({tree:{sha:treeSHA}});
  if(route.endsWith('/trees/'+treeSHA+'?recursive=1'))return response({truncated:false,tree:[...files].map(([path,bytes])=>({path,mode:'100644',type:'blob',sha:conflict&&path===dataPaths[0]?'0'.repeat(40):gitSHA(bytes)})).concat(assets.map(path=>({path,mode:'100644',type:'blob',sha:'f'.repeat(40)})))});
  if(/\/blobs\/[a-f0-9]{40}$/.test(route)){const bytes=blobs.get(route.split('/').pop());assert(bytes,'Unknown blob');return response({encoding:'base64',content:bytes.toString('base64')});}
  if(route.endsWith('/blobs')&&options.method==='POST'){assert.equal(body.encoding,'base64');const bytes=Buffer.from(body.content,'base64'),sha=gitSHA(bytes);blobs.set(sha,bytes);return response({sha});}
  if(route.endsWith('/trees')&&options.method==='POST'){
    assert.equal(body.base_tree,treeSHA);
    for(const entry of body.tree){assert.equal(entry.mode,'100644');assert.equal(entry.type,'blob');assert(pagePaths.includes(entry.path)||entry.path==='docs/admin/builder-project.json'||/^docs\/assets\/uploads\/[a-f0-9]{32}\.(png|jpg|gif|webp)$/.test(entry.path),'Unexpected publication path '+entry.path);}
    const sha=(++counter).toString(16).padStart(40,'0');trees.set(sha,body.tree);return response({sha});
  }
  if(route.endsWith('/commits')&&options.method==='POST'){assert.deepEqual(body.parents,[head]);const sha=(++counter).toString(16).padStart(40,'0');commits.set(sha,body.tree);return response({sha});}
  if(route.endsWith('/refs/heads/main')&&options.method==='PATCH'){
    assert.equal(body.force,false);if(rejectRef)return {ok:false,status:422};
    head=body.sha;treeSHA=commits.get(head);for(const entry of trees.get(treeSHA))files.set(entry.path,blobs.get(entry.sha));
    return response({object:{sha:head}});
  }
  throw Error('Unexpected GitHub request '+route);
}
function indexedDB(){return {open(name){assert.equal(name,'raghd-visual-builder');++dbReads;const request={};queueMicrotask(()=>{request.result={close(){},transaction(){const tx={};tx.objectStore=()=>({get(){const r={};queueMicrotask(()=>{r.result=record&&clone(record);r.onsuccess();tx.oncomplete();});return r;},put(value){const r={};queueMicrotask(()=>{record=clone(value);r.result='portfolio';r.onsuccess();tx.oncomplete();});return r;}});return tx;}};request.onsuccess();});return request;}};}

// A deterministic DOM fixture keeps these Node tests dependency-free. It checks
// the adapter's policy, not browser parsing quirks; real-browser QA is also needed.
const entities=value=>value.replace(/&(?:amp|quot|apos|lt|gt|#39|#(\d+)|#x([a-f\d]+));/gi,(all,decimal,hex)=>decimal?String.fromCodePoint(+decimal):hex?String.fromCodePoint(parseInt(hex,16)):({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&#39;':"'"}[all]||all));
const escapeAttribute=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const voidTags=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
class Element {
  constructor(name,attributes=[],parent=null){this.localName=name;this.attributes=attributes;this.parent=parent;this.children=[];this.namespaceURI=name==='svg'||parent?.namespaceURI==='http://www.w3.org/2000/svg'?'http://www.w3.org/2000/svg':'http://www.w3.org/1999/xhtml';}
  setAttribute(name,value){const old=this.attributes.find(a=>a.name===name);if(old)old.value=String(value);else this.attributes.push({name,value:String(value)});}
  removeAttribute(name){this.attributes=this.attributes.filter(a=>a.name!==name);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
  querySelectorAll(selector='*'){const all=this.children.flatMap(n=>typeof n==='string'?[]:[n,...n.querySelectorAll()]);return selector==='*'?all:all.filter(n=>n.localName===selector);}
  get textContent(){return entities(this.children.map(n=>typeof n==='string'?n:n.textContent).join(''));}
  get innerHTML(){return this.children.map(n=>typeof n==='string'?n:n.outerHTML).join('');}
  get outerHTML(){return '<'+this.localName+this.attributes.map(a=>' '+a.name+'="'+escapeAttribute(a.value)+'"').join('')+'>'+(!voidTags.has(this.localName)?this.innerHTML+'</'+this.localName+'>':'');}
}
class DOMFixture {
  parseFromString(source){
    const root=new Element('document'),stack=[root];
    const tokens=source.match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>|[^<]+|</g)||[];
    for(const token of tokens){
      if(/^<!/.test(token))continue;
      const closing=token.match(/^<\/([\w-]+)/);
      if(closing){const index=stack.map(n=>n.localName).lastIndexOf(closing[1].toLowerCase());if(index>0)stack.length=index;continue;}
      const opening=token.match(/^<([\w-]+)([\s\S]*?)\/?\s*>$/);
      if(opening){
        const attrs=[];const pattern=/([^\s=/'">]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s'"=<>`]+)))?/g;let match;
        while((match=pattern.exec(opening[2])))attrs.push({name:match[1].toLowerCase(),value:entities(match[2]??match[3]??match[4]??'')});
        const element=new Element(opening[1].toLowerCase(),attrs,stack.at(-1));stack.at(-1).children.push(element);if(!voidTags.has(element.localName))stack.push(element);
      }else stack.at(-1).children.push(token);
    }
    const all=root.querySelectorAll(),body=all.find(n=>n.localName==='body')||root,title=all.find(n=>n.localName==='title');
    return {body,head:all.find(n=>n.localName==='head')||new Element('head'),title:title?entities(title.innerHTML):''};
  }
}
function start(framed=false){
  const window={};window.self=window;window.top=framed?{}:window;window.indexedDB=indexedDB();
  const context={window,indexedDB:window.indexedDB,fetch:fetchMock,DOMParser:DOMFixture,URL,Blob,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,crypto:webcrypto,atob,btoa,console};
  vm.runInNewContext(source,context);return window.BuilderAPI;
}
async function locked(api){
  assert.equal(api.status().authenticated,false);
  for(const fn of [()=>api.load(),()=>api.save({pages:[]}),()=>api.upload({}),()=>api.publish({pages:[]}),()=>api.reset()])await assert.rejects(fn(),/Connect/);
  assert.throws(()=>api.imagePreview('/assets/test.png'),/Connect/);
}
(async()=>{
  assert.throws(()=>start(true),/own browser tab/);
  let api=start();await locked(api);assert.equal(requests.length,0);assert.equal(dbReads,0);
  await assert.rejects(api.connect('ghp_invalid'));assert.equal(requests.length,0);
  wrongOwner=true;await assert.rejects(api.connect(TOKEN),/RaghdB/);wrongOwner=false;await locked(api);assert.equal(dbReads,0);
  await api.connect(TOKEN);assert.equal(dbReads,0);let loaded=await api.load();assert.equal(loaded.pages.length,5);assert(loaded.assets.some(asset=>asset.src===BASE+'assets/webclip.png'));assert(loaded.assets.some(asset=>asset.src.endsWith('.svg')));assert(loaded.assets.every(asset=>asset.type==='image'&&/^\/raghd-boulos-website\/assets\/[A-Za-z0-9_./-]+\.(png|jpe?g|gif|webp|svg)$/i.test(asset.src)));assert(!loaded.assets.some(asset=>/\.(js|css)$/i.test(asset.src)));
  const home=loaded.pages.find(p=>p.id==='home');assert(home.html.includes('Raghd Boulos'));assert(!home.html.includes('{{'));assert(!home.html.includes('<script'));
  const visual=loaded.pages.find(p=>p.id==='visual_design');assert(visual.html.includes('https://getdropset.app/'));assert(!visual.html.includes('{%'));
  const interaction=loaded.pages.find(p=>p.id==='interaction_design');assert(interaction.html.includes('cdn.embedly.com'));assert(interaction.html.includes('sandbox='));
  const pages=clone(loaded.pages);pages[0].html+='<script>alert(1)</script><img onerror="alert(1)" src="'+BASE+'assets/webclip.png"><a href="javascript:alert(1)">unsafe</a><svg onload="alert(1)"></svg><iframe src="https://evil.test/"></iframe><div data-gjs-script="alert(1)">safe</div>';
  pages[0].meta.scripts=[{src:'https://evil.test/a.js'}];
  await api.save({pages});loaded=await api.load();const clean=loaded.pages[0];
  assert(!clean.html.includes('<script'));assert(!clean.html.includes('onerror'));assert(!clean.html.includes('javascript:'));assert(!clean.html.includes('<svg'));assert(!clean.html.includes('evil.test'));assert(!clean.html.includes('data-gjs-script'));assert(!JSON.stringify(clean.meta).includes('evil.test'));
  for(const css of ['@import "https://evil.test/a.css";','a{background:url(https://evil.test/a.png)}','a{background:u\\72l(https://evil.test/a.png)}','a{width:expression(alert(1))}','</style><script>alert(1)</script>']){
    const bad=clone(loaded.pages);bad[0].css=css;await assert.rejects(api.save({pages:bad}));
  }
  const responsive=clone(loaded.pages);responsive[0].css='@media (max-width:600px){.hero{color:red}}';await api.save({pages:responsive});
  const badURL=clone(loaded.pages);badURL[0].html='<img src="https://evil.test/a.png">';await assert.rejects(api.save({pages:badURL}),/assets/);
  await assert.rejects(api.upload({filename:'x.svg',mime:'image/svg+xml',data:btoa('<svg/>')}),/PNG/);
  const upload=await api.upload({filename:'x.png',mime:'image/png',data:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')});assert.match(upload.path,/\/assets\/uploads\/[a-f0-9]{32}\.png$/);
  const draft=clone((await api.load()).pages);draft[0].html+='<img src="'+upload.path+'" alt="Uploaded">';await api.save({pages:draft});
  assert.equal(record.uploads.length,1);assert(!JSON.stringify(record).includes('github_pat_'));
  api.disconnect();let count=dbReads;const treeReads=requests.filter(r=>r.url.includes('?recursive=1')).length;await locked(api);assert.equal(dbReads,count);
  await api.connect(TOKEN);loaded=await api.load();assert.equal(requests.filter(r=>r.url.includes('?recursive=1')).length,treeReads+1,'Same-tab reconnect must reimport the current GitHub tree');assert.equal(loaded.draftRestored,true);assert.match(api.imagePreview(upload.path),/^blob:/);
  conflict=true;const patches=requests.filter(r=>r.options.method==='PATCH').length;await assert.rejects(api.publish({pages:loaded.pages}),/changed on GitHub/);assert.equal(requests.filter(r=>r.options.method==='PATCH').length,patches);conflict=false;
  rejectRef=true;const before=clone(record.baseline);await assert.rejects(api.publish({pages:loaded.pages}),/Nothing was force-pushed/);assert.deepEqual(record.baseline,before);rejectRef=false;
  const result=await api.publish({pages:loaded.pages});assert.equal(result.ok,true);assert.equal(files.has('docs/admin/builder-project.json'),true);assert(!files.get('docs/index.html').toString().startsWith('---'));assert(files.get('docs/index.html').toString().includes('integrity="sha256-'));assert(files.has('docs/'+upload.path.slice(BASE.length)));
  for(const path of dataPaths)assert.deepEqual(files.get(path),originals.get(path),'Content JSON files must never be rewritten');
  const posts=requests.filter(r=>r.options.method==='PATCH').length;await api.publish({pages:loaded.pages});assert.equal(requests.filter(r=>r.options.method==='PATCH').length,posts,'Unchanged export must not create another commit');
  api.disconnect();await locked(api);assert(!JSON.stringify(record).includes('github_pat_'));
  const manuallyEdited=Buffer.from(files.get('docs/index.html').toString().replace('</body>','<p>Manual GitHub edit</p></body>'));files.set('docs/index.html',manuallyEdited);blobs.set(gitSHA(manuallyEdited),manuallyEdited);record=undefined;await api.connect(TOKEN);const importedManual=await api.load();assert(importedManual.pages[0].html.includes('Manual GitHub edit'),'Stale project must not hide current HTML edits');assert(importedManual.pages[0].css.includes('@media'),'Current head CSS must survive static reimport');
  await api.connect(TOKEN);await api.reset();assert.equal(record.uploads.length,0);assert.equal((await api.load()).pages.length,5);
  expired=true;await assert.rejects(api.publish({pages:(await api.load()).pages}),/invalid or expired/);await locked(api);expired=false;
  console.log('PASS: auth gate, no pre-auth network/storage, owner validation, fixed GitHub paths and redirects, template import, HTML/CSS policy, immutable script metadata, upload/draft restore, remote conflict, non-force rejection, baseline advance, unchanged publish, same-tab reconnect freshness and asset library, disconnect/reset/expiry.');
})().catch(problem=>{console.error(problem);process.exitCode=1;});
