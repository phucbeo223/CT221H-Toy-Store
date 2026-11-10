import {digest} from './auth.mjs';
import {pool} from './db.mjs';
export const model=()=>process.env.GEMINI_EMBEDDING_MODEL||'gemini-embedding-001';
export const productText=p=>`${p.name}. ${p.category}. Độ tuổi ${p.min_age}-${p.max_age}. ${p.description}`;
export async function embed(text,taskType){
  if(!process.env.GEMINI_API_KEY)throw Object.assign(new Error('Chưa cấu hình GEMINI_API_KEY. Quản trị viên có thể bổ sung khóa trong .env.'),{status:503});
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model())}:embedContent`,{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
    body:JSON.stringify({model:`models/${model()}`,content:{parts:[{text}]},taskType,outputDimensionality:768}),signal:AbortSignal.timeout(20000)
  });
  if(!response.ok)throw Object.assign(new Error(`Gemini chưa trả được kết quả (HTTP ${response.status}). Kiểm tra khóa, hạn mức và tên mô hình.`),{status:502});
  const values=(await response.json()).embedding?.values;
  if(!Array.isArray(values)||values.length!==768||values.some(v=>!Number.isFinite(v)))throw Object.assign(new Error('Embedding Gemini trả về không hợp lệ.'),{status:502});
  return values;
}
let indexing=false;
let progress={running:false,total:0,completed:0,indexed:0,skipped:0,failed:0,error:null,started_at:null,finished_at:null};
export const indexingProgress=()=>({...progress});
export async function indexProducts(){
  if(indexing)throw Object.assign(new Error('Đang tạo embedding. Vui lòng chờ.'),{status:409});
  if(!process.env.GEMINI_API_KEY)throw Object.assign(new Error('Chưa cấu hình Gemini API key.'),{status:503});
  indexing=true;
  progress={running:true,total:0,completed:0,indexed:0,skipped:0,failed:0,error:null,started_at:new Date().toISOString(),finished_at:null};
  try{
    const products=(await pool.query('SELECT * FROM products WHERE active ORDER BY id')).rows;
    progress.total=products.length;let cursor=0;
    const workers=Array.from({length:3},async()=>{
      while(cursor<products.length&&!progress.error){
        const p=products[cursor++],text=productText(p),hash=digest(text);
        try{
          if(p.embedding&&p.embedding_hash===hash&&p.embedding_model===model()){progress.skipped++;continue;}
          const vector=await embed(text,'RETRIEVAL_DOCUMENT');
          const r=await pool.query('UPDATE products SET embedding=$1,embedding_hash=$2,embedding_model=$3 WHERE id=$4 AND name=$5 AND description=$6 AND category=$7 AND min_age=$8 AND max_age=$9',[vector,hash,model(),p.id,p.name,p.description,p.category,p.min_age,p.max_age]);
          if(!r.rowCount)throw new Error('Sản phẩm đã thay đổi khi tạo embedding. Bấm đồng bộ lại.');
          progress.indexed+=r.rowCount;
        }catch(e){progress.failed++;progress.error=e.message;}
        finally{progress.completed++;}
      }
    });
    // Await all in-flight requests even after an error, so a retry cannot overlap.
    await Promise.allSettled(workers);
    if(progress.error)throw Object.assign(new Error(`${progress.error} Đã đồng bộ ${progress.indexed} sản phẩm; có thể bấm lại để tiếp tục phần còn lại.`),{status:502});
    return {indexed:progress.indexed,skipped:progress.skipped,total:progress.total};
  }finally{indexing=false;progress.running=false;progress.finished_at=new Date().toISOString();}
}
