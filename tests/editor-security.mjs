import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const source=fs.readFileSync('tools/github-editor-api.js','utf8');
const schema=JSON.parse(fs.readFileSync('tools/editor-schema.json','utf8'));
const files=Object.fromEntries(schema.content.map(e=>[e.name,JSON.parse(fs.readFileSync(e.path,'utf8'))]));
let record, calls=[], requests=[], rejectOwner=false, diverged=false, rejectRef=false;
const clone=v=>structuredClone(v);
const baseline=clone(files);
function idb(){ return {open(){ const request={}; setTimeout(()=>{ request.result={close(){},transaction(){ const tx={}; tx.objectStore=()=>({get(){const r={};setTimeout(()=>{r.result=record&&clone(record);r.onsuccess();tx.oncomplete();},0);return r;},put(value){const r={};setTimeout(()=>{record=clone(value);r.result='portfolio';r.onsuccess();tx.oncomplete();},0);return r;}});return tx;}};request.onsuccess();},0);return request;}}; }
const names=Object.keys(files); const shas=Object.fromEntries(names.map((n,i)=>[n,(i+1).toString(16).padStart(40,'0')]));
const response=v=>({ok:true,status:200,json:async()=>v,text:async()=>JSON.stringify(v)});
async function fetchMock(input, options){const url=String(input); calls.push(url);requests.push(options);
if(url.endsWith('/schema.json'))return response(schema);
if(url.endsWith('/content.json'))return response({files});
assert.equal(new URL(url).origin,'https://api.github.com');assert.equal(options.redirect,'error');
const route=url.slice('https://api.github.com/'.length);
if(route==='user')return response({login:rejectOwner?'Elsewhere':'RaghdB'});
if(route==='repos/RaghdB/raghd-boulos-website')return response({full_name:'RaghdB/raghd-boulos-website',permissions:{push:true}});
if(route.endsWith('ref/heads/main'))return response({object:{sha:'a'.repeat(40)}});
if(route.endsWith('commits/'+'a'.repeat(40)))return response({tree:{sha:'b'.repeat(40)}});
if(route.endsWith('trees/'+'b'.repeat(40)+'?recursive=1'))return response({truncated:false,tree:names.map(name=>({path:'docs/_data/'+name+'.json',mode:'100644',type:'blob',sha:shas[name]}))});
if(route.includes('/blobs/')&&options.method==='GET'){const name=names.find(n=>url.endsWith(shas[n]));const value=clone(baseline[name]);if(diverged&&name==='shared')value.name='Remote change';return response({encoding:'base64',content:Buffer.from(JSON.stringify(value)).toString('base64')});}
if(route.endsWith('/blobs')&&options.method==='POST')return response({sha:'c'.repeat(40)});
if(route.endsWith('/trees')&&options.method==='POST'){const body=JSON.parse(options.body);assert.equal(body.base_tree,'b'.repeat(40));assert(body.tree.every(e=>e.path.startsWith('docs/_data/')||/^docs\/assets\/uploads\/[a-f0-9]{32}\.png$/.test(e.path)));return response({sha:'d'.repeat(40)});}
if(route.endsWith('/commits')&&options.method==='POST')return response({sha:'e'.repeat(40)});
if(route.endsWith('/refs/heads/main')&&options.method==='PATCH'){assert.equal(JSON.parse(options.body).force,false);return rejectRef?{ok:false,status:422}:response({object:{sha:'e'.repeat(40)}});}
throw Error('Unexpected request '+route);
}
function start(framed=false){const window={location:{href:'https://raghdb.github.io/raghd-boulos-website/admin/',origin:'https://raghdb.github.io'}};window.self=window;window.top=framed?{}:window;const context={window,fetch:fetchMock,indexedDB:idb(),URL,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Blob,crypto:webcrypto,atob,btoa,console,setTimeout};window.indexedDB=context.indexedDB;vm.runInNewContext(source,context);return window;}
(async()=>{const initialRequests=calls.length;assert.throws(()=>start(true),/own browser tab/);assert.equal(calls.length,initialRequests);let window=start();let content=await window.websiteEditorApi('/api/content');assert.equal(content.files.shared.name,files.shared.name);assert.equal(content.status.authenticated,false);
let count=calls.length;await assert.rejects(window.websiteEditorConnect('ghp_notfinegrained'));assert.equal(calls.length,count);
rejectOwner=true;await assert.rejects(window.websiteEditorConnect('github_pat_'+'a'.repeat(30)),/RaghdB/);rejectOwner=false;
await window.websiteEditorConnect('github_pat_'+'a'.repeat(30));
const next=clone(files);next.shared.name='Draft name';await window.websiteEditorApi('/api/save',{files:next});assert.equal(record.files.shared.name,'Draft name');assert.equal(record.baseline.shared.name,files.shared.name);assert(!JSON.stringify(record).includes('github_pat_'));
const bad=clone(next);bad.visual_design.links.link_01='javascript:alert(1)';await assert.rejects(window.websiteEditorApi('/api/save',{files:bad}),/https/);bad.visual_design.links.link_01='https://safe.test';bad.prototyping.images.image_01.src='/assets/../secrets.png';await assert.rejects(window.websiteEditorApi('/api/save',{files:bad}),/image/);
await assert.rejects(window.websiteEditorApi('/api/upload',{filename:'x.svg',mime:'image/svg+xml',data:btoa('<svg/>')}),/PNG/);
const upload=await window.websiteEditorApi('/api/upload',{filename:'x.png',mime:'image/png',data:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')});next.prototyping.images.image_01.src=upload.path;
await window.websiteEditorApi('/api/save',{files:next});assert.equal(record.uploads.length,1);
window=start();content=await window.websiteEditorApi('/api/content');assert.equal(content.files.prototyping.images.image_01.src,upload.path);assert.match(window.websiteEditorImagePreview(upload.path),/^blob:/);assert.equal(content.status.authenticated,false);
await window.websiteEditorConnect('github_pat_'+'a'.repeat(30));
diverged=true;await assert.rejects(window.websiteEditorApi('/api/publish',{files:next}),/changed on GitHub/);assert(!requests.some(r=>r.method==='PATCH'));diverged=false;
rejectRef=true;await assert.rejects(window.websiteEditorApi('/api/publish',{files:next}),/Nothing was force-pushed/);assert.equal(record.baseline.shared.name,files.shared.name);rejectRef=false;
const result=await window.websiteEditorApi('/api/publish',{files:next});assert.equal(result.ok,true);assert.equal(record.baseline.shared.name,'Draft name');
await window.websiteEditorDisconnect();assert.equal((await window.websiteEditorApi('/api/content')).status.authenticated,false);assert(!JSON.stringify(record).includes('github_pat_'));
const reset=await window.websiteEditorApi('/api/reset',{});assert.equal(reset.files.shared.name,files.shared.name);assert.equal(record.uploads.length,0);
record.baseline.shared.name=42;window=start();await assert.rejects(window.websiteEditorApi('/api/content'),/Invalid text/);await window.websiteEditorApi('/api/reset',{});assert.equal((await window.websiteEditorApi('/api/content')).files.shared.name,files.shared.name);
assert(requests.filter(r=>r.headers).every(r=>r.redirect==='error'));console.log('PASS: frame guard, schema/content, token validation and nonpersistence, owner check, URL/path/SVG rejection, IndexedDB draft and image restore, remote conflict, non-force rejection, successful publish baseline advance, disconnect, reset, corrupt draft recovery.');
})().catch(e=>{console.error(e);process.exitCode=1;});
