'use strict';
// RFC4180 CSV: Excel quoted cells, commas, newlines and UTF-8 BOM.
window.parseVideoCSV=function(text){
 const rows=[];let row=[],cell='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c}
 if(quoted)throw Error('CSV 引号未闭合');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 const headers=rows.shift(), result={};if(!headers)throw Error('清单为空');
 for(const r of rows){const get=n=>(r[headers.indexOf(n)]||'').trim();const code=get('视频编号')||get('受试者编号'),url=get('视频链接'),mode=get('播放模式')||'flat';if(!/^[A-M][1-9]$/.test(code)||result[code])throw Error('视频编号无效或重复');if(!['flat','360','iframe'].includes(mode))throw Error('播放模式无效');if(url&&!/^https:\/\//i.test(url))throw Error('视频链接必须使用HTTPS');result[code]={title:get('视频名称')||code,url,mode,annotation:get('标注')}}
 return result;
};
window.loadVideos=async function(){const response=await fetch('videos.csv',{cache:'no-store'});if(!response.ok)throw Error('读取视频清单失败');window.SURVEY.videos=window.parseVideoCSV(await response.text())};
