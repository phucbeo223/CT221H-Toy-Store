import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import net from 'node:net';
import pg from 'pg';
import {hashPassword} from '../server/auth.mjs';

const schema='support_test_'+randomUUID().replaceAll('-','');
const root=new pg.Pool({connectionString:process.env.DATABASE_URL});
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,options:`-c search_path=${schema},public`});
let child,base,customers,admin,product;
const cookies={};
const address={name:'Test customer',phone:'0901234567',detail:'Địa chỉ minh họa kiểm thử'};
async function request(path,who,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookies[who]?{cookie:cookies[who]}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
before(async()=>{
 await root.query(`CREATE SCHEMA ${schema}`);
 for(const file of ['001_schema.sql','002_product_photos.sql','003_support.sql'])await db.query(await readFile(new URL('../db/'+file,import.meta.url),'utf8'));
 customers=[];
 for(const [i,role] of ['customer','customer','admin'].entries()){
  const u=(await db.query('INSERT INTO users(name,email,password_hash,role,wallet_balance) VALUES($1,$2,$3,$4,5000000) RETURNING *',['Test '+i,`test${i}@toyjoy.invalid`,hashPassword('Test@12345'),role])).rows[0];
  if(role==='admin')admin=u;else customers.push(u);
 }
 product=(await db.query("INSERT INTO products(sku,name,description,category,price,stock) VALUES('SUPPORT-TEST','Test toy','Toy used in isolated tests','Giáo dục',100000,10) RETURNING *")).rows[0];
 const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const url=new URL(process.env.DATABASE_URL);url.searchParams.set('options',`-c search_path=${schema},public`);
 child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,DATABASE_URL:url.href,PORT:String(port),GEMINI_API_KEY:''},stdio:'ignore',windowsHide:true});
 base='http://127.0.0.1:'+port;
 for(let n=0;n<60;n++){try{if((await request('/api/health')).status===200)break;}catch{}if(n===59)throw new Error('Isolated test API did not start');await new Promise(r=>setTimeout(r,100));}
 for(const u of [...customers,admin]){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:u.email,password:'Test@12345'})});assert.equal(r.status,200);cookies[u.id]=r.headers.get('set-cookie').split(';')[0];}
});
after(async()=>{if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}await db.end();await root.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await root.end();});

test('customer–admin messages are private, validated, persisted and idempotent',async()=>{
 const a=customers[0].id,b=customers[1].id;
 assert.equal((await request('/api/support')).status,401);
 assert.equal((await request('/api/admin/support',a)).status,403);
 assert.equal((await request('/api/admin/support/'+a,b)).status,403);
 assert.equal((await request('/api/support',a,{body:'   ',request_key:randomUUID()})).status,400);
 const payload={body:'Admin tư vấn giúp tôi',request_key:randomUUID()};
 assert.equal((await request('/api/support',a,payload)).status,201);
 await request('/api/support',a,payload);
 assert.equal((await request('/api/support',a)).data.messages.length,1);
 assert.equal((await request('/api/support',b)).data.messages.length,0);
 assert.equal((await request('/api/admin/support/'+a,admin.id)).data.messages[0].body,payload.body);
 assert.equal((await request('/api/admin/support/'+a,admin.id,{body:'Chào bạn, mình có thể hỗ trợ nhé!',request_key:randomUUID()})).status,201);
 assert.equal((await request('/api/support',a)).data.messages.at(-1).sender_role,'admin');
 assert.equal(Number((await db.query('SELECT count(*) FROM notifications')).rows[0].count),2);
});

test('checkout, attached order, admin shipping/completion and customer cancellation use real procedures',async()=>{
 const a=customers[0].id,b=customers[1].id;
 const order=(await request('/api/orders',a,{items:[{product_id:product.id,quantity:1}],method:'wallet',address,request_key:randomUUID()}));
 assert.equal(order.status,201);const id=order.data.p_order_id;
 const message={body:'Nhờ admin giao đơn này',order_id:id,request_key:randomUUID()};
 assert.equal((await request('/api/support',b,message)).status,403);
 assert.equal((await request('/api/support',a,message)).status,201);
 assert.ok((await request('/api/admin/support/'+a,admin.id)).data.messages.at(-1).order_number);
 assert.equal((await request('/api/orders/'+id+'/cancel',b,{})).status,409);
 assert.equal((await request('/api/admin/orders/'+id+'/status',a,{status:'shipping'})).status,403);
 assert.equal((await request('/api/admin/orders/'+id+'/status',admin.id,{status:'shipping'})).status,200);
 assert.equal((await request('/api/admin/orders/'+id+'/status',admin.id,{status:'completed'})).status,200);
 assert.equal((await request('/api/orders',a)).data.orders[0].status,'completed');
 assert.equal(Number((await db.query('SELECT wallet_balance FROM users WHERE id=$1',[a])).rows[0].wallet_balance),4900000);
 const second=await request('/api/orders',a,{items:[{product_id:product.id,quantity:1}],method:'wallet',address,request_key:randomUUID()});
 assert.equal((await request('/api/orders/'+second.data.p_order_id+'/cancel',a,{})).status,200);
 assert.equal((await db.query('SELECT stock FROM products WHERE id=$1',[product.id])).rows[0].stock,9);
});

test('chat has clear configuration and validation errors without calling Gemini',async()=>{
 assert.equal((await request('/api/chat',null,{message:'Chọn đồ chơi cho bé'})).status,503);
 assert.equal((await request('/api/chat',null,{message:''})).status,400);
});
