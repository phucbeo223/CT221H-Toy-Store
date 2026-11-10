import {readFile,readdir} from 'node:fs/promises';
import {pool} from '../server/db.mjs';
try{for(const file of (await readdir(new URL('../db/',import.meta.url))).filter(f=>/^\d+.*\.sql$/.test(f)).sort()){await pool.query(await readFile(new URL('../db/'+file,import.meta.url),'utf8'));console.log('Đã áp dụng '+file);}console.log('Đã cài bảng, thủ tục, trigger và index PostgreSQL.');}finally{await pool.end();}
