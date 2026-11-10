import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import {pool} from './db.mjs';
export function hashPassword(password){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function verifyPassword(password,hash){try{const [salt,key]=hash.split(':');return timingSafeEqual(Buffer.from(key,'hex'),scryptSync(password,salt,64));}catch{return false;}}
export const digest=v=>createHash('sha256').update(v).digest('hex');
export async function createSession(res,userId){const token=randomBytes(32).toString('hex');await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",[digest(token),userId]);res.cookie('toyjoy_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE==='true',path:'/',maxAge:7*86400000});}
export async function identify(req,res,next){try{const raw=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('toyjoy_session='))?.split('=')[1];if(raw){const r=await pool.query('SELECT u.id,u.name,u.email,u.role,u.wallet_balance FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[digest(raw)]);req.user=r.rows[0];req.sessionToken=raw;}next();}catch(e){next(e);}}
export function requireUser(req,res,next){if(!req.user)return res.status(401).json({error:'Vui lòng đăng nhập để tiếp tục.'});next();}
export function requireAdmin(req,res,next){if(req.user?.role!=='admin')return res.status(403).json({error:'Chức năng dành cho quản trị viên.'});next();}
