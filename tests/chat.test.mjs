import {test} from 'node:test';
import assert from 'node:assert/strict';
import {answerChat} from '../server/chat.mjs';

test('chat grounds answers in current products, semantic follow-ups without sending private records to Gemini',async()=>{
 const previous=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-key';
 const calls=[];let payload,embeddingQuery;
 const product={id:7,name:'Tên lửa',price:300000,stock:3,min_age:6,max_age:12};
 const deps={db:{query:async(sql,args)=>{calls.push({sql,args});if(sql.includes('count(*)'))return {rows:[{count:1}]};if(sql.includes('FROM orders'))return {rows:[{number:42,status:'paid'}]};return {rows:[product]};}},embed:async q=>{embeddingQuery=q;return [1,0];},fetch:async(url,options)=>{payload=JSON.parse(options.body);assert.match(url,/:generateContent$/);return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({reply:'Đồ chơi phù hợp với bé.',product_ids:[7,999]})}]}}]})};}};
 try{
  const result=await answerChat({message:'Có món rẻ hơn không?',history:[{role:'user',text:'Bé 6 tuổi thích vũ trụ'}],user:{id:'session-owner',role:'customer'}},deps);
  assert.match(embeddingQuery,/6 tuổi/);assert.equal(result.retrieval,'semantic');assert.equal(result.products[0].id,7);
  assert.equal(calls.some(c=>c.sql.includes('FROM orders')),false);
  assert.match(payload.systemInstruction.parts[0].text,/300000/);assert.equal(payload.contents.at(-1).parts[0].text,'Có món rẻ hơn không?');
 }finally{if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;}
});

test('chat exposes unavailable configuration and upstream errors, with no invented success',async()=>{
 const previous=process.env.GEMINI_API_KEY;
 try{
  delete process.env.GEMINI_API_KEY;await assert.rejects(answerChat({message:'Xin chào'}),e=>e.status===503);
  process.env.GEMINI_API_KEY='test-key';
  const db={query:async sql=>({rows:sql.includes('count(*)')?[{count:0}]:[]})};
  await assert.rejects(answerChat({message:'Xin chào'},{db,fetch:async()=>({ok:false,status:429})}),e=>e.status===502&&/429/.test(e.message));
  await assert.rejects(answerChat({message:'Xin chào'},{db,fetch:async()=>({ok:true,json:async()=>({candidates:[]})})}),e=>e.status===502);
 }finally{if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;}
});


test('private order and admin analytics questions stay local even without a Gemini key',async()=>{
 const calls=[];
 const deps={db:{query:async(sql,args)=>{
   calls.push({sql,args});
   if(sql.includes('AS impossible'))throw new Error('unexpected');
   if(sql.includes('low_stock'))return {rows:[{collected:123000,customers:1,orders:2,low_stock:0}]};
   if(sql.includes('segment'))return {rows:[{name:'Private customer',segment:'Khách hàng tiềm năng'}]};
   if(sql.includes('forecast_7'))return {rows:[{name:'Toy',stock:5,forecast_7:2}]};
   return {rows:[{number:42,status:'paid',total:100000}]};
 }},fetch:()=>{throw new Error('Private data must not reach Gemini');},embed:()=>{throw new Error('Private data must not be embedded');}};
 const order=await answerChat({message:'Đơn hàng của tôi?',user:{id:'verified-user',role:'customer',wallet_balance:900000}},deps);
 assert.equal(order.retrieval,'local');assert.match(order.reply,/00042/);assert.deepEqual(calls[0].args,['verified-user']);
 const admin=await answerChat({message:'Doanh thu và phân nhóm khách hàng?',user:{id:'admin',role:'admin'}},deps);
 assert.equal(admin.retrieval,'local');assert.match(admin.reply,/123.000/);assert.match(admin.reply,/Private customer/);
});
