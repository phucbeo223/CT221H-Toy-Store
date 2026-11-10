import {spawn,spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
if(!existsSync('.env'))throw new Error('Chạy npm run db:setup trước, hoặc tạo .env theo .env.example.');
loadEnvFile('.env');
const production=process.argv.includes('--production');
const children=[];
let stopping=false;
function stop(){if(stopping)return;stopping=true;for(const c of children){if(!c.pid||c.exitCode!==null)continue;if(process.platform==='win32')spawnSync('taskkill',['/PID',String(c.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});else c.kill();}}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
function launch(args,label){
  const child=spawn(process.execPath,args,{stdio:'inherit'});children.push(child);
  child.on('error',e=>{console.error(`${label}: ${e.message}`);process.exitCode=1;stop();});
  child.on('exit',code=>{if(!stopping){console.error(`${label} đã dừng (mã ${code??'signal'}).`);process.exitCode=code||1;stop();}});
  return child;
}
async function checkDatabase(){
  const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:3000});
  try{await client.connect();const r=await client.query("SELECT to_regclass('public.users') IS NOT NULL AS installed");if(!r.rows[0].installed)throw new Error('Chưa cài schema. Chạy npm run db:migrate và npm run db:seed.');}
  finally{await client.end().catch(()=>{});}
}
try{
  console.log('Toyjoy: đang kiểm tra PostgreSQL...');
  try{await checkDatabase();}catch(e){
    const url=new URL(process.env.DATABASE_URL);
    const isOwnedLocal=url.hostname==='127.0.0.1'&&url.port==='5433'&&url.pathname==='/toyjoy'&&existsSync('.local/pgdata/PG_VERSION');
    if(e.code!=='ECONNREFUSED'||!isOwnedLocal)throw e;
    console.log('Đang khởi động PostgreSQL cục bộ của Toyjoy...');
    const setup=spawnSync(process.execPath,['scripts/setup-db.mjs'],{stdio:'inherit'});
    if(setup.error)throw setup.error;if(setup.status!==0)throw new Error('Không thể khởi động PostgreSQL. Kiểm tra npm run db:setup.');
    await checkDatabase();
  }
  if(!stopping){
    launch([...(!production?['--watch']:[]),'--env-file=.env','server/index.mjs'],'API');
    // Only expose the UI once both the API and its database are ready.
    const origin=process.env.API_ORIGIN||`http://127.0.0.1:${process.env.PORT||3001}`;
    const deadline=Date.now()+20000;let ready=false;
    while(!stopping&&Date.now()<deadline){
      try{const response=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(2000)});if(response.ok&&(await response.json()).ok){ready=true;break;}}catch{}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    if(!stopping&&!ready)throw new Error('API chưa sẵn sàng sau 20 giây. Xem lỗi API phía trên.');
    if(!stopping){console.log('PostgreSQL và API đã sẵn sàng. Đang mở giao diện...');launch(production?['--env-file=.env','node_modules/vinext/dist/cli.js','start','--port',process.env.FRONTEND_PORT||'5173']:['scripts/run-framework.mjs','dev'],'Giao diện');}
  }
}catch(e){console.error(`Toyjoy không thể khởi động: ${e.message}`);process.exitCode=1;stop();}
