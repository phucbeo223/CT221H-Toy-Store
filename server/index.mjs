import express from 'express';
import {rateLimit} from 'express-rate-limit';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {pool,transaction} from './db.mjs';
import {hashPassword,verifyPassword,createSession,identify,requireUser,requireAdmin,digest} from './auth.mjs';
import {embed,indexProducts,model,indexingProgress} from './gemini.mjs';
import {PRODUCT_CATEGORIES} from '../lib/categories.mjs';
import {answerChat} from './chat.mjs';
import {supportRoutes} from './support.mjs';

const app=express();
const appOrigin=process.env.APP_ORIGIN||'http://127.0.0.1:5173';
const allowedOrigins=new Set([appOrigin]);
const localOrigin=new URL(appOrigin);
if(['127.0.0.1','localhost'].includes(localOrigin.hostname)){
  localOrigin.hostname=localOrigin.hostname==='localhost'?'127.0.0.1':'localhost';allowedOrigins.add(localOrigin.origin);
}
app.disable('x-powered-by');
app.use(express.json({limit:'100kb'}));
app.use((req,res,next)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin&&!allowedOrigins.has(req.headers.origin))return res.status(403).json({error:'Nguồn yêu cầu không hợp lệ.'});
  next();
});
app.use(identify);
const authLimit=rateLimit({windowMs:15*60000,limit:40,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.'}});
const aiLimit=rateLimit({windowMs:60000,limit:20,message:{error:'Vui lòng chờ một phút trước khi tìm kiếm tiếp.'}});
const publicProduct='id,sku,name,description,category,price,original_price,stock,min_age,max_age,art,color,badge,sort_order,active,image_url,image_alt,image_source_url,source_url,source_name,brand';
const uuid=z.string().uuid();
const address=z.object({name:z.string().trim().min(2).max(100),phone:z.string().regex(/^(\+84|0)[0-9]{9,10}$/,'Số điện thoại không hợp lệ'),detail:z.string().trim().min(8).max(500)});
const productSchema=z.object({sku:z.string().trim().min(2).max(50),name:z.string().trim().min(3).max(150),description:z.string().trim().min(10).max(3000),category:z.enum(PRODUCT_CATEGORIES),price:z.coerce.number().int().min(1000).max(100000000),original_price:z.coerce.number().int().min(0).max(100000000).nullable().optional(),stock:z.coerce.number().int().min(0).max(100000),min_age:z.coerce.number().int().min(0).max(18),max_age:z.coerce.number().int().min(0).max(99),art:z.enum(['blocks','bear','car','robot','dino','rocket','puzzle','music']),color:z.string().regex(/^#[a-fA-F0-9]{6}$/),badge:z.string().trim().max(30).nullable().optional(),sort_order:z.coerce.number().int().min(0).max(10000),active:z.boolean(),image_url:z.string().max(500).regex(/^\/products\/[a-z0-9-]+\.(jpg|png|webp|avif)$/).nullable().optional(),image_alt:z.string().max(180).nullable().optional()}).refine(p=>p.max_age>=p.min_age,{message:'Tuổi tối đa phải lớn hơn hoặc bằng tuổi tối thiểu'});

app.get('/api/health',async(req,res)=>{await pool.query('SELECT 1');res.json({ok:true,database:'PostgreSQL',gemini:!!process.env.GEMINI_API_KEY});});
app.get('/api/auth/me',(req,res)=>res.json({user:req.user||null}));
app.post('/api/auth/login',authLimit,async(req,res)=>{
  const body=z.object({email:z.string().email().max(200),password:z.string().min(1).max(128)}).parse(req.body);
  const u=(await pool.query('SELECT * FROM users WHERE email=$1',[body.email.toLowerCase()])).rows[0];
  if(!u||!verifyPassword(body.password,u.password_hash))return res.status(401).json({error:'Email hoặc mật khẩu không đúng.'});
  await createSession(res,u.id);res.json({ok:true});
});
app.post('/api/auth/register',authLimit,async(req,res)=>{
  const b=z.object({name:z.string().trim().min(2).max(100),email:z.string().email().max(200),password:z.string().min(8).max(128)}).parse(req.body);
  const r=await pool.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id',[b.name,b.email.toLowerCase(),hashPassword(b.password)]);
  await createSession(res,r.rows[0].id);res.status(201).json({ok:true});
});
app.post('/api/auth/logout',async(req,res)=>{if(req.sessionToken)await pool.query('DELETE FROM sessions WHERE token_hash=$1',[digest(req.sessionToken)]);res.clearCookie('toyjoy_session',{path:'/'});res.json({ok:true});});

app.get('/api/products',async(req,res)=>{
  const q=z.object({q:z.string().max(150).optional(),category:z.string().max(50).optional(),age:z.coerce.number().int().min(0).max(18).optional(),sort:z.enum(['popular','price-asc','price-desc','newest']).default('popular')}).parse(req.query);
  const params=[],conditions=['active'];
  if(q.q){params.push('%'+q.q.replace(/[\\%_]/g,'\\$&')+'%');conditions.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`);}
  if(q.category){params.push(q.category);conditions.push(`category=$${params.length}`);}
  if(q.age!==undefined){params.push(q.age);conditions.push(`min_age<=$${params.length} AND max_age>=$${params.length}`);}
  const sort={popular:'sort_order,id','price-asc':'price,id','price-desc':'price DESC,id',newest:'id DESC'}[q.sort];
  const r=await pool.query(`SELECT ${publicProduct} FROM products WHERE ${conditions.join(' AND ')} ORDER BY ${sort} LIMIT 100`,params);
  res.json({products:r.rows});
});
app.post('/api/search/semantic',aiLimit,async(req,res)=>{
  const b=z.object({query:z.string().trim().min(3).max(500),category:z.string().max(50).optional(),age:z.coerce.number().int().min(0).max(18).optional()}).parse(req.body);
  if(!process.env.GEMINI_API_KEY)return res.status(503).json({error:'Tìm kiếm AI đang chờ Gemini API key. Bạn có thể dùng tìm kiếm từ khóa.',code:'GEMINI_NOT_CONFIGURED'});
  const count=Number((await pool.query('SELECT count(*) FROM products WHERE active AND embedding IS NOT NULL AND embedding_model=$1',[model()])).rows[0].count);
  if(!count)return res.status(409).json({error:'Chưa có embedding sản phẩm. Quản trị viên cần đồng bộ trong mục AI.'});
  const vector=await embed(b.query,'RETRIEVAL_QUERY');
  const r=await pool.query(`SELECT ${publicProduct},cosine_similarity(embedding,$1::double precision[]) AS similarity FROM products WHERE active AND embedding IS NOT NULL AND embedding_model=$2 AND ($3::text IS NULL OR category=$3) AND ($4::int IS NULL OR (min_age<=$4 AND max_age>=$4)) ORDER BY similarity DESC NULLS LAST LIMIT 12`,[vector,model(),b.category||null,b.age??null]);
  res.json({products:r.rows,mode:'semantic',model:model()});
});

app.post('/api/chat',aiLimit,async(req,res)=>{
  const b=z.object({message:z.string().trim().min(1).max(1000),history:z.array(z.object({role:z.enum(['user','assistant']),text:z.string().trim().min(1).max(6000)})).max(10).default([])}).parse(req.body);
  res.json(await answerChat({...b,user:req.user}));
});
supportRoutes(app);

app.use('/api/orders',requireUser);
app.get('/api/orders',async(req,res)=>{
  const r=await pool.query(`SELECT o.*,p.status payment_status,COALESCE((SELECT json_agg(json_build_object('product_id',i.product_id,'name',pr.name,'art',pr.art,'color',pr.color,'image_url',pr.image_url,'image_alt',pr.image_alt,'quantity',i.quantity,'unit_price',i.unit_price)) FROM order_items i JOIN products pr ON pr.id=i.product_id WHERE i.order_id=o.id),'[]') items FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 100`,[req.user.id]);res.json({orders:r.rows});
});
app.post('/api/orders',async(req,res)=>{
  const b=z.object({items:z.array(z.object({product_id:z.number().int().positive(),quantity:z.number().int().min(1).max(20)})).min(1).max(50),method:z.enum(['cod','wallet']),address,request_key:uuid}).parse(req.body);
  const result=await transaction(req.user.email,async c=>(await c.query('CALL place_order($1,$2::jsonb,$3,$4::jsonb,$5,NULL,NULL)',[req.user.id,JSON.stringify(b.items),b.method,JSON.stringify(b.address),b.request_key])).rows[0]);
  res.status(201).json(result);
});
app.post('/api/orders/:id/cancel',async(req,res)=>{const id=uuid.parse(req.params.id);res.json(await transaction(req.user.email,async c=>(await c.query('CALL cancel_order($1,$2,NULL)',[req.user.id,id])).rows[0]));});

app.get('/api/notifications',requireUser,async(req,res)=>{
  const r=await pool.query(`SELECT n.*,r.notification_id IS NOT NULL AS read FROM notifications n LEFT JOIN notification_reads r ON r.notification_id=n.id AND r.user_id=$1 WHERE n.audience='all' OR n.user_id=$1 OR (n.audience='admin' AND $2='admin') ORDER BY n.created_at DESC,n.id DESC LIMIT 50`,[req.user.id,req.user.role]);res.json({notifications:r.rows});
});
app.post('/api/notifications/read',requireUser,async(req,res)=>{
  await pool.query(`INSERT INTO notification_reads(user_id,notification_id) SELECT $1,id FROM notifications WHERE audience='all' OR user_id=$1 OR (audience='admin' AND $2='admin') ON CONFLICT DO NOTHING`,[req.user.id,req.user.role]);res.json({ok:true});
});

app.use('/api/admin',requireUser,requireAdmin);
app.get('/api/admin/dashboard',async(req,res)=>{
  const [stats,chart,low]=await Promise.all([
    pool.query(`SELECT (SELECT count(*) FROM products WHERE active) products,(SELECT count(*) FROM orders WHERE status<>'cancelled') orders,(SELECT count(*) FROM users WHERE role='customer') customers,(SELECT coalesce(sum(amount),0) FROM payments WHERE status='paid') revenue`),
    pool.query(`SELECT d::date AS "day",COALESCE(sum(o.total),0) revenue,count(o.id) orders FROM generate_series(current_date-13,current_date,interval '1 day') d LEFT JOIN orders o ON o.created_at>=d AND o.created_at<d+interval '1 day' AND o.status<>'cancelled' GROUP BY d ORDER BY d`),
    pool.query(`SELECT ${publicProduct} FROM products WHERE active AND stock<=10 ORDER BY stock`)
  ]);res.json({stats:stats.rows[0],chart:chart.rows,lowStock:low.rows});
});
app.get('/api/admin/products',async(req,res)=>res.json({products:(await pool.query(`SELECT ${publicProduct} FROM products ORDER BY sort_order,id`)).rows}));
app.post('/api/admin/products',async(req,res)=>{
  const b=productSchema.parse(req.body),keys=Object.keys(b);res.status(201).json(await transaction(req.user.email,async c=>(await c.query(`INSERT INTO products(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING ${publicProduct}`,Object.values(b))).rows[0]));
});
app.put('/api/admin/products/:id',async(req,res)=>{
  const id=z.coerce.number().int().positive().parse(req.params.id),b=productSchema.parse(req.body),keys=Object.keys(b);
  const p=await transaction(req.user.email,async c=>(await c.query(`UPDATE products SET ${keys.map((k,i)=>k+'=$'+(i+1)).join(',')} WHERE id=$${keys.length+1} RETURNING ${publicProduct}`,[...Object.values(b),id])).rows[0]);
  if(!p)return res.status(404).json({error:'Không tìm thấy sản phẩm.'});res.json(p);
});
app.get('/api/admin/orders',async(req,res)=>res.json({orders:(await pool.query('SELECT o.*,u.name,u.email,p.status payment_status FROM orders o JOIN users u ON u.id=o.user_id JOIN payments p ON p.order_id=o.id ORDER BY o.created_at DESC LIMIT 200')).rows}));
app.post('/api/admin/orders/:id/status',async(req,res)=>{
  const id=uuid.parse(req.params.id),{status}=z.object({status:z.enum(['shipping','completed'])}).parse(req.body);
  await transaction(req.user.email,async c=>{
    const o=(await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!o)throw Object.assign(new Error('Không tìm thấy đơn.'),{status:404});
    const allowed={pending:['shipping'],paid:['shipping'],shipping:['completed']};
    if(!allowed[o.status]?.includes(status))throw Object.assign(new Error('Chuyển trạng thái không hợp lệ.'),{status:409});
    await c.query('UPDATE orders SET status=$1 WHERE id=$2',[status,id]);
    if(status==='completed')await c.query("UPDATE payments SET status='paid',updated_at=now() WHERE order_id=$1",[id]);
  });res.json({ok:true});
});
app.get('/api/admin/audit',async(req,res)=>res.json({logs:(await pool.query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100')).rows}));
app.post('/api/admin/notifications',async(req,res)=>{const b=z.object({title:z.string().trim().min(3).max(120),body:z.string().trim().min(5).max(1000)}).parse(req.body);await pool.query("INSERT INTO notifications(audience,title,body) VALUES('all',$1,$2)",[b.title,b.body]);res.json({ok:true});});

app.get('/api/admin/database',async(req,res)=>{
  const [procedures,triggers,indexes,benchmarks]=await Promise.all([
    pool.query("SELECT p.proname name,pg_get_function_arguments(p.oid) arguments FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='p'"),
    pool.query("SELECT trigger_name name,event_manipulation event,event_object_table table_name FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY 1,2"),
    pool.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname"),
    pool.query('SELECT * FROM benchmark_results ORDER BY id DESC LIMIT 10')
  ]);res.json({procedures:procedures.rows,triggers:triggers.rows,indexes:indexes.rows,benchmarks:benchmarks.rows});
});
app.post('/api/admin/database/rollback',async(req,res)=>{
  const c=await pool.connect();let rolledBack=false;
  try{
    const p=(await c.query('SELECT id,price FROM products WHERE active AND stock>0 ORDER BY price,id LIMIT 1')).rows[0];if(!p)throw new Error('Cần ít nhất một sản phẩm còn hàng.');
    const snapshot=async()=> (await c.query(`SELECT (SELECT stock FROM products WHERE id=$1) stock,(SELECT count(*) FROM orders WHERE user_id=$2) orders,(SELECT wallet_balance FROM users WHERE id=$2) wallet,(SELECT count(*) FROM audit_logs) audit_logs,(SELECT count(*) FROM notifications) notifications`,[p.id,req.user.id])).rows[0];
    const before=await snapshot();await c.query('BEGIN');await c.query("SELECT set_config('app.actor',$1,true)",[req.user.email+' (rollback demo)']);
    const output=(await c.query('CALL place_order($1,$2::jsonb,$3,$4::jsonb,$5,NULL,NULL)',[req.user.id,JSON.stringify([{product_id:p.id,quantity:1}]),Number(req.user.wallet_balance)>=Number(p.price)?'wallet':'cod',JSON.stringify({name:'Rollback demo',phone:'0900000000',detail:'Không giao hàng - dữ liệu thử'}),randomUUID()])).rows[0];
    const during=await snapshot();
    // Deliberate SQL error after order, stock and trigger writes.
    try{await c.query('SELECT 1/0');}catch{await c.query('ROLLBACK');rolledBack=true;}
    const after=await snapshot();res.json({before,during,after,restored:JSON.stringify(before)===JSON.stringify(after),output,error:'division by zero',steps:['BEGIN','CALL place_order(...)','Ghi đơn, trừ kho, chạy trigger','SELECT 1/0 → lỗi có chủ đích','ROLLBACK','Đọc lại dữ liệu để đối chiếu']});
  }finally{if(!rolledBack)await c.query('ROLLBACK');c.release();}
});
let benchmarking=false;
app.post('/api/admin/database/benchmark',async(req,res)=>{
  if(benchmarking)return res.status(409).json({error:'Đang đo hiệu năng. Vui lòng chờ.'});benchmarking=true;const c=await pool.connect();
  try{
    await c.query('BEGIN');await c.query("SET LOCAL statement_timeout='30s'");
    await c.query("CREATE TEMP TABLE bench_products ON COMMIT DROP AS SELECT n id,'TOY-'||lpad(n::text,8,'0') sku,(n%5) category,100000+(n%100)*1000 price FROM generate_series(1,200000) n");await c.query('ANALYZE bench_products');
    const query="EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT * FROM bench_products WHERE sku='TOY-00199999'";
    const measure=async()=>{const runs=[];let plan;for(let i=0;i<7;i++){plan=(await c.query(query)).rows[0]['QUERY PLAN'][0];runs.push(plan['Execution Time']);}runs.sort((a,b)=>a-b);return {ms:runs[3],plan,runs};};
    await c.query(query);const before=await measure();await c.query('CREATE INDEX idx_bench_sku ON bench_products(sku)');await c.query('ANALYZE bench_products');await c.query(query);const after=await measure();
    const result=(await c.query('INSERT INTO benchmark_results(row_count,before_ms,after_ms,before_plan,after_plan) VALUES(200000,$1,$2,$3,$4) RETURNING *',[before.ms,after.ms,JSON.stringify(before.plan),JSON.stringify(after.plan)])).rows[0];await c.query('COMMIT');res.json({...result,query:query.replace('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ',''),before_runs:before.runs,after_runs:after.runs});
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();benchmarking=false;}
});

app.get('/api/admin/ai',async(req,res)=>res.json({configured:!!process.env.GEMINI_API_KEY,model:model(),index_status:indexingProgress(),...(await pool.query('SELECT count(*)::int total,count(*) FILTER(WHERE embedding IS NOT NULL AND embedding_model=$1)::int indexed FROM products WHERE active',[model()])).rows[0]}));
app.post('/api/admin/ai/index',async(req,res)=>res.json(await indexProducts()));
app.get('/api/admin/insights',async(req,res)=>{
  const [forecast,segments]=await Promise.all([
    pool.query(`SELECT p.id,p.name,p.stock,p.art,p.color,COALESCE(sum(i.quantity) FILTER(WHERE o.created_at>=current_date-28 AND o.created_at<current_date),0)::int sold_28,COALESCE(sum(i.quantity) FILTER(WHERE o.created_at>=current_date-7 AND o.created_at<current_date),0)::int sold_7,COALESCE(sum(i.quantity) FILTER(WHERE o.created_at>=current_date-14 AND o.created_at<current_date-7),0)::int previous_7,ceil(COALESCE(sum(i.quantity) FILTER(WHERE o.created_at>=current_date-28 AND o.created_at<current_date),0)/28.0*7)::int forecast_7 FROM products p LEFT JOIN order_items i ON i.product_id=p.id AND i.order_id IN(SELECT id FROM orders WHERE status IN('paid','shipping','completed')) LEFT JOIN orders o ON o.id=i.order_id WHERE p.active GROUP BY p.id ORDER BY forecast_7 DESC,p.id`),
    pool.query(`SELECT u.id,u.name,u.email,count(o.id)::int frequency,COALESCE(sum(o.total),0) monetary,EXTRACT(DAY FROM now()-max(o.created_at))::int recency,CASE WHEN count(o.id)=0 THEN 'Khách hàng mới' WHEN max(o.created_at)<now()-interval '30 days' THEN 'Cần chăm sóc' WHEN sum(o.total)>=2000000 AND count(o.id)>=3 THEN 'Khách hàng thân thiết' ELSE 'Khách hàng tiềm năng' END segment FROM users u LEFT JOIN orders o ON o.user_id=u.id AND o.status IN('paid','shipping','completed') WHERE u.role='customer' GROUP BY u.id ORDER BY monetary DESC`)
  ]);res.json({forecast:forecast.rows,segments:segments.rows,method:'Trung bình bán hàng 28 ngày để dự báo 7 ngày; phân nhóm khách theo quy tắc RFM. Đây là baseline thống kê, không gọi Gemini và chưa phải mô hình ML đã huấn luyện.'});
});

app.use((err,req,res,next)=>{
  if(err instanceof z.ZodError)return res.status(400).json({error:err.issues.map(v=>v.message).join('. ')});
  if(err.code==='23505')return res.status(409).json({error:'Email hoặc mã sản phẩm đã tồn tại.'});
  if(err.code==='P0001')return res.status(409).json({error:err.message});
  if(['23514','23503','22P02'].includes(err.code))return res.status(400).json({error:'Dữ liệu vi phạm ràng buộc cơ sở dữ liệu.'});
  if(err.type==='entity.parse.failed')return res.status(400).json({error:'Nội dung JSON không hợp lệ.'});
  console.error(req.method,req.path,err.message);res.status(err.status||500).json({error:err.status?err.message:'Không thể xử lý yêu cầu. Vui lòng thử lại.'});
});
const server=app.listen(Number(process.env.PORT||3001),'127.0.0.1',()=>console.log(`Toyjoy API http://127.0.0.1:${process.env.PORT||3001}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await pool.end();process.exit(0);}));
