import pg from 'pg';
export const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000});
pool.on('error',e=>console.error('PostgreSQL:',e.message));
export async function transaction(actor,fn) {
  const c=await pool.connect();
  try { await c.query('BEGIN'); await c.query("SELECT set_config('app.actor',$1,true)",[actor]); const result=await fn(c); await c.query('COMMIT'); return result; }
  catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
