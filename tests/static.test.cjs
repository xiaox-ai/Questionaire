const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context={window:{},TextEncoder,Blob,Uint8Array,DataView};
vm.createContext(context);
for(const file of ['questions.js','excel.js'])vm.runInContext(fs.readFileSync('site/assets/'+file,'utf8'),context);
const C=context.window.SURVEY;
assert.equal(C.basic.length,10);
assert.equal(C.businesses.length,12);
assert.deepEqual(Array.from(C.businesses,b=>b[0]),[13,15,17,19,21,23,25,27,29,31,33,35]);
assert.deepEqual(Array.from(C.businesses,b=>Array.from(b[4])),[[236,50,120],[53,261,148],[20,31,61],[166,26,58],[90,10,37],[207,67,133],[13,80,33],[10,42,6],[26,68,180],[80,30,15],[93,200,38],[10,27,20]]);
assert.deepEqual(Array.from(C.businesses[2][3]),['简约型','主题型','自然型']);
assert.deepEqual(Array.from(C.businesses[3][3]),['自然型','简约型','主题型']);
assert.deepEqual(Array.from(C.businesses[4][3]),['主题型','自然型','简约型']);
assert.deepEqual(Array.from(C.businesses[6][3]),['简约型','自然型','主题型']);
assert.deepEqual(Array.from(C.businesses[7][3]),['简约型','主题型','自然型']);
assert.equal(C.experiences.length,13);
assert.equal(C.frequencies.length,6);
(async()=>{
 const blob=context.window.SurveyExcel.workbook([{name:'答案',rows:[['文本','价格'],['=1+1 & <测试>',236],['中文',0]]}]);
 const bytes=Buffer.from(await blob.arrayBuffer());
 assert.equal(bytes.readUInt32LE(0),0x04034b50);
 let offset=0;const entries={};
 while(bytes.readUInt32LE(offset)===0x04034b50){
  const len=bytes.readUInt32LE(offset+18),nameLen=bytes.readUInt16LE(offset+26),extraLen=bytes.readUInt16LE(offset+28);
  const name=bytes.subarray(offset+30,offset+30+nameLen).toString();
  const start=offset+30+nameLen+extraLen;entries[name]=bytes.subarray(start,start+len).toString();offset=start+len;
 }
 assert.equal(Object.keys(entries).length,5);
 assert.ok(entries['[Content_Types].xml']);
 const sheet=entries['xl/worksheets/sheet1.xml'];
 assert.ok(sheet.includes('=1+1 &amp; &lt;测试&gt;'));
 assert.ok(sheet.includes('t="inlineStr"'));
 assert.ok(!sheet.includes('<f>'));
 assert.ok(sheet.includes('<v>236</v>'));
 assert.equal(bytes.readUInt32LE(offset),0x02014b50);
 console.log('PASS: all question numbers/prices, exceptional style ordering, options and real XLSX structure/formula safety.');
})().catch(e=>{console.error(e);process.exitCode=1});
vm.runInContext(fs.readFileSync('site/assets/videos.js','utf8'),context);
const videos=context.window.parseVideoCSV(fs.readFileSync('site/videos.csv','utf8'));
// The deployed list is editable configuration: do not pin its URLs or modes.
assert.ok(Object.keys(videos).length > 0, '视频清单至少需要一条记录');
for (const [code, video] of Object.entries(videos)) {
 assert.match(code, /^[A-M][1-9]$/);
 assert.ok(['flat','360','iframe'].includes(video.mode));
 if (video.url) {
  assert.equal(new URL(video.url).protocol, 'https:');
  assert.ok(!/\s/.test(video.url), code + ' 的链接不能含未编码空格');
 }
}
const flatFixture=context.window.parseVideoCSV('视频编号,视频名称,视频链接,播放模式\nA1,普通视频,https://example.com/flat.mp4,flat\nA2,未配置,,flat\n');
assert.equal(flatFixture.A1.mode,'flat');
assert.equal(flatFixture.A2.url,'');
const quoted=context.window.parseVideoCSV('\ufeff视频编号,视频名称,视频链接,播放模式\r\nA1,"公园, ""自然""",https://example.com/a.mp4,360\r\n');
assert.equal(quoted.A1.title,'公园, "自然"');
assert.equal(quoted.A1.mode,'360');
assert.throws(()=>context.window.parseVideoCSV('视频编号,视频名称,视频链接\nA1,x,javascript:alert(1)'));
assert.throws(()=>context.window.parseVideoCSV('视频编号,视频名称,视频链接\nA1,x,\nA1,y,'));
console.log('PASS: CSV BOM, Excel quoting, URLs, modes, empty and duplicate entries.');

