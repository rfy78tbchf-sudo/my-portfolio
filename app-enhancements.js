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
    if(keySetup){keySetup.hidden=!!(ai&&ai.status==='configured');if(ai&&ai.status==='unknown')keySetup.textContent='AI 실행환경 설정을 확인하지 못했습니다. 로그인 상태에서 다시 확인해 주세요.'}
    el.textContent='KB 잔고 일치 '+Number(recon.quantity_matched||0)+' / '+Number(recon.quantity_total||0)+'종목 · '+
      (old?'KB 과거 내역 '+old.month+'부터 확인':'KB 과거 내역 확인 대기')+' · '+
      (ai?(ai.status==='configured'?'AI 서버 설정 확인 · 실제 모델 응답은 질문 후 확인':ai.status==='missing'?'AI 서버 API 키 미설정':'AI 서버 설정 확인 불가'):'AI 서버 연결 확인 필요');
  }
  function aiCard(){return '<details class="card-group"><summary>투자 AI 분석</summary><section class="card"><h3>내 데이터로 질문하기</h3><button id="aiConnectionCheck" type="button" class="btn secondary full" style="margin-bottom:12px">AI 연결 설정 확인</button>'+
    '<div class="notice">현재 보유, 최근 거래, 수량 차이, 포트폴리오 위험, 저장한 투자 논리를 서버에서 질문에 맞게 읽습니다. 확인되지 않은 숫자는 확정 성과처럼 쓰지 않습니다.</div>'+
    '<div id="aiKeySetup" class="notice" style="margin-top:12px">AI 실행환경 설정을 확인해 주세요.</div><div id="aiConnectionState" class="sub" role="status" aria-live="polite">설정 확인은 모델을 호출하지 않습니다. 실제 응답은 아래 질문을 보내 확인합니다.</div>'+
    '<div class="tool-row" style="margin-top:12px"><button type="button" class="btn secondary" data-ai-question="내 포트폴리오에서 지금 확인할 위험은 무엇인가?">가장 큰 위험</button><button type="button" class="btn secondary" data-ai-question="이번 달 투자손익에 기여한 종목과 아직 확인되지 않은 자료를 알려줘.">이번 달 성과</button></div>'+
    '<select id="aiStock" class="select" style="margin-top:10px"><option value="">전체 포트폴리오</option>'+((context.live&&context.live.holdings)||[]).filter(function(h){return h.quantity>0}).map(function(h){var s=context.live.securityMap[h.security_id]||{};return '<option value="'+escapeHtml(s.symbol||'')+'">'+escapeHtml(s.name||s.symbol||'종목')+'</option>'}).join('')+'</select>'+
    '<textarea id="aiQuestion" class="input" rows="3" maxlength="800" style="margin-top:10px" placeholder="예: 이 종목을 계속 보유하는 논리가 유효한가?"></textarea>'+
    '<button id="aiAsk" type="button" class="btn full" style="margin-top:8px">내 데이터로 분석</button><div id="aiAnswer" class="ai-answer" role="status" aria-live="polite">질문을 입력하거나 바로가기 질문을 눌러 주세요.</div><div id="aiBasis" class="sub" aria-live="polite"></div>'+
    '<details class="more-list"><summary>종목 하락 가정 계산 · 주문 아님</summary><div class="tool-row"><label>종목 <select id="scenarioSymbol" class="select"><option value="ARM">ARM</option>'+((context.live&&context.live.holdings)||[]).filter(function(h){return Number(h.quantity)>0}).map(function(h){var s=context.live.securityMap[h.security_id]||{};return s.symbol==='ARM'?'':'<option value="'+escapeHtml(s.symbol||'')+'">'+escapeHtml(s.name||s.symbol||'종목')+'</option>'}).join('')+'</select></label><label>평가액 변화 (%) <input id="scenarioChange" class="input" type="number" value="-10" min="-90" max="100" step="1"></label></div><button id="scenarioRun" type="button" class="btn secondary full">가정 계산</button><div id="scenarioResult" class="ai-answer" role="status" aria-live="polite"></div></details>'+
    '<details class="more-list"><summary>목표 비중까지 축소 · 대금은 현금 보유</summary><div class="tool-row"><label>종목 <select id="weightSymbol" class="select">'+((context.live&&context.live.holdings)||[]).filter(function(h){return Number(h.quantity)>0}).map(function(h){var x=context.live.securityMap[h.security_id]||{};return '<option value="'+escapeHtml(x.symbol||'')+'">'+escapeHtml(x.name||x.symbol||'종목')+'</option>'}).join('')+'</select></label><label>목표 비중 (%) <input id="weightTarget" class="input" type="number" value="10" min="0" max="100" step="0.1"></label></div><button id="weightRun" type="button" class="btn secondary full">현금 보유 가정 계산</button><div id="weightResult" class="ai-answer" role="status" aria-live="polite"></div></details>'+
    '<details class="more-list"><summary>지난 분석 보기</summary><div id="aiPrevious" class="ai-answer">기록을 불러오는 중…</div></details></section></details>'}
  function renderAiAnswer(el,value){
    el.textContent='';
    var lines=String(value||'').trim().split(/\n+/).map(function(line){return line.trim()}).filter(Boolean);
    function addLines(parent,items){items.forEach(function(line,index){
      var p=document.createElement('p'),head=line.match(/^(가장 큰 위험|기간 성과|매도 손익|보유 논리|핵심|근거|다음 확인|자료 상태):\s*(.*)$/);
      p.className=index===0?'ai-answer-lead':'ai-answer-line';
      if(head){var label=document.createElement('strong');label.textContent=head[1]+'  ';p.appendChild(label);p.appendChild(document.createTextNode(head[2]))}
      else p.textContent=line;
      parent.appendChild(p);
    })}
    if(lines.length>4||String(value||'').length>550){
      var intro=lines[0]||'',short=intro.length>300?intro.slice(0,300).replace(/\s+\S*$/,'')+'…':intro;
      addLines(el,[short]);
      var details=document.createElement('details'),summary=document.createElement('summary');
      summary.textContent='전체 답변 펼쳐보기';details.appendChild(summary);addLines(details,lines);
      el.appendChild(details);
    }else addLines(el,lines);
  }
  async function ask(question){var btn=document.getElementById('aiAsk'),answer=document.getElementById('aiAnswer');if(!btn||!answer)return;
    var symbol=document.getElementById('aiStock').value;if(!question){answer.textContent='질문을 입력해 주세요.';return}
    btn.disabled=true;answer.textContent='현재 계좌와 투자 논리를 확인하는 중…';
    try{var res=await context.authFetch(context.supabaseUrl+'/functions/v1/investment-assistant',{
      method:'POST',headers:{'content-type':'application/json','apikey':context.publicKey},
      body:JSON.stringify({question:question,symbol:symbol||null})},60000,false),data=await res.json();
      if(!res.ok)throw Error(data.message||data.code||'분석 서버 응답 실패');
      renderAiAnswer(answer,data.answer||'응답이 없습니다.');
      var basis=document.getElementById('aiBasis');if(basis)basis.textContent='분석 기준 '+(data.observation_at?new Date(data.observation_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'관측 미확인')+
        ' · '+(data.response_kind==='model_interpretation_server_metrics'?'모델 해석 · 서버 계산 숫자':data.response_kind==='model'?'모델 응답':'서버 검증 답변')+
        ' · 계산 '+(data.calculation_version||'기준 확인 필요')+
        (data.isa_capture_at?' · ISA 화면 '+new Date(data.isa_capture_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'')+
        (data.account_scope_state==='isa_overlap_unverified'?' · 계좌 범위 확인 필요':data.account_scope_state==='verified'?' · 계좌별 금액 확인 · 계좌 식별자/ISA 평가시각 미대조':'');
      loadPrevious(context);
    }catch(e){answer.textContent='분석을 완료하지 못했습니다 · '+(e.message||'다시 시도해 주세요.')}
    finally{btn.disabled=false}
  }
  async function checkAiConnection(){var el=document.getElementById('aiConnectionState');if(!el)return;el.textContent='로그인 계좌와 서버 설정 확인 중…';
    try{var r=await context.authFetch(context.supabaseUrl+'/functions/v1/investment-assistant',{
      method:'POST',headers:{'content-type':'application/json',apikey:context.publicKey},body:'{"action":"health"}'},12000,false);
      var data=await r.json();el.textContent=!r.ok?'로그인 계좌 권한 또는 서버 연결 확인 필요':data.status==='configured'?'서버 키 설정됨 · 실제 모델 응답은 질문하기에서 확인':data.status==='missing'?'서버 키 미설정 · 관리자 설정 필요':'서버 설정 확인 불가';
    }catch(_){el.textContent='서버 설정 확인 불가 · 나중에 다시 시도해 주세요.'}}
  async function runScenario(){var btn=document.getElementById('scenarioRun'),el=document.getElementById('scenarioResult');if(!btn||!el)return;
    var symbol=document.getElementById('scenarioSymbol').value,change=Number(document.getElementById('scenarioChange').value);
    if(!Number.isFinite(change)||change< -90||change>100){el.textContent='변화율은 -90%부터 +100%까지 입력해 주세요.';return}
    btn.disabled=true;el.textContent='동일 관측의 종목 평가액과 자산 분모 확인 중…';
    try{var res=await context.authFetch(context.supabaseUrl+'/functions/v1/investment-assistant',{
      method:'POST',headers:{'content-type':'application/json',apikey:context.publicKey},
      body:JSON.stringify({action:'scenario',symbol:symbol,change_pct:change})},12000,false),m=await res.json();
      if(!res.ok||!m.ok)throw Error(m.reason||m.code||'기준 시각 불일치');
      var won=function(n){return Math.round(Number(n)).toLocaleString('ko-KR')+'원'};
      el.textContent=symbol+' 평가액 '+won(m.position.value)+'에서 '+change+'%를 가정하면 '+
        '자산 변화 '+won(m.scenario.impact_krw)+' · 앱 합산 자산 대비 '+Number(m.scenario.asset_impact_pct).toFixed(2)+'% (참고).\n'+
        '분모 '+won(m.denominator.value)+' = KB 응답 '+won(m.denominator.kb_response_value)+' + 최신 ISA 총액 '+won(m.denominator.manual_overlay)+
        ' · KB 관측 '+new Date(m.denominator.primary_observed_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+
        ' / ISA 화면 '+new Date(m.denominator.isa_captured_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+
        '. ISA 잔고 유효시각과 계좌 식별자 연결은 미확인.'+
        ' 나머지 자산과 환율은 그대로 둔 조건부 계산이며 예측이 아닙니다.';
    }catch(e){el.textContent='계산에 필요한 같은 시각의 평가 자료를 확인하지 못했습니다 · '+(e.message||'다시 시도해 주세요.')}
    finally{btn.disabled=false}
  }
  async function runWeightScenario(){var btn=document.getElementById('weightRun'),el=document.getElementById('weightResult');if(!btn||!el)return;
    var symbol=document.getElementById('weightSymbol').value,target=Number(document.getElementById('weightTarget').value);
    if(!symbol||!Number.isFinite(target)||target<0||target>100){el.textContent='종목과 0~100% 사이 목표 비중을 입력해 주세요.';return}
    btn.disabled=true;el.textContent='최신 계좌 총액과 선택 종목 평가액을 확인하는 중…';
    try{var res=await context.authFetch(context.supabaseUrl+'/functions/v1/investment-assistant',{
      method:'POST',headers:{'content-type':'application/json',apikey:context.publicKey},
      body:JSON.stringify({action:'weight-scenario',symbol:symbol,target_pct:target})},12000,false),m=await res.json();
      if(!res.ok||!m.ok)throw Error(m.code==='TARGET_EXCEEDS_CURRENT_WEIGHT'?'현재 보유 비중 '+Number(m.current_weight_pct).toFixed(2)+'%보다 낮은 목표를 입력해 주세요.':m.code||'계산 근거 확인 필요');
      var fmt=function(n){return Math.round(Number(n)).toLocaleString('ko-KR')+'원'},v=m.scenario;
      el.textContent=symbol+' 평가액 '+fmt(m.position.value)+' → 목표 '+Number(v.target_weight_pct).toFixed(2)+'% · 가정상 매도 '+fmt(v.sale_value_krw)+'\n'+
        '매도 후 보유 '+fmt(v.position_after_krw)+' · 보유 현금 증가 '+fmt(v.cash_increase_before_cost_krw)+' · 총자산 '+fmt(v.assets_after_before_cost_krw)+' (비용 전, 변화 없음).\n'+
        '분모: KB '+fmt(m.denominator.kb_response_value)+' + ISA 최신 총액 '+fmt(m.denominator.manual_overlay)+
        ' · KB '+new Date(m.denominator.primary_observed_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+
        ' / ISA 화면 '+new Date(m.denominator.isa_captured_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+
        ' · ISA 잔고 유효시각·계좌 식별자 미확인. 매매 수수료·세금·환율·실제 체결 제약 제외. 주문이나 예상 손익이 아닙니다.'+
        (v.pnl_classification&&v.pnl_classification.state==='hypothetical_cost_basis_before_fees'?
          '\n원가 기준 분류 가정: 매도분 '+fmt(v.pnl_classification.hypothetical_realized_krw)+
          ' / 잔여 평가차액 '+fmt(v.pnl_classification.hypothetical_remaining_unrealized_krw)+
          ' · 기존 평가차액 '+fmt(v.pnl_classification.original_unrealized_krw)+
          '을 분류한 값입니다. 새 투자손익은 0원이며 증권사 공식 실현손익이 아닙니다.':'\n원가·평가 기준이 맞지 않아 실현/평가손익 분류는 계산하지 않았습니다.');
    }catch(e){el.textContent='시나리오 계산 실패 · '+(e.message||'다시 시도해 주세요.')}
    finally{btn.disabled=false}
  }
  async function loadPrevious(ctx){var el=document.getElementById('aiPrevious');if(!el)return;
    try{var r=await ctx.authFetch(ctx.supabaseUrl+'/rest/v1/ai_analysis_history?select=answer,question,created_at,observation_at,isa_observation_id,isa_capture_at,calculation_version,thesis_version,response_kind&order=created_at.desc&limit=1',{
      headers:{apikey:ctx.publicKey}},12000,false);
      if(!r.ok)throw Error('HISTORY_READ_FAILED');var rows=await r.json(),h=rows&&rows[0];
      if(!el.isConnected)return;if(!h){el.textContent='아직 저장된 분석이 없습니다.';return}
      el.textContent='질문: '+h.question+'\n답변: '+h.answer+'\n생성 '+new Date(h.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+
        ' · 관측 '+(h.observation_at?new Date(h.observation_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'기준시각 기록 이전')+
        ' · 계산 '+(h.calculation_version||'기존 버전')+' · 논리 '+(h.thesis_version||'입력 없음')+
        (h.isa_capture_at?' · ISA 화면 '+new Date(h.isa_capture_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'')+
        (ctx.live&&ctx.live.decisionMetrics&&ctx.live.decisionMetrics.ok&&
          (h.calculation_version!==ctx.live.decisionMetrics.calculation_version||
           h.isa_observation_id!==ctx.live.decisionMetrics.denominator.isa_observation_id)?
          ' · 이전 기준: 새 데이터로 다시 분석 가능':' · 당시 기록 (현재 값으로 갱신하지 않음)');
    }catch(_){if(el.isConnected)el.textContent='지난 분석을 불러오지 못했습니다.'}
  }
  window.portfolioEnhance=function(ctx){context=ctx;if(ctx.tab!=='more'||ctx.mode!=='live'||!ctx.live)return;
    var grid=ctx.content.querySelector('.grid.settings');if(!grid)return;
    var box=document.createElement('div');box.innerHTML=aiCard()+importCard()+dataStatusCard();
    while(box.firstChild)grid.insertBefore(box.firstChild,grid.children[2]||null);
    var checkButton=document.getElementById('aiConnectionCheck');if(checkButton)checkButton.onclick=checkAiConnection;
    document.getElementById('scenarioRun').onclick=runScenario;document.getElementById('weightRun').onclick=runWeightScenario;loadPrevious(ctx);
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
