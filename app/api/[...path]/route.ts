// The UI and API have one browser origin. The private PostgreSQL API runs in Node.
const proxy = async (request: Request) => {
  const url=new URL(request.url);
  const origin=process.env.API_ORIGIN||'http://127.0.0.1:3001';
  const headers=new Headers();
  for(const name of ['content-type','cookie','origin']){const value=request.headers.get(name);if(value)headers.set(name,value);}
  try{
    const timeout=url.pathname.endsWith('/chat')?55000:url.pathname.endsWith('/ai/index')?125000:url.pathname.endsWith('/benchmark')?45000:url.pathname.includes('/search/')?30000:12000;
    const response=await fetch(origin+url.pathname+url.search,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:await request.text(),redirect:'manual',signal:AbortSignal.timeout(timeout)});
    const out=new Headers({'Content-Type':response.headers.get('content-type')||'application/json','Cache-Control':'no-store'});
    for(const cookie of response.headers.getSetCookie())out.append('Set-Cookie',cookie);
    return new Response(response.body,{status:response.status,headers:out});
  }catch(error){if(error instanceof Error&&error.name==='TimeoutError')return Response.json({error:'Máy chủ phản hồi quá lâu. Vui lòng tải lại hoặc thử lại sau.'},{status:504});return Response.json({error:'Chưa kết nối được máy chủ. Kiểm tra API và PostgreSQL đang chạy.'},{status:503});}
};
export const GET=proxy;export const POST=proxy;export const PUT=proxy;export const DELETE=proxy;
