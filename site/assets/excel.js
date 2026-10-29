'use strict';
// Small self-contained XLSX writer: Open XML cells + uncompressed ZIP.
// All text is inlineStr, so user input is never interpreted as a formula.
window.SurveyExcel = (()=>{
 const enc=new TextEncoder();
 const xml=v=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
 function crc(bytes){let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0}
 function header(size,values){const bytes=new Uint8Array(size),v=new DataView(bytes.buffer);for(const [offset,n,width] of values)width===2?v.setUint16(offset,n,true):v.setUint32(offset,n,true);return bytes}
 function zip(files){const pieces=[],central=[];let offset=0,centralSize=0;for(const [name,text] of Object.entries(files)){const filename=enc.encode(name),data=enc.encode(text),checksum=crc(data);const local=header(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[14,checksum,4],[18,data.length,4],[22,data.length,4],[26,filename.length,2]]);pieces.push(local,filename,data);const entry=header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[16,checksum,4],[20,data.length,4],[24,data.length,4],[28,filename.length,2],[42,offset,4]]);central.push(entry,filename);centralSize+=46+filename.length;offset+=30+filename.length+data.length}const count=Object.keys(files).length;return new Blob([...pieces,...central,header(22,[[0,0x06054b50,4],[8,count,2],[10,count,2],[12,centralSize,4],[16,offset,4]])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
 function column(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s}
 function worksheet(rows){return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${rows.map((row,r)=>`<row r="${r+1}">${row.map((v,c)=>{const cell=column(c)+(r+1);return typeof v==='number'&&Number.isFinite(v)?`<c r="${cell}"><v>${v}</v></c>`:`<c r="${cell}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`}).join('')}</row>`).join('')}</sheetData></worksheet>`}
 function workbook(sheets){const ns='http://schemas.openxmlformats.org';const files={
  '[Content_Types].xml':`<?xml version="1.0"?><Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  '_rels/.rels':`<?xml version="1.0"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  'xl/workbook.xml':`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':`<?xml version="1.0"?><Relationships xmlns="${ns}/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`
 };sheets.forEach((s,i)=>files[`xl/worksheets/sheet${i+1}.xml`]=worksheet(s.rows));return zip(files)}
 return {workbook};
})();
