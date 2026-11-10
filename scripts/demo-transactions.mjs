// Creates an idempotent, explicitly labelled walkthrough using the real HTTP APIs.
import {createHash} from 'node:crypto';
const base=process.env.API_ORIGIN||'http://127.0.0.1:3001';
const key=label=>{const s=createHash('sha256').update('toyjoy-demo-v1:'+label).digest('hex');return `${s.slice(0,8)}-${s.slice(8,12)}-4${s.slice(13,16)}-a${s.slice(17,20)}-${s.slice(20,32)}`;};
async function call(path,cookie,body){const r=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw new Error(path+': '+data.error);return data;}
async function login(email,password){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});if(!r.ok)throw new Error('Không đăng nhập được tài khoản demo '+email);return r.headers.get('set-cookie').split(';')[0];}
const admin=await login('admin@toyjoy.vn','Admin@12345');
try{
 const products=(await call('/products?sort=price-asc')).products.filter(p=>p.stock>0&&Number(p.price)<=500000);
 if(products.length<8)throw new Error('Cần ít nhất 8 sản phẩm còn hàng, giá không quá 500.000đ.');
 for(let i=0;i<8;i++){
  const email=i?`demo${i}@toyjoy.vn`:'hello@toyjoy.vn';
  const cookie=await login(email,'Toyjoy@123');
  try{
   const user=(await call('/auth/me',cookie)).user;
   const result=await call('/orders',cookie,{items:[{product_id:products[i].id,quantity:1}],method:i<2?'cod':'wallet',address:{name:user.name,phone:'0900000000',detail:'ĐƠN DEMO ĐỒ ÁN — không giao hàng thực tế'},request_key:key(email+':order')});
   const orderId=result.p_order_id;
   const message={body:`[DEMO ĐỒ ÁN] Tôi đã đặt ${products[i].name}. Nhờ admin hỗ trợ ${i>=6?'hủy và hoàn ví':'xác nhận và giao hàng'}.`,order_id:orderId,request_key:key(email+':customer-message')};
   await call('/support',cookie,message);
   let order=(await call('/orders',cookie)).orders.find(o=>o.id===orderId);
   if(i>=6){if(['pending','paid'].includes(order.status))await call('/orders/'+orderId+'/cancel',cookie,{});}
   else if(i>=2){
    if(['pending','paid'].includes(order.status))await call('/admin/orders/'+orderId+'/status',admin,{status:'shipping'});
    order=(await call('/orders',cookie)).orders.find(o=>o.id===orderId);
    if(i>=4&&order.status==='shipping')await call('/admin/orders/'+orderId+'/status',admin,{status:'completed'});
   }
   const reply=i>=6?'Đơn đã hủy, tiền đã hoàn về ví demo.':i>=4?'Đơn đã hoàn tất. Cảm ơn bạn đã mua hàng!':i>=2?'Đơn đã xác nhận và đang giao.':'Đã nhận đơn COD, admin sẽ xác nhận sớm.';
   await call('/admin/support/'+user.id,admin,{body:'[DEMO ĐỒ ÁN] '+reply,order_id:orderId,request_key:key(email+':admin-message')});
   order=(await call('/orders',cookie)).orders.find(o=>o.id===orderId);
   console.log(`${email}: TJ-${String(order.number).padStart(5,'0')} · ${order.status} · ${order.total}đ · đã trao đổi với admin`);
  }finally{await call('/auth/logout',cookie,{});}
 }
}finally{await call('/auth/logout',admin,{});}
