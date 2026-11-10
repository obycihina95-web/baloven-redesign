import {mkdir, readdir, writeFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import assert from 'node:assert/strict';

const origin = 'https://cafe-baloven.com';
const mount = '/baloven-redesign';
const output = resolve(process.argv[2] || 'production/site');
const present = await readdir(output).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
assert.equal(present.length,0,'Choose a new or empty output directory');
const feedURL = 'https://feeds.tildaapi.com/api/getfeed/?feeduid=832048692431&size=100&slice=1&sort%5Bdate%5D=asc&getparts=true';
const forms = {'/booking':'#booking-form','/banquets':'#request','/partners':'#request'};
async function request(url) {
  const r = await fetch(url, {signal:AbortSignal.timeout(25000)});
  if (!r.ok) throw Error(url + ': HTTP ' + r.status);
  return r;
}
function locations(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(m=>m[1].replaceAll('&amp;','&'));
}
const [pages, feeds, rawFeed] = await Promise.all([
  request(origin+'/sitemap.xml').then(r=>r.text()).then(locations),
  request(origin+'/sitemap-feeds.xml').then(r=>r.text()).then(locations),
  request(feedURL).then(r=>r.json())
]);
const events = (await Promise.all(feeds.map(url=>request(url).then(r=>r.text()).then(locations)))).flat();
const paths = [...new Set([...pages,...events,origin+'/not-found'].map(url=>{
  const u=new URL(url);
  assert.equal(u.origin,origin);
  assert.match(u.pathname,/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)?)?$/);
  return u.pathname;
}))];
assert(paths.includes('/menu') && paths.includes('/booking') && paths.includes('/') && events.length>0);
const formTargets = Object.keys(forms);
for (const p of formTargets) assert(paths.includes(p));
const dataKeys = ['uid','parts','directlink','directtarget','date','published','url','postparts','title','descr','text','mediatype','mediadata','image','imagealt','thumb','thumbalt'];
const posts = rawFeed.posts.filter(p=>events.includes(new URL(p.url,origin).href)).map(p=>Object.fromEntries(dataKeys.filter(k=>k in p).map(k=>[k,p[k]])));
assert.equal(posts.length,events.length,'Sitemap and public feed disagree');
const safeFeed = {feeduid:rawFeed.feeduid,feedtitle:rawFeed.feedtitle,feedtz:rawFeed.feedtz,parts:rawFeed.parts,posts,total:posts.length};
const postDetails = await Promise.all(posts.map(async p=>{
  assert.match(p.uid,/^[a-z0-9]+$/);
  const j=await request('https://feeds.tildaapi.com/api/getpost/?postuid='+p.uid).then(r=>r.json());
  const body=(j.post||j).text;
  assert.equal(typeof body,'string','Missing public post text '+p.uid);
  return [p.uid,{post:{text:body}}];
}));
function escape(s){return String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
function route(raw,page) {
  const value=raw.replaceAll('&amp;','&');
  if (!value || value.startsWith('#')) {
    if ((forms[page] && value===forms[page])) return origin+page+value;
    return null;
  }
  let u; try {u=new URL(value,origin+page);} catch{return null;}
  if (u.origin!==origin) return null;
  const p=u.pathname.replace(/\/$/,'')||'/';
  if (!paths.includes(p)) return null;
  if (p==='/booking' && u.hash!=='#contacts') return origin+p+u.search+(u.hash||'#booking-form');
  if (forms[p] && u.hash===forms[p]) return origin+p+u.search+u.hash;
  return mount+(p==='/'?'/':p+'/')+u.search+u.hash;
}
const script = '('+function (mount,origin,paths,forms,page){
  function update(a){
    const raw=a.getAttribute('href');
    if (!raw || raw.startsWith('#')) return;
    let u;try{u=new URL(raw,origin+page);}catch{return;}
    if (u.origin!==origin && u.origin!==location.origin) return;
    if (u.pathname===mount||u.pathname.startsWith(mount+'/')) return;
    const p=u.pathname.replace(/\/$/,'')||'/';
    if (!paths.includes(p)) return;
    if ((p==='/booking' && u.hash!=='#contacts') || (forms[p] && u.hash===forms[p])) {
      a.href=origin+p+u.search+(u.hash||forms[p]); return;
    }
    a.href=mount+(p==='/'?'/':p+'/')+u.search+u.hash;
  }
  function refresh(root){
    if(root.nodeType!==1)return;
    if(root.matches('a[href]'))update(root);
    root.querySelectorAll('a[href]').forEach(update);
  }
  const start=()=>{
    refresh(document.body);
    new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(refresh))).observe(document.body,{childList:true,subtree:true});
    if(page==='/booking' && location.search){
      const a=document.querySelector('.gh-tilda-form-link');
      if(a){const dest=new URL(a.href);dest.search=location.search;a.href=dest.href;}
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}.toString()+')';
const css = '<style>.gh-tilda-form-link{display:inline-block;padding:16px 22px;border-radius:16px;background:#fd6901;color:#1f2938!important;text-decoration:none!important;font:600 16px/1.4 TildaSans,Arial,sans-serif;box-sizing:border-box;max-width:100%}.gh-tilda-form-link:focus-visible{outline:3px solid #1f2938;outline-offset:4px}</style>';
const formPattern=/<div\b[^>]*\bdata-elem-type=(?:'form'|"form")[^>]*>\s*<div\b[^>]*\bclass=(?:'tn-atom tn-atom__form'|"tn-atom tn-atom__form")[^>]*>\s*<\/div>\s*<!--googleoff:\s*all-->\s*<!--noindex-->[\s\S]*?<!--\/noindex-->\s*<!--googleon:\s*all-->/gi;

function transform(html,page){
  let count=0;
  html=html.replace(formPattern,match=>{
    if(!forms[page])throw Error('Unexpected form: '+page);
    count++;
    const outer=match.slice(0,match.indexOf('>')+1).replace(/data-elem-type=(?:'form'|"form")/,'data-elem-type="text"')
      .replace(/\sdata-field-(?:formname|formmsgsuccess|receivers|formbottomtext)-value=(?:"[^"]*"|'[^']*')/gi,'');
    const label=page==='/booking'?'Открыть форму бронирования на сайте кафе':'Открыть форму заявки на сайте кафе';
    return outer+'<div class="tn-atom"><a class="gh-tilda-form-link" href="'+origin+page+forms[page]+'">'+label+'</a></div>';
  });
  assert.equal(count,forms[page]?1:0,'Unexpected form count: '+page);
  assert(!/\bdata-elem-type=(?:'form'|"form")/.test(html),'Unprocessed form '+page);
  html=html.replace(/\sdata-tilda-formskey=(?:"[^"]*"|'[^']*')/gi,'')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,s=>/mc\.yandex\.ru\/metrika|Yandex\.Metrika|yandex_metrika|tilda-stat-1\.0\.min\.js/.test(s)?'':s)
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,s=>/mc\.yandex\.ru\/watch/.test(s)?'':s)
    .replace(/https:\/\/feeds\.tildaapi\.com\/api\/getfeed\/\?feeduid=832048692431[^'"<>\s]*/g,m=>m.includes('slice=1')?mount+'/assets/tilda-feed.json':m)
    .replaceAll("'https://feeds.tildaapi.com/api/getfeed/?feeduid=' + FEED + '&recid=' + recid + '&size=100&slice=1&sort%5Bdate%5D=asc&getparts=true'", "'"+mount+"/assets/tilda-feed.json'")
    .replaceAll("'https://feeds.tildaapi.com/api/getpost/?postuid=' + p.uid", "'"+mount+"/assets/events/' + p.uid + '.json'");
  assert(!/fetch\(['"]https:\/\/feeds\.tildaapi\.com/.test(html),'Unconverted public feed request: '+page);
  html=html.replace(/<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi,tag=>tag.replace(/\bhref=(["'])(.*?)\1/i,(whole,q,v)=>{
    if(tag.includes('gh-tilda-form-link'))return whole;
    const target=route(v,page);return target?'href='+q+escape(target)+q:whole;
  }));
  html=html.replace(/<\/head>/i,'<meta name="robots" content="noindex,follow">'+css+'</head>');
  const call=script+'('+JSON.stringify(mount)+','+JSON.stringify(origin)+','+JSON.stringify(paths)+','+JSON.stringify(forms)+','+JSON.stringify(page)+');';
  html=html.replace(/<\/body>/i,'<script>'+call+'</script></body>');
  assert(html.includes('noindex,follow') && html.includes(call),'Missing document structure '+page);
  assert(!/data-tilda-formskey|data-field-receivers-value|js-formaction-services|gho_[A-Za-z0-9]+|github_pat_[A-Za-z0-9_]+/.test(html),'Credential or form marker: '+page);
  return html.replace(/[ \t]+(?=\r?$)/gm,'').trimEnd()+'\n';
}
const put=async(file,content)=>{
  const path=resolve(output,file);assert(path.startsWith(output+'/'));
  await mkdir(dirname(path),{recursive:true});await writeFile(path,content,'utf8');
};
const checks=[];
for(const page of paths){
  const source=await request(origin+page).then(r=>r.text());
  const out=transform(source,page);
  const path=page==='/'?'index.html':page.slice(1)+'/index.html';
  await put(path,out);
  if(page==='/not-found')await put('404.html',out);
  checks.push({url:origin+page,file:path,bytes:Buffer.byteLength(out)});
}
await put('assets/tilda-feed.json',JSON.stringify(safeFeed,null,2)+'\n');
for(const [uid,post] of postDetails) await put('assets/events/'+uid+'.json',JSON.stringify(post,null,2)+'\n');
await put('robots.txt','User-agent: *\nDisallow: /\n');
await put('.nojekyll','');
const aliases={'about.html':'/about/','afisha.html':'/poster/','banquets.html':'/banquets/','booking.html':'/booking/','menu.html':'/menu/','afisha/teatr.html':'/teatr/','afisha/kvartirniki.html':'/homeconcert/','afisha/vecherinki.html':'/vecherinki/','afisha/kinoklub.html':'/poster/','afisha/argentina.html':'/poster/','afisha/magiya-pervoy-vstrechi.html':'/poster/','afisha/osenniy-vaib.html':'/homeconcert/','afisha/premera-detektiv.html':'/poster/','afisha/vlyublennyy-deklamator.html':'/teatr/'};
for(const [file,target] of Object.entries(aliases)){
  await put(file,'<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url='+mount+target+'"><title>Баловень</title><a href="'+mount+target+'">Перейти к актуальной странице</a></html>\n');
}
await put('assets/export-manifest.json',JSON.stringify({source:origin,exportedAt:new Date().toISOString(),pages:checks,feedPosts:posts.length,forms:'Ссылки на оригинальные формы Tilda'},null,2)+'\n');
console.log(JSON.stringify({output,pages:checks.length,events:posts.length,forms:formTargets,aliases:Object.keys(aliases).length}));
