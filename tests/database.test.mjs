import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const schema='test_'+randomUUID().replaceAll('-','');
const root=new pg.Pool({connectionString:process.env.DATABASE_URL});
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,options:`-c search_path=${schema},public`});
before(async()=>{await root.query(`CREATE SCHEMA ${schema}`);await db.query(await readFile(new URL('../db/001_schema.sql',import.meta.url),'utf8'));});
after(async()=>{await db.end();await root.query(`DROP SCHEMA ${schema} CASCADE`);await root.end();});
async function fixture(stock=10,wallet=1000000){
 const user=(await db.query("INSERT INTO users(name,email,password_hash,wallet_balance) VALUES('Test',$1,'unused',$2) RETURNING *",[randomUUID()+'@test.invalid',wallet])).rows[0];
 const product=(await db.query("INSERT INTO products(sku,name,description,category,price,stock) VALUES($1,'Test toy','Disposable test product','Lắp ráp',100000,$2) RETURNING *",[randomUUID(),stock])).rows[0];
 return {user,product};
}
async function tx(fn){const c=await db.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
const call=async(c,u,p,method='cod',key=randomUUID(),qty=1)=>(await c.query('CALL place_order($1,$2::jsonb,$3,$4::jsonb,$5,NULL,NULL)',[u,JSON.stringify([{product_id:p,quantity:qty}]),method,JSON.stringify({name:'Test',phone:'0900000000',detail:'Địa chỉ test'}),key])).rows[0];

test('wallet checkout, repeated request, cancel and repeat cancel are atomic and idempotent',async()=>{
 const {user,product}=await fixture(),key=randomUUID();const out=await tx(c=>call(c,user.id,product.id,'wallet',key,2));
 assert.equal(Number(out.p_total),200000);assert.ok(out.p_order_id);
 const again=await tx(c=>call(c,user.id,product.id,'wallet',key,2));assert.equal(again.p_order_id,out.p_order_id);
 assert.equal((await db.query('SELECT stock FROM products WHERE id=$1',[product.id])).rows[0].stock,8);
 assert.equal(Number((await db.query('SELECT wallet_balance FROM users WHERE id=$1',[user.id])).rows[0].wallet_balance),800000);
 await tx(c=>c.query('CALL cancel_order($1,$2,NULL)',[user.id,out.p_order_id]));await tx(c=>c.query('CALL cancel_order($1,$2,NULL)',[user.id,out.p_order_id]));
 assert.equal((await db.query('SELECT stock FROM products WHERE id=$1',[product.id])).rows[0].stock,10);
 assert.equal(Number((await db.query('SELECT wallet_balance FROM users WHERE id=$1',[user.id])).rows[0].wallet_balance),1000000);
 assert.equal((await db.query('SELECT status FROM payments WHERE order_id=$1',[out.p_order_id])).rows[0].status,'refunded');
});
test('SQL failure after successful procedure rolls back order, stock, wallet, audit and notifications',async()=>{
 const {user,product}=await fixture();const snapshot=async()=>({stock:(await db.query('SELECT stock FROM products WHERE id=$1',[product.id])).rows[0].stock,wallet:(await db.query('SELECT wallet_balance FROM users WHERE id=$1',[user.id])).rows[0].wallet_balance,orders:(await db.query('SELECT count(*) FROM orders')).rows[0].count,logs:(await db.query('SELECT count(*) FROM audit_logs')).rows[0].count,notifications:(await db.query('SELECT count(*) FROM notifications')).rows[0].count});
 const before=await snapshot();await assert.rejects(tx(async c=>{await call(c,user.id,product.id,'wallet');await c.query('SELECT 1/0');}));assert.deepEqual(await snapshot(),before);
});
test('two concurrent buyers cannot buy the same last unit',async()=>{
 const a=await fixture(1),b=await fixture(1);
 const result=await Promise.allSettled([tx(c=>call(c,a.user.id,a.product.id)),tx(c=>call(c,b.user.id,a.product.id))]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(result.filter(r=>r.status==='rejected').length,1);
 assert.equal((await db.query('SELECT stock FROM products WHERE id=$1',[a.product.id])).rows[0].stock,0);
});
test('insufficient wallet and negative stock constraints leave no partial purchase',async()=>{
 const {user,product}=await fixture(2,0);await assert.rejects(tx(c=>call(c,user.id,product.id,'wallet')),/Số dư/);
 assert.equal((await db.query('SELECT count(*) FROM orders WHERE user_id=$1',[user.id])).rows[0].count,'0');
 await assert.rejects(db.query('UPDATE products SET stock=-1 WHERE id=$1',[product.id]),e=>e.code==='23514');
 await assert.rejects(tx(c=>call(c,user.id,product.id,'cod',randomUUID(),-1)),/Số lượng/);
});
test('trigger records OLD/NEW sort and price, broadcasts price reduction and ignores no-op',async()=>{
 const {product}=await fixture();await db.query('UPDATE products SET sort_order=7,price=90000 WHERE id=$1',[product.id]);
 const log=(await db.query("SELECT * FROM audit_logs WHERE record_id=$1 AND operation='UPDATE' ORDER BY id DESC LIMIT 1",[String(product.id)])).rows[0];
 assert.equal(log.old_data.sort_order,0);assert.equal(log.new_data.sort_order,7);assert.equal(log.old_data.price,100000);assert.equal(log.new_data.price,90000);
 assert.ok((await db.query("SELECT * FROM notifications WHERE audience='all' AND body LIKE '%90000%'")).rowCount>0);
 const count=(await db.query('SELECT count(*) FROM audit_logs')).rows[0].count;await db.query('UPDATE products SET sort_order=sort_order WHERE id=$1',[product.id]);assert.equal((await db.query('SELECT count(*) FROM audit_logs')).rows[0].count,count);
 await db.query("UPDATE products SET embedding=ARRAY[1.0,0.0],embedding_model='test' WHERE id=$1",[product.id]);await db.query('UPDATE products SET min_age=4 WHERE id=$1',[product.id]);assert.equal((await db.query('SELECT embedding FROM products WHERE id=$1',[product.id])).rows[0].embedding,null);
});
test('cosine similarity ranks genuine vectors and rejects incompatible dimensions',async()=>{
 const r=(await db.query('SELECT cosine_similarity(ARRAY[1.0,0.0]::float8[],ARRAY[1.0,0.0]::float8[]) same,cosine_similarity(ARRAY[1.0,0.0]::float8[],ARRAY[0.0,1.0]::float8[]) orthogonal,cosine_similarity(ARRAY[1.0,0.0]::float8[],ARRAY[1.0]::float8[]) mismatch')).rows[0];
 assert.equal(r.same,1);assert.equal(r.orthogonal,0);assert.equal(r.mismatch,null);
});
