// Development/test static file server only; GitHub Pages needs no server process.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../site');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 let name=decodeURIComponent(url.pathname);
 if(name.startsWith('/Questionaire/'))name=name.slice('/Questionaire'.length);
 const target=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));
 if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 fs.readFile(target,(error,content)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(error?'Not found':content)});
}).listen(Number(process.env.PORT||8000),'127.0.0.1',()=>console.log('Static survey server ready'));
