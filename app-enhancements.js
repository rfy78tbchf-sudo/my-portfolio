/* Build 42: broker statement review and account-aware investment questions. */
(function(){
  'use strict';
  var staged=null,context=null;
  function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function dateCell(raw){
    var v=String(raw==null?'':raw).trim(),d;
    if(/^\d{5}(?:\.\d+)?$/.test(v)){d=new Date(Date.UTC(1899,11,30)+Math.floor(Number(v))*86400000);return d.toISOString().slice(0,10)}
    v=v.replace(/[^0-9]/g,'');
    if(v.length!==8)return '';
    d=new Date(Date.UTC(Number(v.slice(0,4)),Number(v.slice(4,6))-1,Number(v.slice(6,8))));
    var date=d.toISOString().slice(0,10);
    return date.replace(/-/g,'')===v?date:'';
  }
  function parseCsv(text){
    text=text.replace(/^\ufeff/,'');var first=text.split(/\r?\n/,1)[0],delim=first.indexOf('\t')>=0?'\t':first.split(';').length>first.split(',').length?';':',';
    var rows=[],row=[],part='',quoted=false;
    for(var i=0;i<text.length;i++){
      var c=text[i];
      if(c==='"'&&quoted&&text[i+1]==='"'){part+='"';i++;continue}
      if(c==='"'){quoted=!quoted;continue}
      if(c===delim&&!quoted){row.push(part);part='';continue}
      if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(part);if(row.some(Boolean))rows.push(row);row=[];part='';continue}
      part+=c;
    }
    if(quoted)throw Error('CSV 따옴표가 닫히지 않았습니다.');
    row.push(part);if(row.some(Boolean))rows.push(row);
    return rows;
  }
  function cellValue(cell,strings){
    var type=cell.getAttribute('t'),node=cell.getElementsByTagName('v')[0];
    if(type==='inlineStr')return Array.prototype.map.call(cell.getElementsByTagName('t'),function(n){return n.textContent}).join('');
    var value=node?node.textContent:'';return type==='s'?strings[Number(value)]||'':value;
  }
  async function parseXlsx(file){
    if(!window.JSZip)throw Error('엑셀 읽기 구성요소를 불러오지 못했습니다.');
    var zip=await window.JSZip.loadAsync(await file.arrayBuffer());
    var sheet=zip.file('xl/worksheets/sheet1.xml');if(!sheet)throw Error('첫 번째 시트를 찾지 못했습니다.');
    if(sheet._data&&sheet._data.uncompressedSize>20*1024*1024)throw Error('엑셀 시트가 너무 큽니다. 여러 파일로 나눠 주세요.');
    var parser=new DOMParser(),shared=[],sharedFile=zip.file('xl/sharedStrings.xml');
    if(sharedFile){var sxml=parser.parseFromString(await sharedFile.async('string'),'text/xml');
      shared=Array.prototype.map.call(sxml.getElementsByTagName('si'),function(si){return Array.prototype.map.call(si.getElementsByTagName('t'),function(t){return t.textContent}).join('')})}
    var xml=parser.parseFromString(await sheet.async('string'),'text/xml');
    if(xml.getElementsByTagName('parsererror').length)throw Error('엑셀 시트가 손상됐습니다.');
    var rows=Array.prototype.map.call(xml.getElementsByTagName('row'),function(row){var values=[];
      Array.prototype.forEach.call(row.getElementsByTagName('c'),function(c){var m=/^([A-Z]+)/.exec(c.getAttribute('r')||''),idx=0;
        if(!m)return;for(var j=0;j<m[1].length;j++)idx=idx*26+m[1].charCodeAt(j)-64;
        if(idx>0&&idx<100)values[idx-1]=cellValue(c,shared)
      });return values});
    return rows.filter(function(r){return r.some(function(x){return x!=null&&x!==''})});
  }
  function chooseHeader(row){var names=row.map(function(x){return String(x||'').replace(/[\s_()·.]/g,'').toLowerCase()});
    var aliases={date:['거래일자','거래일','체결일','일자','날짜','tradedate','date'],
      kind:['거래구분','거래유형','거래내용','적요','거래종류','구분','type'],
      symbol:['종목코드','표준종목코드','단축코드','티커','symbol','isin'],
      name:['종목명','상품명','name'],quantity:['수량','거래수량','체결수량','quantity'],
      price:['거래단가','체결단가','단가','가격','price'],
      amount:['거래금액','정산금액','입출금액','입출금금액','금액','외화금액','amount'],
      fee:['수수료','fee'],tax:['세금','제세금','tax'],currency:['통화','통화코드','currency'],
      market:['시장','거래시장','market'],fx_rate:['적용환율','거래환율','정산환율','환율','fxrate']};var map={};
    Object.keys(aliases).forEach(function(k){map[k]=names.findIndex(function(n){return aliases[k].indexOf(n)>=0})});
    return map;
  }
  function field(row,map,name){return map[name]>=0?String(row[map[name]]==null?'':row[map[name]]).trim():''}
  function numberCell(v){var n=Number(String(v||'').replace(/[,$₩\s원주]/g,''));return isFinite(n)?n:null}
  function kindCell(raw){var s=String(raw||'').replace(/\s/g,'');
    if(/액면분할|액면병합/.test(s)&&/입고/.test(s))return 'split_in';
    if(/액면분할|액면병합/.test(s)&&/출고/.test(s))return 'split_out';
    if(/입고/.test(s))return 'transfer_in';if(/출고/.test(s))return 'transfer_out';
    if(/환전|외화매수|외화매도/.test(s))return 'fx';
    if(/매수|buy/i.test(s))return 'buy';if(/매도|sell/i.test(s))return 'sell';
    if(/배당|분배금/.test(s))return 'dividend';
    if(/세금|원천/.test(s))return 'tax';if(/수수료/.test(s))return 'fee';
    if(/이자/.test(s))return 'interest';if(/입금|deposit/i.test(s))return 'deposit';
    if(/출금|송금|withdraw/i.test(s))return 'withdrawal';return '';
  }
  function knownSecurity(symbol){if(!context||!context.live)return null;
    var secs=context.live.securities||[];
    return secs.find(function(s){return s.symbol===symbol})||secs.find(function(s){return s.symbol==='A'+symbol||s.symbol.replace(/^A(?=[0-9])/,'')===symbol})||null;
  }
  function mapRows(rows,hex){
    var header=-1,map;
    for(var h=0;h<Math.min(rows.length,15);h++){map=chooseHeader(rows[h]);if(map.date>=0&&map.kind>=0){header=h;break}}
    if(header<0)throw Error('날짜와 거래구분 열을 찾지 못했습니다. 거래내역 시트를 CSV/XLSX로 내보내 주세요.');
    var ready=[],errors=[],ignored=0;
    rows.slice(header+1).forEach(function(row,index){var line=header+index+2;
      var date=dateCell(field(row,map,'date')),desc=field(row,map,'kind'),type=kindCell(desc);
      if(!date||!type){if(row.some(Boolean)){ignored++;if(errors.length<15)errors.push(line+'행: 날짜 또는 거래구분 확인 필요')}return}
      var original=field(row,map,'symbol').toUpperCase(),symbol=original.replace(/^A(?=[0-9][A-Z0-9]{5}$)/,''),
        known=knownSecurity(original)||knownSecurity(symbol),name=field(row,map,'name'),
        qty=numberCell(field(row,map,'quantity')),price=numberCell(field(row,map,'price')),
        amount=numberCell(field(row,map,'amount')),fee=numberCell(field(row,map,'fee'))||0,tax=numberCell(field(row,map,'tax'))||0,
        fxRate=numberCell(field(row,map,'fx_rate')),
        currency=field(row,map,'currency').toUpperCase()||(known&&known.currency)||'KRW',
        market=(known&&known.market)||field(row,map,'market').toUpperCase()||(currency==='KRW'?'KRX':'NAS');
      if(known){symbol=known.symbol;market=known.market;currency=known.currency}
      if(type==='sell'||type==='withdrawal'||type==='buy'||type==='fee'||type==='tax')amount=amount==null?amount:(type==='sell'?Math.abs(amount):-Math.abs(amount));
      if(type==='deposit'&&amount!=null)amount=Math.abs(amount);
      if((['buy','sell','transfer_in','transfer_out','split_in','split_out'].indexOf(type)>=0 && (!known||qty==null||qty<=0))||
        (['buy','sell'].indexOf(type)>=0&&(price==null||price<=0||amount==null))||
        (['deposit','withdrawal','dividend'].indexOf(type)>=0&&!amount)||
        (fxRate!=null&&currency==='USD'&&(fxRate<500||fxRate>3000))){
        ignored++;if(errors.length<15)errors.push(line+'행: 종목·수량·금액 또는 통화 확인 필요');return;
      }
      ready.push({date:date,type:type,symbol:symbol||'',market:market,currency:currency,
        quantity:qty,price:price,amount:amount,fee:fee,tax:tax,fx_rate:fxRate,name:name,description:desc,
        line:String(line),external_id:'KB:FILE:'+hex+':'+line});
    });
    if(ready.length>2000)throw Error('한 번에 최대 2,000행까지 가져올 수 있습니다. 파일을 나눠 주세요.');
    return {rows:ready,ignored:ignored,errors:errors};
  }
  async function readStatement(file){if(file.size>5*1024*1024)throw Error('파일은 5MB 이하로 나눠 주세요.');
    var bytes=await file.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes),
      hex=Array.prototype.map.call(new Uint8Array(digest),function(b){return b.toString(16).padStart(2,'0')}).join('');
    var rows;if(/\.xlsx$/i.test(file.name)){rows=await parseXlsx(file)}else if(/\.csv$/i.test(file.name)){
      var text=new TextDecoder('utf-8').decode(bytes);
      if(text.indexOf('\ufffd')>=0)text=new TextDecoder('euc-kr').decode(bytes);
      rows=parseCsv(text);
    }else throw Error('CSV 또는 XLSX 파일만 선택할 수 있습니다.');
    return mapRows(rows,hex);
  }
  function importCard(){return '<details class="card-group"><summary>KB 거래내역 파일 가져오기</summary><section class="card">'+
    '<h3>과거 거래 보완</h3><div class="notice">KB에서 받은 CSV/XLSX 거래내역을 선택하면 거래 유형과 기존 종목을 자동 확인합니다. 확인 전에는 원장에 저장하지 않습니다. KB API 기록과 같은 거래는 건너뜁니다.</div>'+
    '<input id="kbStatementFile" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="input" style="margin-top:14px">'+
    '<div id="kbStatementPreview" class="status" role="status" aria-live="polite">파일을 고르면 가져올 거래를 미리 보여줍니다.</div></section></details>'}
  function dataStatusCard(){return '<details class="card-group"><summary>과거 데이터 · AI 연결 상태</summary><section class="card">'+
    '<h3>원장 복원 현황</h3><div id="build42DataStatus" class="notice" role="status" aria-live="polite">원장과 가격 자료를 확인하고 있습니다.</div>'+
    '<button id="build42Backfill" type="button" class="btn secondary full" style="margin-top:12px">과거 KB 내역 더 확인</button>'+
    '<div class="history-note">월별 KB 조회는 자동으로 이어집니다. 확인되지 않은 거래는 임의로 추가하지 않습니다.</div></section></details>'}
  async function showDataStatus(ctx){var el=document.getElementById('build42DataStatus');if(!el)return;
    var backfill=ctx.authFetch(ctx.supabaseUrl+'/rest/v1/kb_backfill_months?select=month,ledger_rows&order=month.asc&limit=1',{
      headers:{apikey:ctx.publicKey}},12000,false).then(function(r){return r.ok?r.json():[]}).catch(function(){return []});
    var health=ctx.authFetch(ctx.supabaseUrl+'/functions/v1/investment-assistant',{
      method:'POST',headers:{'content-type':'application/json',apikey:ctx.publicKey},body:'{"action":"health"}'},12000,false)
      .then(function(r){return r.ok?r.json():null}).catch(function(){return null});
    var a=await Promise.all([backfill,health]),recon=ctx.live.reconciliation||{},old=a[0]&&a[0][0],ai=a[1];
    if(!el.isConnected)return;
    var keySetup=document.getElementById('aiKeySetup');
    if(keySetup)keySetup.hidden=!!(ai&&ai.configured);
    el.textContent='KB 잔고 일치 '+Number(recon.quantity_matched||0)+' / '+Number(recon.quantity_total||0)+'종목 · '+
      (old?'KB 과거 내역 '+old.month+'부터 확인':'KB 과거 내역 확인 대기')+' · '+
      (ai?(ai.configured?'AI 서버 연결됨':'AI 서버 준비됨 · API 키 필요'):'AI 서버 연결 확인 필요');
  }
  function aiCard(){return '<details class="card-group"><summary>투자 AI 분석</summary><section class="card"><h3>내 데이터로 질문하기</h3>'+
    '<div class="notice">현재 보유, 최근 거래, 수량 차이, 포트폴리오 위험, 저장한 투자 논리를 서버에서 질문에 맞게 읽습니다. 확인되지 않은 숫자는 확정 성과처럼 쓰지 않습니다.</div>'+
    '<div id="aiKeySetup" class="notice" style="margin-top:12px"><b>OpenAI API 키 연결</b><div class="history-note">ChatGPT 로그인과 별도인 OpenAI API 키를 한 번 입력하면 서버의 암호화 저장소에 보관합니다. 이 화면 코드에는 키가 남지 않습니다.</div>'+
    '<input id="aiKeyInput" type="password" class="input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="OpenAI API 키" style="margin-top:8px">'+
    '<button id="aiKeySave" type="button" class="btn secondary full" style="margin-top:7px">AI 키 연결</button><div id="aiKeyStatus" class="status" role="status" aria-live="polite"></div></div>'+
    '<div class="tool-row" style="margin-top:12px"><button type="button" class="btn secondary" data-ai-question="내 포트폴리오에서 지금 확인할 위험은 무엇인가?">가장 큰 위험</button><button type="button" class="btn secondary" data-ai-question="이번 달 투자손익에 기여한 종목과 아직 확인되지 않은 자료를 알려줘.">이번 달 성과</button></div>'+
    '<select id="aiStock" class="select" style="margin-top:10px"><option value="">전체 포트폴리오</option>'+((context.live&&context.live.holdings)||[]).filter(function(h){return h.quantity>0}).map(function(h){var s=context.live.securityMap[h.security_id]||{};return '<option value="'+escapeHtml(s.symbol||'')+'">'+escapeHtml(s.name||s.symbol||'종목')+'</option>'}).join('')+'</select>'+
    '<textarea id="aiQuestion" class="input" rows="3" maxlength="800" style="margin-top:10px" placeholder="예: 이 종목을 계속 보유하는 논리가 유효한가?"></textarea>'+
    '<button id="aiAsk" type="button" class="btn full" style="margin-top:8px">내 데이터로 분석</button><div id="aiAnswer" class="notice" style="margin-top:12px;white-space:pre-wrap" role="status" aria-live="polite">질문을 입력하거나 바로가기 질문을 눌러 주세요.</div></section></details>'}
  async function ask(question){var btn=document.getElementById('aiAsk'),answer=document.getElementById('aiAnswer');if(!btn||!answer)return;
    var symbol=document.getElementById('aiStock').value;if(!question){answer.textContent='질문을 입력해 주세요.';return}
    btn.disabled=true;answer.textContent='현재 계좌와 투자 논리를 확인하는 중…';
    try{var res=await context.authFetch(context.supabaseUrl+'/functions/v1/investment-assistant',{
      method:'POST',headers:{'content-type':'application/json','apikey':context.publicKey},
      body:JSON.stringify({question:question,symbol:symbol||null})},60000,false),data=await res.json();
      if(!res.ok)throw Error(data.message||data.code||'분석 서버 응답 실패');
      answer.textContent=data.answer||'응답이 없습니다.';
    }catch(e){answer.textContent='분석을 완료하지 못했습니다 · '+(e.message||'다시 시도해 주세요.')}
    finally{btn.disabled=false}
  }
  window.portfolioEnhance=function(ctx){context=ctx;if(ctx.tab!=='more'||ctx.mode!=='live'||!ctx.live)return;
    var grid=ctx.content.querySelector('.grid.settings');if(!grid)return;
    var box=document.createElement('div');box.innerHTML=aiCard()+importCard()+dataStatusCard();
    while(box.firstChild)grid.insertBefore(box.firstChild,grid.children[2]||null);
    var fileInput=document.getElementById('kbStatementFile'),preview=document.getElementById('kbStatementPreview');staged=null;
    fileInput.onchange=async function(){staged=null;var file=fileInput.files&&fileInput.files[0];if(!file)return;
      preview.textContent='선택한 파일의 거래 유형과 중복 가능성을 확인하는 중…';
      try{staged=await readStatement(file);var rows=staged.rows;
        preview.innerHTML='<b>가져올 후보 '+rows.length+'건 · 확인 필요 '+staged.ignored+'건</b>'+
          (rows.length?'<div class="history-note">'+rows.slice(0,12).map(function(r){return escapeHtml(r.date+' · '+r.type+' · '+(r.symbol||r.description)+' · '+(r.quantity||r.amount||''))}).join('<br>')+'</div>':'')+
          (staged.errors.length?'<div class="history-note">'+staged.errors.map(escapeHtml).join('<br>')+'</div>':'')+
          '<div class="notice">중복 기록은 서버에서 다시 확인합니다. 건너뛴 행은 반영되지 않습니다.</div>'+
          (rows.length?'<button id="kbStatementCommit" type="button" class="btn full" style="margin-top:10px">미리보기 확인 · '+rows.length+'건 반영</button>':'');
        var commit=document.getElementById('kbStatementCommit');if(commit)commit.onclick=async function(){commit.disabled=true;var inserted=0,duplicates=0,skipped=0,errors=[];
          try{for(var i=0;i<rows.length;i+=200){preview.firstChild.textContent='파일 반영 중 · '+Math.min(i+200,rows.length)+' / '+rows.length+'행';
            var result=await ctx.rpc('import_kb_statement_rows',{p_rows:rows.slice(i,i+200)});
            inserted+=Number(result.inserted||0);duplicates+=Number(result.already_present||0);skipped+=Number(result.skipped||0);
            errors=errors.concat(result.errors||[])
          }preview.textContent='반영 '+inserted+'건 · 기존 거래 '+duplicates+'건 · 추가 확인 '+skipped+'건'+
              (errors.length?' · '+errors.slice(0,3).map(function(x){return x.line+'행 '+x.reason}).join(', '):'');
            staged=null;await ctx.refresh();
          }catch(e){preview.textContent='중단된 위치: '+i+'행 · '+(e.message||'다시 시도해 주세요.')+' · 같은 파일을 다시 선택해도 중복 저장되지 않습니다.';commit.disabled=false}
        }
      }catch(e){preview.textContent='파일을 읽지 못했습니다 · '+(e.message||'다시 시도해 주세요.')}
    };
    document.getElementById('aiAsk').onclick=function(){ask(document.getElementById('aiQuestion').value.trim())};
    document.getElementById('aiKeySave').onclick=async function(){var btn=this,input=document.getElementById('aiKeyInput'),
      status=document.getElementById('aiKeyStatus'),key=input.value.trim();
      if(!key){status.textContent='OpenAI API 키를 입력해 주세요.';return}
      btn.disabled=true;status.textContent='서버에서 키를 확인하는 중…';input.value='';
      try{var r=await ctx.authFetch(ctx.supabaseUrl+'/functions/v1/investment-assistant',{
        method:'POST',headers:{'content-type':'application/json',apikey:ctx.publicKey},
        body:JSON.stringify({action:'connect-key',api_key:key})},20000,false),body=await r.json();
        if(!r.ok)throw Error(body.message||'키 연결 실패');
        status.textContent='AI 분석 준비 완료';await showDataStatus(ctx)
      }catch(e){status.textContent=e.message||'다시 시도해 주세요.'}finally{btn.disabled=false;key=''}
    };
    showDataStatus(ctx);
    var backfill=document.getElementById('build42Backfill');backfill.onclick=function(){
      backfill.disabled=true;backfill.textContent='과거 KB 내역 확인 중…';
      ctx.edgeSync('backfill-next',{months:3}).then(function(r){
        backfill.textContent='확인 완료 · '+Number(r.completed||0)+'개월';return ctx.refresh()
      }).catch(function(e){backfill.textContent='확인 실패 · '+(e.message||'다시 시도해 주세요.');backfill.disabled=false})
    };
    Array.prototype.forEach.call(ctx.content.querySelectorAll('[data-ai-question]'),function(btn){btn.onclick=function(){var question=btn.getAttribute('data-ai-question');document.getElementById('aiQuestion').value=question;ask(question)}});
  };
})();
