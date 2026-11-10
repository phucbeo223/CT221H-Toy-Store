import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import pg from 'pg';

process.chdir(fileURLToPath(new URL('../',import.meta.url)));
function run(script,...args){
  const result=spawnSync(process.execPath,[script,...args],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`${script} thất bại (mã ${result.status??result.signal}).`);
}

// Compose waits for PostgreSQL to be healthy before starting this container.
run('scripts/migrate.mjs');
run('scripts/seed.mjs');
const catalog=JSON.parse(await readFile('data/photo-catalog.json','utf8')).products;
const client=new pg.Client();
let missing;
try{
  await client.connect();
  const result=await client.query('SELECT count(*)::int AS count FROM products WHERE sku=ANY($1::text[])',[catalog.map(p=>p.sku)]);
  missing=result.rows[0].count<catalog.length;
}finally{await client.end();}
// Import cached photos on a new database, preserve admin edits on later starts.
if(missing)run('scripts/import-photo-catalog.mjs','--from-cache');
else console.log('Danh mục ảnh đã có; giữ nguyên dữ liệu cửa hàng.');

process.argv.push('--production');
await import('./start-local.mjs');
