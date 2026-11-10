import {z} from 'zod';
import {pool,transaction} from './db.mjs';
import {requireUser,requireAdmin} from './auth.mjs';

const message=z.object({body:z.string().trim().min(1).max(2000),order_id:z.string().uuid().nullable().optional(),request_key:z.string().uuid()});
export function supportRoutes(app){
  const read=async(customer)=>(await pool.query(`SELECT m.id,m.body,m.order_id,m.created_at,u.role sender_role,u.name sender_name,o.number order_number FROM (SELECT * FROM support_messages WHERE customer_id=$1 ORDER BY id DESC LIMIT 100) m JOIN users u ON u.id=m.sender_id LEFT JOIN orders o ON o.id=m.order_id ORDER BY m.id`,[customer])).rows;
  async function send(req,res,customer){
    const b=message.parse(req.body);
    const result=await transaction(req.user.email,async c=>{
      if(!(await c.query("SELECT 1 FROM users WHERE id=$1 AND role='customer'",[customer])).rowCount)throw Object.assign(new Error('Không tìm thấy khách hàng.'),{status:404});
      if(b.order_id&&!(await c.query('SELECT 1 FROM orders WHERE id=$1 AND user_id=$2',[b.order_id,customer])).rowCount)throw Object.assign(new Error('Đơn hàng không thuộc khách hàng này.'),{status:403});
      const r=await c.query('INSERT INTO support_messages(customer_id,sender_id,body,order_id,request_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(sender_id,request_key) DO NOTHING RETURNING id',[customer,req.user.id,b.body,b.order_id||null,b.request_key]);
      if(r.rowCount)await c.query('INSERT INTO notifications(audience,user_id,title,body) VALUES($1,$2,$3,$4)',[req.user.role==='admin'?'user':'admin',req.user.role==='admin'?customer:null,req.user.role==='admin'?'Admin đã trả lời bạn':'Tin nhắn khách hàng mới',b.body.slice(0,160)]);
      return {ok:true};
    });res.status(201).json(result);
  }
  const customerOnly=(req,res,next)=>req.user.role==='customer'?next():res.status(403).json({error:'Admin vui lòng mở Hộp thư khách hàng.'});
  app.get('/api/support',requireUser,customerOnly,async(req,res)=>res.json({messages:await read(req.user.id)}));
  app.post('/api/support',requireUser,customerOnly,async(req,res)=>send(req,res,req.user.id));
  app.get('/api/admin/support',requireUser,requireAdmin,async(req,res)=>{
    const customers=(await pool.query(`SELECT u.id,u.name,u.email,(SELECT body FROM support_messages WHERE customer_id=u.id ORDER BY id DESC LIMIT 1) last_message,(SELECT max(created_at) FROM support_messages WHERE customer_id=u.id) last_at FROM users u WHERE u.role='customer' ORDER BY last_at DESC NULLS LAST,u.name`)).rows;res.json({customers});
  });
  app.get('/api/admin/support/:id',requireUser,requireAdmin,async(req,res)=>res.json({messages:await read(z.string().uuid().parse(req.params.id))}));
  app.post('/api/admin/support/:id',requireUser,requireAdmin,async(req,res)=>send(req,res,z.string().uuid().parse(req.params.id)));
}
