import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { Store } from './store.mjs';
import { Collector } from './collector.mjs';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const store=new Store(process.env.IGXE_DATA_DIR || join(root,'data'));
const collector=new Collector(store);
const token=randomBytes(24).toString('hex');
const port=Number(process.env.PORT || 17863);
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  try {
    if(req.headers.host!==`127.0.0.1:${server.address().port}`) return send(403,{error:'只允许本机访问'});
    const origin=`http://${req.headers.host}`;
    if(req.headers.origin && req.headers.origin!==origin) return send(403,{error:'拒绝跨站请求'});
    const url=new URL(req.url,origin);
    if(req.method==='GET' && url.pathname==='/health') return send(200,{app:'igxe-personal-rental-manager',version:'0.1.0'});
    if(req.method==='GET' && url.pathname==='/api/session') return send(200,{token});
    if(url.pathname.startsWith('/api/')) {
      if(req.headers['x-app-token']!==token) return send(403,{error:'请刷新应用窗口'});
      if(req.method==='GET') {
        if(url.pathname==='/api/state') return send(200,{...collector.state,busy:collector.busy,browserOpen:!!collector.context,account:store.get('accountNickname'),pending:store.pending().length});
        if(url.pathname==='/api/orders') return send(200,store.list());
        if(/^\/api\/orders\/\d+$/.test(url.pathname)) return send(200,store.one(url.pathname.split('/').at(-1)));
        if(url.pathname==='/api/runs') return send(200,store.runs());
        if(url.pathname==='/api/export') return send(200,{schemaVersion:1,exportedAt:new Date().toISOString(),account:store.get('accountNickname'),orders:store.list().map(o=>store.one(o.id)),runs:store.runs()});
      }
      if(req.method==='POST') {
        let body=''; for await(const chunk of req) {body+=chunk;if(body.length>4096) return send(413,{error:'请求过大'});}
        const data=body?JSON.parse(body):{};
        if(url.pathname==='/api/browser') { if(collector.busy) throw new Error('采集期间请使用已打开的浏览器'); await collector.open();return send(200,{ok:true}); }
        if(url.pathname==='/api/sync') {
          if(!['full','incremental','resume'].includes(data.mode)) throw new Error('请选择有效采集模式');
          if(!data.accountConfirmed) throw new Error('请确认采集窗口登录的是本地库对应的个人账户');
          collector.start(data.mode).catch(e=>collector.emit(e.message)); return send(202,{ok:true});
        }
        if(url.pathname==='/api/pause') {collector.stopRequested=true;return send(200,{ok:true});}
        if(url.pathname==='/api/backup') return send(200,{path:await store.backup()});
        if(url.pathname==='/api/quit') {collector.stopRequested=true;send(200,{ok:true});setTimeout(async()=>{await collector.job;await collector.context?.close();server.close();store.db.close();process.exit(0);},50);return;}
      }
      return send(404,{error:'接口不存在'});
    }
    const files={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
    if(req.method!=='GET' || !files[url.pathname]) return send(404,{error:'不存在'});
    const [file,type]=files[url.pathname];res.writeHead(200,{'Content-Type':type});res.end(await readFile(join(root,'public',file)));
  } catch(e) {send(400,{error:e.message});}
});
server.listen(port,'127.0.0.1',()=>console.log(`IGXE_LOCAL_URL=http://127.0.0.1:${server.address().port}`));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'端口已被占用。应用可能已经运行，请打开 http://127.0.0.1:17863':e);process.exitCode=1;});
