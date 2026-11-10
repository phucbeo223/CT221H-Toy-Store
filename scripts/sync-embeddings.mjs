import {indexProducts,indexingProgress} from '../server/gemini.mjs';
import {pool} from '../server/db.mjs';
let last='';
const timer=setInterval(()=>{const s=indexingProgress(),line=`Embedding: ${s.completed}/${s.total} · mới ${s.indexed} · giữ ${s.skipped}`;if(line!==last){console.log(line);last=line;}},1000);
try{const result=await indexProducts();const saved=(await pool.query('SELECT count(*)::int total,count(*) FILTER(WHERE embedding IS NOT NULL AND embedding_model=$1)::int indexed FROM products WHERE active',[process.env.GEMINI_EMBEDDING_MODEL||'gemini-embedding-001'])).rows[0];console.log(JSON.stringify({...result,saved}));}
catch(e){console.error(e.message);process.exitCode=1;}
finally{clearInterval(timer);await pool.end();}
