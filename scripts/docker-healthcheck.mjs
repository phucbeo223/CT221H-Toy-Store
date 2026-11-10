try{
  const response=await fetch(`http://127.0.0.1:${process.env.FRONTEND_PORT||5173}/api/health`,{signal:AbortSignal.timeout(4000)});
  if(!response.ok||!(await response.json()).ok)process.exitCode=1;
}catch{process.exitCode=1;}
