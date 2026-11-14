// Credentials stay in memory and are never printed or written to disk.
const {spawnSync}=require('child_process')
;(async()=>{
 const c=spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',windowsHide:true});if(c.status!==0)throw Error('GitHub credential unavailable')
 const values=Object.fromEntries(c.stdout.trim().split('\n').map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)]}))
 const headers={Authorization:'Bearer '+values.password,'User-Agent':'event-project-maintenance',Accept:'application/vnd.github+json'}
 const url='https://api.github.com/repos/oppd0616/oppd',action=process.argv[2]
 const response=await fetch(url,{headers,...(action==='public'?{method:'PATCH',body:JSON.stringify({private:false})}:{})})
 if(!response.ok)throw Error('GitHub request failed: '+response.status)
 const r=await response.json();console.log(JSON.stringify({url:r.html_url,private:r.private,defaultBranch:r.default_branch,admin:r.permissions?.admin}))
 if(action==='public'&&r.private)throw Error('Repository is still private')
})().catch(e=>{console.error(e.message);process.exitCode=1})
