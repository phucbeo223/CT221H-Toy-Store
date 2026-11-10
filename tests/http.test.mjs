import {test} from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.TEST_API_URL||'http://127.0.0.1:3001';
test('API hides admin records from anonymous users and rejects untrusted origins',async()=>{
 const denied=await fetch(base+'/api/admin/dashboard');assert.equal(denied.status,401);
 const csrf=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',origin:'https://untrusted.invalid'},body:JSON.stringify({email:'admin@toyjoy.vn',password:'invalid'})});assert.equal(csrf.status,403);
 const products=await (await fetch(base+'/api/products')).json();assert.ok(products.products.length>0);assert.equal(products.products[0].embedding,undefined);assert.equal(products.products[0].password_hash,undefined);
});
test('semantic search reports unavailable without a Gemini key',async()=>{
 if(process.env.GEMINI_API_KEY)return;
 const r=await fetch(base+'/api/search/semantic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'quà cho bé thích vũ trụ'})});assert.equal(r.status,503);assert.equal((await r.json()).code,'GEMINI_NOT_CONFIGURED');
});
test('customer session cannot access admin endpoints',async()=>{
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',origin:'http://127.0.0.1:5173'},body:JSON.stringify({email:'hello@toyjoy.vn',password:'Toyjoy@123'})});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 try{const r=await fetch(base+'/api/admin/products',{headers:{cookie}});assert.equal(r.status,403);const me=await(await fetch(base+'/api/auth/me',{headers:{cookie}})).json();assert.equal(me.user.role,'customer');assert.equal(me.user.password_hash,undefined);}
 finally{await fetch(base+'/api/auth/logout',{method:'POST',headers:{cookie}});}
});
