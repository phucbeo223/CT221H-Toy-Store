export type Product={id:number;sku:string;name:string;description:string;category:string;price:number;original_price:number|null;stock:number;min_age:number;max_age:number;art:string;color:string;badge:string|null;sort_order:number;active:boolean;image_url?:string|null;image_alt?:string|null;image_source_url?:string|null;source_url?:string|null;source_name?:string|null;brand?:string|null;similarity?:number};
export type User={id:string;name:string;email:string;role:'admin'|'customer';wallet_balance:number};
export type Order={id:string;number:number;total:number;status:string;payment_method:string;payment_status:string;created_at:string;address:{name:string;phone:string;detail:string};items:{product_id:number;name:string;art:string;color:string;quantity:number;unit_price:number}[]};
export const money=(n:number|string)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(n));
export const date=(s:string)=>new Date(s).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'});
export const statusName:Record<string,string>={pending:'Chờ xác nhận',paid:'Đã thanh toán',shipping:'Đang giao hàng',completed:'Hoàn tất',cancelled:'Đã hủy',refunded:'Đã hoàn ví'};
export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{
 const timeout=path==='/chat'?60000:path==='/admin/ai/index'?130000:path.endsWith('/benchmark')?50000:path.includes('/search/')?35000:15000;
 const timeoutSignal=AbortSignal.timeout(timeout);
 const signal=options.signal?AbortSignal.any([options.signal,timeoutSignal]):timeoutSignal;
 let r:Response;
 try{r=await fetch('/api'+path,{...options,signal,headers:{'Content-Type':'application/json',...options.headers}});}
 catch(error){if(timeoutSignal.aborted)throw new Error('Máy chủ phản hồi quá lâu. Bấm tải lại để thử lại.');throw error;}
 let data:any;try{data=await r.json();}catch{throw new Error('Máy chủ chưa sẵn sàng. Vui lòng thử lại.');}
 if(!r.ok)throw new Error(data.error||'Không thể xử lý yêu cầu.');return data as T;
}
