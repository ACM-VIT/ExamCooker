// Copies a previously exported Azure manifest through the streaming asset
// Worker. Credentials are supplied through the environment, never arguments.
// az storage blob list --account-name examcookerprodsi --container-name
// exam-assets --auth-mode key --num-results '*' -o json > manifest.json
import fs from 'node:fs';
import assert from 'node:assert/strict';
const [manifestPath,outputPath]=process.argv.slice(2);
if(!manifestPath||!outputPath||!process.env.EC_MIRROR_TOKEN)throw Error('Usage: EC_MIRROR_TOKEN=... node scripts/storage/mirror-azure-to-r2.mjs manifest.json results.jsonl');
const endpoint=process.env.EC_MIRROR_ENDPOINT||'https://ec-assets.acmvit.in/_mirror';
const manifest=JSON.parse(fs.readFileSync(manifestPath));
const prior=fs.existsSync(outputPath)?fs.readFileSync(outputPath,'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x)):[];
const verified=new Map(prior.filter(x=>x.status==='copied'||x.status==='unchanged').map(x=>[x.key,x]));
const todo=manifest.filter(b=>{const old=verified.get(b.name);return !old||old.etag!==b.properties.etag.replaceAll('"','')||old.size!==b.properties.contentLength;});
let cursor=0,done=manifest.length-todo.length,failed=0,bytes=0;const start=Date.now();
const timer=setInterval(()=>console.log(JSON.stringify({done,total:manifest.length,failed,GiB:+(bytes/1024**3).toFixed(3),seconds:Math.round((Date.now()-start)/1000)})),15000);
try {
 await Promise.all(Array.from({length:Math.min(6,todo.length)},async()=>{
  for(;;){const b=todo[cursor++];if(!b)return;let result;
   for(let attempt=0;attempt<4;attempt++){
    try{
     const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-ec-mirror-token':process.env.EC_MIRROR_TOKEN},body:JSON.stringify({key:b.name,expected:{etag:b.properties.etag,size:b.properties.contentLength}}),signal:AbortSignal.timeout(45000)});
     if(!r.ok)throw Error(`Mirror HTTP ${r.status}`);
     result=await r.json();assert.ok(['copied','unchanged'].includes(result.status));assert.equal(result.size,b.properties.contentLength);assert.equal(result.etag,b.properties.etag.replaceAll('"',''));assert.match(result.md5,/^[a-f0-9]{32}$/);
     const sourceMd5=b.properties.contentSettings.contentMd5;if(sourceMd5)assert.equal(result.md5,Buffer.from(sourceMd5,'base64').toString('hex'));
     break;
    }catch(e){if(attempt===3){result={key:b.name,status:'error',error:e.message};failed++;}else await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}
   }
   fs.appendFileSync(outputPath,JSON.stringify(result)+'\n',{mode:0o600});done++;if(result.status!=='error')bytes+=b.properties.contentLength;
  }
 }));
}finally{clearInterval(timer);}
console.log(JSON.stringify({done,total:manifest.length,failed,bytes,seconds:Math.round((Date.now()-start)/1000)}));if(failed)process.exitCode=1;
