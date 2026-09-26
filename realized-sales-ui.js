(function(){
  'use strict';
  function fmt(value,unit,places){
    var n=Number(value);
    return (n>=0?'+':'−')+Math.abs(n).toLocaleString('ko-KR',
      {minimumFractionDigits:places,maximumFractionDigits:places})+unit;
  }
  function n(value,places){return Number(value).toLocaleString('ko-KR',{maximumFractionDigits:places})}
  function escape(value){return String(value==null?'':value).replace(/[&<>"']/g,
    function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function section(live,selectedPeriod,selectedAccount){
    var r=live&&live.realizedSales,accounts=live&&live.accounts||[];
    var current=selectedAccount||(accounts.find(function(a){return a.provider==='kb_securities'})||{}).id;
    var opts=accounts.map(function(a){return '<option value="'+escape(a.id)+'"'+
      (current===a.id?' selected':'')+'>'+escape(a.name||'계좌')+'</option>'}).join('');
    var controls='<div class="tool-row" style="margin:10px 0"><select id="realizedAccount" class="select" aria-label="매도손익 계좌">'+opts+
      '</select><select id="realizedPeriod" class="select" aria-label="매도손익 기간">'+
      '<option value="1M"'+(selectedPeriod==='1M'?' selected':'')+'>최근 1개월</option>'+
      '<option value="THIS_MONTH"'+(selectedPeriod==='THIS_MONTH'?' selected':'')+'>이번 달</option></select></div>';
    if(!r||!r.ok)return '<section class="card" style="margin-top:12px"><h3>기간 중 매도손익</h3>'+
      controls+'<div class="notice">매도별 계산을 불러오지 못했습니다. 계좌나 기간을 다시 선택해 주세요.</div></section>';
    var items=r.items||[],names={calculated:'계산 완료',partial_date:'체결일 확인 필요',
      order_unverified:'거래 순서 확인 필요',cost_review:'원가 확인 필요',source_review:'원본 확인 필요'};
    var sums={},provisional={},groups={};
    items.forEach(function(x){
      (groups[x.symbol]||(groups[x.symbol]=[])).push(x);
      if(x.realized_local==null)return;
      var cur=x.currency||'통화 미확인',bucket=x.status==='partial_date'?provisional:sums,
        v=bucket[cur]||(bucket[cur]={pnl:0,n:0});
      v.pnl+=Number(x.realized_local);v.n++;
    });
    var totals=Object.keys(sums).sort().map(function(cur){var v=sums[cur];
      return '<div class="row"><span>주문일 근거가 있는 '+escape(cur)+' 원장 매도손익 · '+v.n+'건만</span>'+
        '<strong>'+fmt(v.pnl,' '+escape(cur),2)+'</strong></div>';
    }).join('')||'<div class="notice">이 기간에 계산을 마친 매도는 없습니다.</div>';
    totals+=Object.keys(provisional).sort().map(function(cur){var v=provisional[cur];
      return '<div class="row"><span>원장 기록일 기준 '+escape(cur)+' 원가 산출 · '+v.n+'건 · 기간 포함 미확정</span>'+
        '<strong>'+fmt(v.pnl,' '+escape(cur),2)+'</strong></div>';
    }).join('');
    var groupsHtml=Object.keys(groups).sort().map(function(symbol){
      var rows=groups[symbol],cur=rows[0].currency||'',known=rows.filter(function(x){return x.realized_local!=null});
      var total=known.reduce(function(v,x){return v+Number(x.realized_local)},0);
      var details=rows.map(function(x){
        var done=x.realized_local!=null,date=x.trade_date||'';
        var basis=x.date_basis==='ledger_date_execution_unverified'?
          '원장 기록일 · 주문/체결일 미대조':'증권사 주문일 · 체결일과 순서 미대조';
        var fx=done&&cur==='USD'?
          '<div class="sub">최근 저장 환율 참고 환산 '+(x.reference_krw==null?'자료 없음':
            fmt(x.reference_krw,'원',0)+' ('+escape(x.reference_fx_date)+' · '+escape(x.reference_fx_source)+')')+
            ' · 당시 원화 투자손익과 다름</div>'+
          '<div class="sub">과거 환율 기반 원화 관리손익 추정 '+(x.historical_krw_estimate==null?
            '자료 부족':fmt(x.historical_krw_estimate,'원',0))+' · 실제 환전/세무 금액 아님</div>':'';
        var cost=done?'<div class="sub">매도 순대금 '+n(x.net_proceeds,2)+' '+escape(cur)+
          ' − 배분 원가 '+n(x.allocated_cost,2)+' '+escape(cur)+' · 매수 수수료는 원가, 매도 비용은 순대금에 포함</div>'+fx:
          '<div class="sub">'+escape(x.issue||names[x.status]||'원본 확인 필요')+
            (x.issue_date?' · '+escape(x.issue_date):'')+'</div>';
        return '<div class="row sold-ledger-row"><div><b>'+escape(date)+' · '+n(x.quantity||0,6)+
          '주</b><div class="sub">'+escape(basis)+(x.ledger_date&&x.ledger_date!==date?
            ' · 원장 '+escape(x.ledger_date):'')+' · '+escape(names[x.status]||'자료 확인')+
          '</div>'+cost+'<details class="more-list" data-realized-sale="'+escape(x.transaction_id)+
          '"><summary>매도별 원본·원가 경로 보기</summary><div class="realized-trace" role="status"></div></details>'+
          '</div><strong class="'+(done?(Number(x.realized_local)<0?'down':'up'):'muted')+'">'+
          (done?fmt(x.realized_local,' '+escape(cur),2):'확인 필요')+'</strong></div>';
      }).join('');
      var cycle=rows.some(function(x){return x.status==='order_unverified'})?
        '<details class="more-list" data-cycle-review="'+escape(symbol)+
        '"><summary>같은 날 매수·매도 순서와 전체 구간 검토</summary><div class="realized-cycle" role="status"></div></details>':'';
      return '<details class="more-list"><summary>'+escape(rows[0].name||symbol)+' · '+escape(symbol)+
        ' · '+known.length+'/'+rows.length+'건 계산'+(known.length?' · '+fmt(total,' '+escape(cur),2):'')+
        '</summary>'+details+cycle+'</details>';
    }).join('');
    return '<section class="card" style="margin-top:12px"><h3>기간 중 매도손익 · 계좌별 원장</h3>'+
      controls+'<div class="sub">주문일 확인 시 주문일로 잠정 분류 · '+escape(r.period_start)+' ~ '+escape(r.period_end)+
      ' (한국시간) · 원가: 계좌별 이동평균 · '+escape(r.calculation_version)+'</div>'+
      '<div class="sub">체결일이 확인되지 않은 거래의 기간 경계는 잠정입니다. 매도별 원가 계산과 기간 전체 성과를 구분합니다.</div>'+
      '<div class="notice">매도 '+Number(r.candidate_count||0)+'건 중 계산 '+Number(r.ready_count||0)+
      '건 (주문일 근거), 원가만 계산·날짜 미대조 '+Number(r.partial_count||0)+'건, 순서 '+Number(r.order_unverified_count||0)+
      '건, 원가 '+Number(r.cost_review_count||0)+'건, 원본 '+Number(r.source_review_count||0)+
      '건 확인 필요. 두 부분합은 더하지 않으며 계좌 기간성과가 아닙니다.</div>'+totals+
      (groupsHtml||'<div class="notice">선택 기간에 매도 내역이 없습니다.</div>')+'</section>';
  }
  function oneMonthCoverage(live){
    var c=live&&live.oneMonthCoverage;
    if(!c||!c.ok)return '';
    var lines=[
      ['기초 순자산',c.opening_nav.status==='observed'?'관측 확인':'미확보 · 첫 계좌 관측 '+c.opening_nav.first_observed_date],
      ['기초 보유',c.opening_positions.status==='observed'?'관측 확인':'복원 검증 필요 · 첫 종목 관측 '+c.opening_positions.first_observed_date],
      ['기초 현금',c.opening_cash.status==='observed'?'관측 확인':'미확보 · 첫 현금 관측 '+c.opening_cash.first_observed_date],
      ['기초 가격',c.opening_prices.priced_symbols+'/'+c.opening_prices.needed_symbols+'종목 · 누락 '+(c.opening_prices.missing_symbols||[]).join(', ')],
      ['외부 입출금',c.external_flows.deposit_withdrawal_events+'건 · 현금 반영일 대조 중'],
      ['체결·결제',c.execution_settlement.trade_events+'건 중 주문일 '+c.execution_settlement.linked_order_dates+'건, 결제일 '+c.execution_settlement.linked_settlement_dates+'건 연결'],
      ['기말 자산',c.closing_nav.last_observed_date+' 관측 · '+c.closing_nav.status],
      ['USD/KRW 환율','최근 저장 '+c.fx.latest_rate_date+' · 매수·매도 시점별 추정 환율은 거래 상세에서 확인']
    ];
    return '<details class="card" style="margin-top:12px"><summary>최근 1개월 성과 복원 입력 · 종합위탁</summary>'+
      '<div class="sub">'+escape(c.period_start)+' ~ '+escape(c.period_end)+' (한국시간)</div>'+
      lines.map(function(x){return '<div class="row"><span>'+escape(x[0])+'</span><strong class="sub" style="min-width:0;overflow-wrap:anywhere;text-align:right">'+
        escape(x[1])+'</strong></div>'}).join('')+
      '<div class="notice">기초 자산·현금과 보유 검증이 끝나지 않아 최근 1개월 전체 계좌 TWR은 제공하지 않습니다. 매도손익은 별도입니다.</div></details>';
  }
  function bind(content,handlers){
    var account=content.querySelector('#realizedAccount'),period=content.querySelector('#realizedPeriod');
    if(account)account.onchange=function(){handlers.change(period.value,account.value)};
    if(period)period.onchange=function(){handlers.change(period.value,account.value)};
    content.querySelectorAll('[data-realized-sale]').forEach(function(node){
      node.ontoggle=async function(){
        if(!node.open||node.dataset.loaded)return;
        var box=node.querySelector('.realized-trace');if(!box)return;
        node.dataset.loaded='true';box.textContent='거래 원본 확인 중…';
        try{
          var trace=await handlers.trace(node.getAttribute('data-realized-sale'));
          if(!node.isConnected)return;
          if(!trace||!trace.ok)throw Error('원본 자료를 확인하지 못했습니다.');
          var x=trace.sale||{},raw=trace.source_transactions||[];
          box.textContent='원장 '+String(x.symbol||'')+' · '+String(x.status||'')+' · '+
            (x.realized_local==null?'원가 배분 대기':
              '순매도 '+n(x.net_proceeds,2)+' − 원가 '+n(x.allocated_cost,2)+
              ' = '+n(x.realized_local,2)+' '+String(x.currency||''))+'\n'+
            raw.map(function(t){return String(t.event_date||'')+' '+(t.type==='buy'?'매수':'매도')+
              ' '+n(t.quantity,6)+'주 · 순액 '+n(t.net_amount,2)+' · 비용 '+
              n(t.fee,2)+' / 세금 '+n(t.tax,2)+' · 원본 ID '+String(t.transaction_id||'')+
              (t.fx_rate?' · 원화 추정 환율 '+n(t.fx_rate,4)+' ('+String(t.fx_date||'')+
                ' · '+String(t.fx_source||'')+')':'')}).join('\n')+
            (trace.truncated?'\n원본 일부만 표시. 전체 원장에서 확인하세요.':'');
        }catch(e){if(node.isConnected){box.textContent='원본 조회 실패 · '+(e.message||'다시 열어 주세요.');node.dataset.loaded=''}}
      };
    });
    content.querySelectorAll('[data-cycle-review]').forEach(function(node){
      node.ontoggle=async function(){
        if(!node.open||node.dataset.loaded)return;
        var box=node.querySelector('.realized-cycle');if(!box)return;
        node.dataset.loaded='true';box.textContent='계좌 원장 전체 구간 확인 중…';
        try{var result=await handlers.cycle(node.getAttribute('data-cycle-review'));
          if(!node.isConnected)return;if(!result||!result.ok)throw Error('구간 확인 실패');
          box.textContent='혼합 거래일 '+(result.mixed_days||[]).length+'일 · 원장 매수 '+
            n(result.buy_quantity,6)+'주 / 매도 '+n(result.sell_quantity,6)+'주'+
            '\n전체 매도 순대금 '+n(result.sell_net,2)+' − 매수 원가 '+n(result.buy_cost,2)+
            ' = '+(result.candidate_cash_difference==null?'계산 자료 부족':
              fmt(result.candidate_cash_difference,' '+escape(result.candidate_currency),2))+
            '\n'+(result.status==='closed_cycle_verified'?
              '시작·종료 수량 0과 원본 완전성 확인. 매도별 원가 배분은 별도 검증 필요.':
              '검토용 현금 수지 차이입니다. 시작·종료 보유 0을 독립 관측으로 확인하지 못해 전체 구간 실현손익으로 확정하지 않습니다.')+
            '\n거래 순서가 부족한 날짜: '+(result.mixed_days||[]).slice(0,8).join(', ')+
            ((result.mixed_days||[]).length>8?' 외 '+((result.mixed_days||[]).length-8)+'일':'');
        }catch(e){if(node.isConnected){box.textContent='구간 조회 실패 · '+e.message;node.dataset.loaded=''}}
      };
    });
  }
  window.realizedSalesUi={section:section,oneMonthCoverage:oneMonthCoverage,bind:bind};
})();
