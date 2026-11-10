import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.TEST_API_URL||'http://127.0.0.1:3001';
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',origin:'http://127.0.0.1:5173'},body:JSON.stringify({email:'admin@toyjoy.vn',password:'Admin@12345'})});
assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],results={};
async function request(path,method='GET'){const r=await fetch(base+'/api'+path,{method,headers:{cookie,'Content-Type':'application/json'}});const body=await r.json();assert.equal(r.status,200,`${path}: ${JSON.stringify(body)}`);return body;}
try{
 for(const path of ['dashboard','products','orders','audit','database','ai','insights']){const data=await request('/admin/'+path);results[path]={ok:true,keys:Object.keys(data)};}
 const rollback=await request('/admin/database/rollback','POST');assert.equal(rollback.restored,true);results.rollback=rollback;
 const benchmark=await request('/admin/database/benchmark','POST');assert.equal(benchmark.row_count,200000);assert.equal(benchmark.after_plan.Plan['Node Type'],'Index Scan');results.benchmark=benchmark;
 await mkdir('outputs',{recursive:true});await writeFile('outputs/verification.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify({adminEndpoints:7,rollback:rollback.restored,beforeMs:benchmark.before_ms,afterMs:benchmark.after_ms,speedup:(benchmark.before_ms/Math.max(benchmark.after_ms,.001)).toFixed(1)},null,2));
}finally{await request('/auth/logout','POST');}
