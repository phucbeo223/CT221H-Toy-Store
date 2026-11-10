import {existsSync,writeFileSync,mkdirSync,readFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
const bin=process.env.PG_BIN||'C:/Program Files/PostgreSQL/18/bin';
const root=process.cwd(),data=path.join(root,'.local/pgdata'),log=path.join(root,'.local/postgres.log');
mkdirSync(path.dirname(data),{recursive:true});
if(!existsSync('.env')){
  const password=randomBytes(24).toString('hex');
  writeFileSync('.env',readFileSync('.env.example','utf8').replace('CHANGE_ME',password));
}
const env=readFileSync('.env','utf8'),url=new URL(env.match(/^DATABASE_URL=(.*)$/m)[1].trim());
if(url.hostname!=='127.0.0.1'||url.port!=='5433'||url.pathname!=='/toyjoy')throw new Error('db:setup chỉ quản lý CSDL toyjoy tại 127.0.0.1:5433. Với DB riêng, chạy db:migrate và db:seed.');
const run=(name,args,opts={})=>execFileSync(path.join(bin,name+'.exe'),args,{stdio:'inherit',...opts});
if(!existsSync(path.join(data,'PG_VERSION'))){
  const pw=path.join(root,'.local/init-password');writeFileSync(pw,decodeURIComponent(url.password));
  try{run('initdb',['-D',data,'-U',url.username,'-A','scram-sha-256','--pwfile='+pw,'--encoding=UTF8','--locale=C']);}finally{unlinkSync(pw);}
}
try{execFileSync(path.join(bin,'pg_ctl.exe'),['-D',data,'status'],{stdio:'ignore'});}catch{run('pg_ctl',['-D',data,'-l',log,'-o','-p 5433 -h 127.0.0.1','-w','start']);}
const db=url.pathname.slice(1);
const dbEnv={...process.env,PGPASSWORD:decodeURIComponent(url.password)};
const dbExists=execFileSync(path.join(bin,'psql.exe'),['-h','127.0.0.1','-p','5433','-U',url.username,'-d','postgres','-tAc',"SELECT 1 FROM pg_database WHERE datname='toyjoy'"],{env:dbEnv,encoding:'utf8'}).trim()==='1';
if(!dbExists)run('createdb',['-h','127.0.0.1','-p','5433','-U',url.username,db],{env:dbEnv});
console.log('PostgreSQL cục bộ sẵn sàng. Tiếp theo: npm run db:migrate và npm run db:seed.');
