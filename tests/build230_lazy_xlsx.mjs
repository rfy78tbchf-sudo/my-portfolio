import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {chromium,webkit} from 'playwright';
const require=createRequire(import.meta.url),JSZip=require('../vendor/jszip.min.js');
const script=readFileSync(new URL('../app-enhancements.js',import.meta.url),'utf8').replace('  window.portfolioEnhance=', '  window.__parseXlsx=parseXlsx;window.__parseCsv=parseCsv;\n  window.portfolioEnhance=');
const zip=new JSZip();zip.file('xl/worksheets/sheet1.xml','<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>검증</t></is></c><c r="B1"><v>42</v></c></row></sheetData></worksheet>');
const bytes=Array.from(await zip.generateAsync({type:'uint8array'}));
for(const engine of (process.env.CHROMIUM_ONLY?[chromium]:[chromium,webkit])){
 const browser=await engine.launch(),page=await browser.newPage();let requests=0,fail=true;
 await page.route('**/*',async route=>{
  if(route.request().url().endsWith('/vendor/jszip.min.js')){requests++;return fail?route.abort():route.fulfill({contentType:'text/javascript',body:readFileSync(new URL('../vendor/jszip.min.js',import.meta.url))})}
  return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'});
 });
 try{
  await page.goto('https://xlsx.test/');await page.addScriptTag({content:script});assert.equal(requests,0);
  assert.deepEqual(await page.evaluate(()=>window.__parseCsv('a,b\n1,2')),[['a','b'],['1','2']]);assert.equal(requests,0);
  const parse=()=>page.evaluate(async bytes=>{const file=new File([new Uint8Array(bytes)],'synthetic.xlsx');return Promise.all([window.__parseXlsx(file),window.__parseXlsx(file)])},bytes);
  await assert.rejects(parse(),/엑셀 읽기 구성요소/);assert.equal(requests,1,'concurrent reads share failure');
  fail=false;assert.deepEqual(await parse(),[[['검증','42']],[['검증','42']]]);assert.equal(requests,2,'retry shares one load');
  await parse();assert.equal(requests,2,'subsequent uploads reuse loaded library');
  assert.equal(await page.locator('script[src]').count(),0,'loader removes handlers and script node');
  console.log(engine.name()+': CSV needs no ZIP; XLSX lazy load, shared request, failure retry, actual workbook parsing pass');
 }finally{await browser.close()}
}
