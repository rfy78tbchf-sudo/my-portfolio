import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const KB_BASE = "https://developer.kbsec.com:32484";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const PUB_KEYS = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
const SEC_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const PUBLISHABLE_KEY = PUB_KEYS.default || Deno.env.get("SUPABASE_ANON_KEY") || "";
const SECRET_KEY = SEC_KEYS.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PROD_ORIGIN = "https://rfy78tbchf-sudo.github.io";

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": origin === PROD_ORIGIN ? origin : PROD_ORIGIN,
    "access-control-allow-headers": "authorization, apikey, content-type, x-internal-sync-key",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "Origin",
  };
}
function json(req: Request, body: unknown, status=200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}
async function adminRpc(name: string, args: Record<string, unknown> = {}) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { "apikey": SECRET_KEY, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error("RPC_" + name + "_" + r.status);
  return data;
}
async function authUser(req: Request) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
  const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: PUBLISHABLE_KEY, authorization: "Bearer " + token },
  });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u?.id ? String(u.id) : null;
}
async function internalOk(req: Request) {
  const provided = req.headers.get("x-internal-sync-key") || "";
  if (!provided) return false;
  const expected = String(await adminRpc("get_kb_internal_sync_key_for_service") || "");
  return Boolean(expected && provided === expected);
}
async function resolveUser(req: Request, body: any) {
  let userId = await authUser(req);
  if (userId) return userId;
  if (!(await internalOk(req))) return null;
  if (body?.userId) return String(body.userId);
  const users = await adminRpc("list_kb_configured_users_for_service");
  if (!Array.isArray(users) || users.length !== 1) throw new Error("USER_ID_REQUIRED");
  return String(users[0]?.user_id || "");
}
async function credentials(userId: string) {
  const rows = await adminRpc("get_kb_credentials_for_service", { p_user_id: userId });
  const row = Array.isArray(rows) ? rows[0] : rows;
  const appKey = String(row?.app_key || "");
  const appSecret = String(row?.app_secret || "");
  if (!appKey || !appSecret) throw new Error("KB_CREDENTIALS_NOT_CONFIGURED");
  return { appKey, appSecret };
}
async function issueToken(appKey: string, appSecret: string) {
  const r = await fetch(KB_BASE + "/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      dataHeader: { ipAddr: "", macAddr: "" },
      dataBody: { appKey, appSecret, grantType: "client_credentials" },
    }),
  });
  const text = await r.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  const b = data?.dataBody && typeof data.dataBody === "object" ? data.dataBody : data;
  const token = b?.access_token || b?.accessToken || "";
  if (!r.ok || !token) throw new Error("KB_TOKEN_FAILED");
  return String(token);
}
function kbBusinessError(data: any) {
  const h = data?.dataHeader || {};
  const resultCode = String(h?.resultCode || "");
  const processFlag = String(h?.processFlag || "");
  const failed = (resultCode && resultCode !== "200") || processFlag === "B";
  if (!failed) return null;
  return {
    resultCode: resultCode || null,
    resultMessage: h?.resultMessage || null,
    processCode: h?.processCode || null,
    processMessage: h?.processMessage || null,
  };
}
async function callTr(appKey: string, token: string, path: string, dataBody: Record<string, unknown>) {
  const r = await fetch(KB_BASE + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      appKey,
      authorization: "bearer " + token,
    },
    body: JSON.stringify({
      dataHeader: { ipAddr: "127.0.0.1", macAddr: "00-00-00-00-00-00" },
      dataBody
    }),
  });
  const text = await r.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new Error("KB_NON_JSON_RESPONSE_" + r.status); }
  if (!r.ok) throw new Error("KB_HTTP_" + r.status);
  const be = kbBusinessError(data);
  if (be) {
    const msg = String(be.processMessage || be.resultMessage || "");
    // KB uses business codes for valid "no rows" responses on some account TRs.
    if (String(be.resultCode || "") === "200" && /없습니다|자료가 없습니다|내역이 없습니다/.test(msg)) {
      return data;
    }
    const err:any = new Error("KB_BUSINESS_ERROR");
    err.detail = be;
    throw err;
  }
  return data;
}
function n(v: any) {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).replace(/,/g,"").replace(/%/g,"").trim();
  const x = Number(s);
  return Number.isFinite(x) ? x : 0;
}
function nOrNull(v:any) {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  return n(v);
}
function currency(raw: any, market?: any) {
  const s = String(raw || "").toUpperCase().trim();
  if (/^[A-Z]{3}$/.test(s)) return s;
  const m = String(market || "").toUpperCase();
  if (s.includes("원화") || s === "원" || s.includes("KRW")) return "KRW";
  if (m === "KRX" || m === "KOSPI" || m === "KOSDAQ") return "KRW";
  if (s.includes("USD") || s.includes("미국") || s.includes("달러") || /NAS|NYS|AMX/.test(m)) return "USD";
  if (s.includes("JPY") || s.includes("엔") || s.includes("일본") || m.includes("JPN")) return "JPY";
  if (s.includes("HKD") || s.includes("홍콩") || m.includes("HKG")) return "HKD";
  if (s.includes("CNY") || s.includes("CNH") || s.includes("위안") || s.includes("중국")) return "CNY";
  if (s.includes("EUR") || s.includes("유로")) return "EUR";
  if (s.includes("GBP") || s.includes("파운드")) return "GBP";
  return "USD";
}
function todaySeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:"Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit"
  }).format(new Date());
}
function normalizeDomestic(data:any) {
  const b = data?.dataBody || {};
  const rows = Array.isArray(b.Record1) ? b.Record1 : [];
  const holdings:any[] = [];
  for (const r of rows) {
    const symbol = String(r?.is_cd || "").trim();
    const qty = n(r?.hld_q_p6) || n(r?.hld_q) || n(r?.ec_q_p6) || n(r?.ec_q) || n(r?.ordr_psbl_q_p6) || n(r?.ordr_psbl_q);
    const rawCurrency = String(r?.crncy_cd || "").trim().toUpperCase();
    const staleSettledSell = qty > 0
      && n(r?.val_amt) === 0
      && n(r?.byng_amt) === 0
      && n(r?.ordr_psbl_q) === 0
      && n(r?.nstmt_s_q) >= qty;
    if (staleSettledSell) continue;
    // SSQM2952 is an integrated account view and can include overseas holdings.
    // Overseas rows are sourced from SPQM2226 to avoid double-counting and preserve FX detail.
    if (rawCurrency && rawCurrency !== "KRW") continue;
    if (!symbol || (qty === 0 && n(r?.val_amt) === 0)) continue;
    holdings.push({
      symbol,
      name:String(r?.is_nm || symbol).trim(),
      market:"KRX",
      asset_type:"stock",
      currency:"KRW",
      country:"KR",
      quantity:qty,
      avg_cost:nOrNull(r?.byng_avr_prc),
      market_price:nOrNull(r?.now_prc),
      market_value:nOrNull(r?.val_amt),
      unrealized_pnl:nOrNull(r?.val_pl),
      unrealized_pnl_rate:nOrNull(r?.val_yld),
      official_unrealized_pnl:nOrNull(r?.val_pl),
      fx_rate_to_base:1,
      provider_payload:r
    });
  }
  return { holdings, summary:b };
}
function normalizeOverseas(data:any) {
  const b = data?.dataBody || {};
  const rows = Array.isArray(b.Record2) ? b.Record2 : [];
  const holdings:any[] = [];
  for (const r of rows) {
    const symbol = String(r?.is_cd || "").trim();
    const qty = n(r?.frgn_hld_q_p6);
    if (!symbol || (qty === 0 && n(r?.krw_val_amt) === 0)) continue;
    const market = String(r?.mkt_clsf || r?.mkt_clsf_nm || "OVERSEAS").trim();
    const cur = currency(r?.crncy_clsf_nm, market);
    const fx = n(r?.std_exch_r) || 1;
    const krwMv = n(r?.krw_val_amt);
    const krwPnl = n(r?.krw_exch_val_pl);
    const localMv = fx ? krwMv / fx : qty * n(r?.now_prc_p4);
    const localPnl = fx ? krwPnl / fx : (localMv - n(r?.byng_amt));
    holdings.push({
      symbol,
      name:String(r?.is_nm || symbol).trim(),
      market:market || "OVERSEAS",
      asset_type:"stock",
      currency:cur,
      country:market,
      quantity:qty,
      avg_cost:nOrNull(r?.byng_avr_prc_p4),
      market_price:nOrNull(r?.now_prc_p4),
      market_value:localMv,
      unrealized_pnl:localPnl,
      unrealized_pnl_rate:nOrNull(r?.yld),
      official_unrealized_pnl:localPnl,
      fx_rate_to_base:fx,
      provider_payload:r
    });
  }
  return { holdings, summary:b };
}
function previewOne(code:string, data:any, recordKeys:string[]) {
  const b = data?.dataBody || {};
  const counts:Record<string,number> = {};
  for (const k of recordKeys) counts[k] = Array.isArray(b?.[k]) ? b[k].length : 0;
  return {
    code, ok:true, message:b?.o_msg || null,
    dataBodyKeys:Object.keys(b).filter(k=>!/^Record\d+$/.test(k)).slice(0,60),
    recordCounts:counts,
  };
}
async function fetchCurrent(userId:string) {
  const { appKey, appSecret } = await credentials(userId);
  const token = await issueToken(appKey, appSecret);
  const domesticRaw = await callTr(appKey, token, "/api/v1/ssqm2952", { excg_mktpr_ccd:"A" });
  const overseasRaw = await callTr(appKey, token, "/api/v1/spqm2226", {
    std_crncy_f:"2", exch_r_aplc_f:"2", fee_clsf:"0",
    cn_f:"", nxt_key:"", mktpr_aplc_clsf:""
  });
  return { appKey, token, domesticRaw, overseasRaw };
}
async function previewUser(userId:string) {
  const { domesticRaw, overseasRaw } = await fetchCurrent(userId);
  return {
    domestic:previewOne("SSQM2952",domesticRaw,["Record1"]),
    overseas:previewOne("SPQM2226",overseasRaw,["Record1","Record2"]),
  };
}
async function syncCurrent(userId:string) {
  const { domesticRaw, overseasRaw } = await fetchCurrent(userId);
  const d = normalizeDomestic(domesticRaw);
  const o = normalizeOverseas(overseasRaw);
  const holdings = [...d.holdings, ...o.holdings];

  const dS = d.summary || {};
  const oS = o.summary || {};
  const overseasInvested = (Array.isArray(oS.Record2) ? oS.Record2 : [])
    .reduce((sum:number,r:any)=>sum+n(r?.krw_exch_byng_amt || (n(r?.byng_amt)*n(r?.std_exch_r))),0);

  // SSQM2952 is the integrated account valuation. Use its official KRW totals once,
  // while SPQM2226 is used only for richer overseas holding/FX detail.
  const domesticCash = n(dS?.dy_tfnd);
  const foreignCashKrw = n(dS?.fcrncy_tfnd_krw_exch_amt);
  const officialTotalAssets = n(dS?.nt_asts_val_amt);
  const officialSecurities = n(dS?.val_amt_sum);
  const officialUnrealized = n(dS?.val_pl_sum);
  const summary = {
    total_assets: officialTotalAssets,
    cash: domesticCash + foreignCashKrw,
    securities_value: officialSecurities,
    invested_capital: n(dS?.byng_amt_sum),
    unrealized_pnl: officialUnrealized,
    realized_pnl: 0,
    dividends: 0,
    interest: 0,
    fees: 0,
    taxes: 0,
    total_pnl: officialUnrealized,
    external_flow: 0,
  };

  const applied = await adminRpc("apply_kb_current_snapshot_for_service", {
    p_user_id:userId,
    p_snapshot_date:todaySeoul(),
    p_holdings:holdings,
    p_summary:summary,
  });

  return {
    applied,
    domesticHoldings:d.holdings.length,
    overseasHoldings:o.holdings.length,
    totalHoldings:holdings.length,
    snapshotDate:todaySeoul(),
    orderEndpointsEnabled:false,
  };
}


function ymd(iso:string){ return iso.replace(/-/g,""); }
function ytdStart(){
  const d=todaySeoul();
  return d.slice(0,4)+"0101";
}
async function pagedTr(
  appKey:string, token:string, path:string,
  baseBody:Record<string,unknown>, recordKey:string, maxPages=40
){
  let next="";
  let pages=0;
  let rows:any[]=[];
  let lastSummary:any={};
  while(pages<maxPages){
    const body={...baseBody,nxt_key:next};
    const data=await callTr(appKey,token,path,body);
    const b=data?.dataBody||{};
    if(Array.isArray(b?.[recordKey])) rows=rows.concat(b[recordKey]);
    lastSummary=b;
    pages++;
    next=String(b?.nxt_key||"").trim();
    if(!next) break;
    await new Promise(r=>setTimeout(r,150));
  }
  return {rows,pages,truncated:Boolean(next),summary:lastSummary};
}
async function previewHistory(userId:string){
  const {appKey,appSecret}=await credentials(userId);
  const token=await issueToken(appKey,appSecret);
  const end=ymd(todaySeoul());
  const start=ytdStart();
  const ledger=await pagedTr(appKey,token,"/api/v1/swqa2301",{
    strt_dt:start,end_dt:end,is_no:"",srt_clsf:"1"
  },"Record1");
  const realized=await pagedTr(appKey,token,"/api/v1/ssqm2442",{
    inq_strt_dt:start,inq_end_dt:end,is_cd:""
  },"Record1");
  const overseas=await pagedTr(appKey,token,"/api/v1/spqm2207",{
    strt_ordr_dt:start,end_ordr_dt:end,stnd_is_cd:"",
    std_crncy_f:"2",exch_r_aplc_f:"2",frgn_stk_mgn_ccd:"",dl_clsf:""
  },"Record2");
  return {
    period:{start,end},
    ledger:{rows:ledger.rows.length,pages:ledger.pages,truncated:ledger.truncated},
    domesticRealized:{rows:realized.rows.length,pages:realized.pages,truncated:realized.truncated},
    overseasRealized:{rows:overseas.rows.length,pages:overseas.pages,truncated:overseas.truncated},
    orderEndpointsEnabled:false
  };
}


function normalizeKrSymbol(raw:any){
  const s=String(raw||"").trim().toUpperCase();
  if(/^KR[0-9A-Z]{10}$/.test(s) && s.length===12 && s[2]==="7") return s.slice(3,9);
  return s;
}
function isoKstDate(yyyymmdd:any){
  const s=String(yyyymmdd||"").replace(/\D/g,"");
  if(s.length!==8) return null;
  return s.slice(0,4)+"-"+s.slice(4,6)+"-"+s.slice(6,8)+"T12:00:00+09:00";
}
function monthBounds(month:string){
  const m=/^(\d{4})-(\d{2})$/.exec(month);
  if(!m) throw new Error("INVALID_MONTH");
  const y=Number(m[1]), mo=Number(m[2]);
  const last=new Date(Date.UTC(y,mo,0)).getUTCDate();
  let end=`${m[1]}${m[2]}${String(last).padStart(2,"0")}`;
  const today=ymd(todaySeoul());
  const start=`${m[1]}${m[2]}01`;
  if(start>today) throw new Error("FUTURE_MONTH");
  if(end>today) end=today;
  return {start,end};
}
function classifyLedger(r:any){
  const s=(String(r?.smry_nm||"")+" "+String(r?.dl_typ_cd||"")).trim();
  if(/세금|제세|원천|소득세|주민세|거래세|농특세|양도세/.test(s)) return "tax";
  if(/배당금 입금|분배금 입금|분배 입금/.test(s)) return "dividend";
  // A share transfer/split changes position quantity without any execution
  // price or external cash flow. Keep both legs of corporate actions.
  if(/(액면분할|액면병합)/.test(s) && /입고/.test(s)) return "split_in";
  if(/(액면분할|액면병합)/.test(s) && /출고/.test(s)) return "split_out";
  if(/(상환|종목변경|합병|스핀오프)/.test(s) && /입고/.test(s)) return "corporate_in";
  if(/(상환|종목변경|합병|스핀오프)/.test(s) && /출고/.test(s)) return "corporate_out";
  if(/입고/.test(s)) return "transfer_in";
  if(/출고/.test(s)) return "transfer_out";
  // FX conversion descriptions include "매수"/"매도"; they are not stock trades
  // and must never enter the security P&L ledger as purchases or sales.
  if(/환전|외화매수|외화매도/.test(s)) return "fx";
  if(/매수/.test(s)) return "buy";
  if(/매도/.test(s)) return "sell";
  if(/예탁금이용료|쿠폰|이자/.test(s)) return "interest";
  if(/ADR FEE|금융비용|수수료/.test(s)) return "fee";
  if(/공모불입|공모주환불금|공모추가납입|단수주매각대금|대체입금|대체출금/.test(s)) return "other";
  if(/입금/.test(s) && !/입고/.test(s)) return "deposit";
  if(/출금/.test(s) && !/출고/.test(s)) return "withdrawal";
  return "other";
}
function signedAmount(v:number,type:string){
  const a=Math.abs(v);
  if(type==="buy"||type==="withdrawal"||type==="fee"||type==="tax") return -a;
  if(type==="sell"||type==="deposit"||type==="dividend"||type==="interest") return a;
  return v;
}

type MasterRow={isin:string,symbol:string,name?:string,market:string,currency:string,country?:string};
async function loadSecurityMaster(){
  const raw=await adminRpc("get_kb_security_master_for_service");
  let arr:any=raw;
  if(Array.isArray(raw) && raw.length===1 && raw[0] && Array.isArray(raw[0].get_kb_security_master_for_service)){
    arr=raw[0].get_kb_security_master_for_service;
  } else if(raw && !Array.isArray(raw) && Array.isArray(raw.get_kb_security_master_for_service)){
    arr=raw.get_kb_security_master_for_service;
  }
  if(!Array.isArray(arr)) arr=[];
  const map:Record<string,MasterRow>={};
  for(const r of arr){
    const isin=String(r?.isin||"").trim().toUpperCase();
    if(isin) map[isin]=r as MasterRow;
  }
  return map;
}
function marketCountry(m:any,isin:any){
  const x=String(m||"").toUpperCase().trim();
  const i=String(isin||"").toUpperCase();
  if(i.startsWith("KR")||x==="KRX") return "KR";
  if(/NAS|NYS|AMX/.test(x)||i.startsWith("US")) return "US";
  if(/HKS/.test(x)||i.startsWith("HK")) return "HK";
  if(/TSE/.test(x)||i.startsWith("JP")) return "JP";
  if(/SHS|SZS/.test(x)||i.startsWith("CN")) return "CN";
  return "";
}
function normalizeMasterRows(data:any){
  const b=data?.dataBody||{};
  const rows=Array.isArray(b.Record1)?b.Record1:[];
  const out:any[]=[];
  for(const r of rows){
    const isin=String(r?.slf_is_cd||r?.stnd_is_cd||"").trim().toUpperCase();
    let symbol=String(r?.shrt_is_cd||r?.symbl_is_cd||"").trim().toUpperCase();
    let market=String(r?.frgn_stk_krx_cd||r?.dl_mkt_ccd||r?.mrkt_ccd||"").trim().toUpperCase();
    if(isin.startsWith("KR")){
      const kr=normalizeKrSymbol(isin);
      if(/^\d{6}$/.test(kr)||/^[0-9A-Z]{6}$/.test(kr)) symbol=kr;
      market="KRX";
    }
    if(!isin||!symbol) continue;
    let cur=String(r?.crncy_cd||r?.dl_crncy_cd||r?.stmt_crncy_cd||"").trim().toUpperCase();
    if(!cur) cur=market==="KRX"?"KRW":currency("",market);
    out.push({
      isin,symbol,
      name:String(r?.hngl_is_nm||r?.eng_is_nm||symbol).trim(),
      market:market||"UNKNOWN",
      currency:cur,
      country:marketCountry(market,isin),
      provider_payload:r
    });
  }
  return out;
}
async function refreshSecurityMaster(appKey:string,token:string){
  const data=await callTr(appKey,token,"/api/v1/siam4983",{Record1:[{}]});
  const rows=normalizeMasterRows(data);
  const applied=await adminRpc("apply_kb_security_master_for_service",{p_rows:rows});
  return {rows:rows.length,applied};
}
function normalizeLedger(rows:any[],master:Record<string,MasterRow>={}){
  const tx:any[]=[];
  const divs:any[]=[];
  const flows:any[]=[];
  for(const r of rows){
    const type=classifyLedger(r);
    const tradeAt=isoKstDate(r?.dl_dt);
    const seq=String(r?.dl_sq||"").trim();
    if(!tradeAt || !seq) continue;
    const rawStd=String(r?.stnd_is_cd||"").trim().toUpperCase();
    const krStd=normalizeKrSymbol(rawStd);
    const isKr=krStd && /^[0-9A-Z]{6}$/.test(krStd) && rawStd.startsWith("KR");
    const mm=!isKr ? master[rawStd] : null;
    const std=isKr?krStd:String(mm?.symbol||rawStd);
    const rawMarket=String(r?.dl_mkt||"").trim().toUpperCase();
    const market=isKr?"KRX":String(mm?.market||rawMarket||"UNKNOWN");
    const foreignAmount=n(r?.fcrncy_amt);
    const wonAmount=n(r?.ec_amt);
    const conversionRatio=foreignAmount?Math.abs(wonAmount/foreignAmount):0;
    const isWonFx=type==="fx" && foreignAmount!==0
      && conversionRatio>=500 && conversionRatio<=3000;
    const isWonCashFlow=(type==="deposit"||type==="withdrawal")
      && !String(r?.crncy_clsf_nm||"").trim() && foreignAmount===0;
    const cur=isWonCashFlow||isWonFx?"KRW":isKr?"KRW":String(mm?.currency||currency(r?.crncy_clsf_nm,market));
    const fx=isWonCashFlow||isWonFx?1:(n(r?.exch_r)||1);
    const grossBase=isWonFx?wonAmount:foreignAmount!==0?foreignAmount:n(r?.dl_amt);
    const fee=n(r?.fee)+n(r?.abrd_fee);
    const componentTax=n(r?.incm_tx)+n(r?.dl_tx)+n(r?.rsdnt_tx)+n(r?.ffs_tx)+n(r?.trsf_tx);
    const tax=n(r?.tx)!==0?n(r?.tx):componentTax;
    const netRaw=wonAmount!==0?wonAmount:grossBase;
    const externalId=`KB:SWQA2301:${String(r.dl_dt)}:${seq}`;
    const summaryText=String(r?.smry_nm||"");
    const isTaxRefund=type==="tax" && /환급|입금/.test(summaryText);
    const fxDirection=type==="fx" && /출금/.test(summaryText)?"withdrawal":
      type==="fx" && /입금/.test(summaryText)?"deposit":type;
    const net=isTaxRefund?Math.abs(netRaw):signedAmount(netRaw,fxDirection);
    const gross=isTaxRefund?Math.abs(grossBase):signedAmount(grossBase,fxDirection);
    const item={
      external_id:externalId,
      trade_at:tradeAt,
      settlement_at:"",
      type,
      symbol:std||"",
      name:String(mm?.name||r?.is_nm||"").trim(),
      market,
      country:isKr?"KR":String(mm?.country||marketCountry(market,rawStd)),
      quantity:nOrNull(r?.q),
      price:nOrNull(r?.dl_uprc),
      gross_amount:gross,
      fee,
      tax,
      net_amount:net,
      currency:cur,
      fx_rate:fx,
      realized_pnl:"",
      official_realized_pnl:"",
      payload_hash:"",
      provider_payload:r
    };
    tx.push(item);

    if(type==="dividend"){
      const grossDiv=Math.abs(grossBase||netRaw);
      const netDiv=Math.abs(netRaw||Math.max(0,grossDiv-tax));
      divs.push({
        external_id:externalId,
        symbol:std||"",
        paid_at:tradeAt,
        ex_date:"",
        gross_amount:grossDiv,
        tax,
        net_amount:netDiv,
        currency:cur,
        fx_rate_to_base:fx
      });
    }
    if(type==="deposit"||type==="withdrawal"){
      flows.push({
        external_id:externalId,
        occurred_at:tradeAt,
        type:type==="deposit"?"deposit":"withdrawal",
        amount:type==="deposit"?Math.abs(netRaw): -Math.abs(netRaw),
        currency:cur,
        fx_rate_to_base:fx
      });
    }
  }
  return {transactions:tx,dividends:divs,cashFlows:flows};
}
function normalizeRealized(rows:any[],month:string){
  return rows.map((r:any)=>{
    const symbol=normalizeKrSymbol(r?.stnd_is_cd);
    const parts=[
      "KB","SSQM2442",month,String(r?.trd_dt||""),symbol,String(r?.trd_dl_ccd||""),
      String(r?.ccls_q||""),String(r?.ccls_uprc||""),String(r?.b_uprc||""),
      String(r?.rlztn_pl||""),String(r?.s_amt||""),String(r?.b_amt||"")
    ];
    return {
      provider_event_id:parts.join(":"),
      realized_date:String(r?.trd_dt||"").replace(/(\d{4})(\d{2})(\d{2})/,"$1-$2-$3"),
      symbol,
      name:String(r?.is_nm||symbol).trim(),
      market:"KRX",
      country:"KR",
      currency:"KRW",
      quantity:nOrNull(r?.ccls_q),
      sell_price:nOrNull(r?.ccls_uprc),
      buy_price:nOrNull(r?.b_uprc),
      sell_amount:nOrNull(r?.s_amt),
      buy_amount:nOrNull(r?.b_amt),
      fee:n(r?.fee),
      tax:n(r?.svrl_tx),
      realized_pnl:n(r?.rlztn_pl),
      return_rate:nOrNull(r?.yld),
      provider_payload:r
    };
  }).filter((x:any)=>/^\d{4}-\d{2}-\d{2}$/.test(x.realized_date));
}
async function syncHistoryMonth(userId:string,month:string){
  const {start,end}=monthBounds(month);
  const {appKey,appSecret}=await credentials(userId);
  const token=await issueToken(appKey,appSecret);

  const ledger=await pagedTr(appKey,token,"/api/v1/swqa2301",{
    strt_dt:start,end_dt:end,is_no:"",srt_clsf:"1"
  },"Record1",100);
  if(ledger.truncated) throw new Error("LEDGER_MONTH_TRUNCATED");

  const realized=await pagedTr(appKey,token,"/api/v1/ssqm2442",{
    inq_strt_dt:start,inq_end_dt:end,is_cd:""
  },"Record1",100);
  if(realized.truncated) throw new Error("REALIZED_MONTH_TRUNCATED");

  // Overseas settlement history is the most reliable KB source for ISIN -> traded ticker mapping.
  const settlement=await pagedTr(appKey,token,"/api/v1/spqm2205",{
    stnd_is_cd:"",strt_ordr_dt:start,end_ordr_dt:end,
    krw_unty_mgn_rqst_f:"0",trd_clsf:"99",dl_clsf:"0"
  },"Record1",100);
  if(settlement.truncated) throw new Error("OVERSEAS_SETTLEMENT_MONTH_TRUNCATED");
  const settlementMap:any[]=[];
  const settlementSeen=new Set<string>();
  for(const r of settlement.rows){
    const isin=String(r?.stnd_is_cd||"").trim();
    const symbol=String(r?.shrt_is_cd||"").trim();
    if(!isin||!symbol) continue;
    const key=isin+"|"+symbol;
    if(settlementSeen.has(key)) continue;
    settlementSeen.add(key);
    settlementMap.push({
      isin,symbol,
      name:String(r?.shrt_is_nm||"").trim(),
      currency:String(r?.crncy_cd||"").trim()
    });
  }
  if(settlementMap.length){
    await adminRpc("apply_kb_settlement_security_map_for_service",{p_rows:settlementMap});
  }

  let master=await loadSecurityMaster();
  if(Object.keys(master).length===0){
    await refreshSecurityMaster(appKey,token);
    master=await loadSecurityMaster();
  }
  const norm=normalizeLedger(ledger.rows,master);
  const realizedRows=normalizeRealized(realized.rows,month);

  const applied=await adminRpc("apply_kb_history_month_for_service",{
    p_user_id:userId,
    p_month:month,
    p_transactions:norm.transactions,
    p_dividends:norm.dividends,
    p_cash_flows:norm.cashFlows,
    p_realized:realizedRows
  });

  return {
    month,
    period:{start,end},
    ledgerRows:ledger.rows.length,
    ledgerPages:ledger.pages,
    realizedRows:realized.rows.length,
    realizedPages:realized.pages,
    overseasSettlementRows:settlement.rows.length,
    overseasSettlementMappings:settlementMap.length,
    dividends:norm.dividends.length,
    cashFlows:norm.cashFlows.length,
    applied,
    orderEndpointsEnabled:false
  };
}

async function backfillNextMonths(userId:string,requested:unknown){
  const count=Math.min(3,Math.max(1,Number(requested)||1));
  const result:any[]=[];
  for(let i=0;i<count;i++){
    const month=String(await adminRpc("next_kb_backfill_month_for_service",{p_user_id:userId})||"");
    if(!month)break;
    const step=await syncHistoryMonth(userId,month);
    await adminRpc("record_kb_backfill_month_for_service",{
      p_user_id:userId,p_month:month,p_ledger_rows:step.ledgerRows,
      p_settlement_rows:step.overseasSettlementRows
    });
    result.push({month,ledgerRows:step.ledgerRows,settlementRows:step.overseasSettlementRows});
  }
  return {months:result,completed:result.length};
}

function isoDate8(v:any){
  const s=String(v||"").replace(/[^0-9]/g,"");
  if(s.length!==8) return "";
  return s.slice(0,4)+"-"+s.slice(4,6)+"-"+s.slice(6,8);
}
function normalizeChartRows(securityId:string,currencyCode:string,rows:any[],kind:"domestic"|"overseas"){
  const out:any[]=[];
  for(const r of rows||[]){
    const d=isoDate8(r?.dt);
    if(!d) continue;
    const open=kind==="domestic"?nOrNull(r?.opn_prc_p2):nOrNull(r?.opn_prc_p4);
    const high=kind==="domestic"?nOrNull(r?.hgh_prc_p2):nOrNull(r?.hgh_prc_p4);
    const low=kind==="domestic"?nOrNull(r?.lw_prc_p2):nOrNull(r?.lw_prc_p4);
    const close=kind==="domestic"?nOrNull(r?.cls_prc_p2):nOrNull(r?.cls_prc_p4);
    if(close===null||close===0) continue;
    out.push({
      security_id:securityId,
      price_date:d,
      open,high,low,close,
      volume:nOrNull(r?.vlm),
      currency:currencyCode||"KRW",
      source:"kb_openapi",
      observed_at:new Date().toISOString()
    });
  }
  return out;
}
async function domesticChart(appKey:string,token:string,securityId:string,symbolRaw:string,currencyCode:string){
  const symbol=String(symbolRaw||"").replace(/^A/,"").trim();
  let lastErr:any=null;
  for(const mkt of ["0","1"]){
    for(const inq of ["2","1"]){
      try{
        const data=await callTr(appKey,token,"/api/v1/ivs11560",{
          info_ccd:"1",mkt_clsf:mkt,chrt_clsf:"D",minute_tck_indx:"",
          is_cd:symbol,inq_clsf:inq,strt_dy:"",inq_cnt:"300"
        });
        const b=data?.dataBody||{};
        const rows=Array.isArray(b?.out2)?b.out2:[];
        const norm=normalizeChartRows(securityId,currencyCode,rows,"domestic");
        if(norm.length) return norm;
      }catch(e){lastErr=e}
    }
  }
  if(lastErr) throw lastErr;
  return [];
}
async function overseasChart(appKey:string,token:string,securityId:string,symbol:string,exchange:string,currencyCode:string){
  // An ETF can trade on a different US venue than the one KB assigned to its
  // security master. Try the broker's other US exchange codes before declaring
  // historical prices unavailable. Keep the broker's split-adjusted series;
  // never multiply it by corporate-action quantities a second time.
  const primary=String(exchange||"NAS").trim().toUpperCase();
  const exchanges=[primary,...["NAS","NYS","AMX"].filter(x=>x!==primary)];
  let lastError:unknown=null;
  for(const venue of exchanges){
    try{
      const data=await callTr(appKey,token,"/api/v1/gsc10060",{
        krx_cd:venue,is_cd:String(symbol||"").trim().toUpperCase(),
        chrt_clsf:"3",bndl:"",mdfy_stk_prc_use_f:"1",
        rcrd_c:"300",srch_strt_dy:"",clsf:"1"
      });
      const b=data?.dataBody||{};
      const rows=normalizeChartRows(securityId,currencyCode,
        Array.isArray(b?.out2)?b.out2:[],"overseas");
      if(rows.length)return rows;
    }catch(error){lastError=error}
  }
  if(lastError)throw lastError;
  return [];
}
async function syncHoldingPrices(userId:string){
  const {appKey,appSecret}=await credentials(userId);
  const token=await issueToken(appKey,appSecret);
  const secs=await adminRpc("get_live_holding_securities_for_service",{p_user_id:userId});
  // Keep historical prices for the user's previously traded leveraged pair and
  // its underlying ETF even after the position has been fully sold.
  const benchResponse=await fetch(SUPABASE_URL+
    "/rest/v1/securities?select=id,symbol,market,currency&symbol=in.(SOXX,SOXL,SOXS)",{
      headers:{apikey:SECRET_KEY}
    });
  const benchmarks=benchResponse.ok?await benchResponse.json():[];
  const syncList=[...(Array.isArray(secs)?secs:[])];
  for(const b of (Array.isArray(benchmarks)?benchmarks:[])){
    if(!syncList.some((s:any)=>String(s?.security_id||"")===String(b.id))){
      syncList.push({security_id:b.id,symbol:b.symbol,market:b.market,currency:b.currency});
    }
  }
  const results:any[]=[];
  let total=0;
  for(const s of syncList){
    const sid=String(s?.security_id||"");
    const symbol=String(s?.symbol||"");
    const market=String(s?.market||"");
    const cur=String(s?.currency||"KRW");
    if(!sid||!symbol) continue;
    try{
      const rows=market==="KRX"
        ? await domesticChart(appKey,token,sid,symbol,cur)
        : await overseasChart(appKey,token,sid,symbol,market,cur);
      const written=Number(await adminRpc("upsert_daily_security_prices_for_service",{p_rows:rows})||0);
      total+=written;
      results.push({symbol,market,rows:rows.length,written,ok:true});
    }catch(e){
      const err:any=e;
      results.push({symbol,market,rows:0,written:0,ok:false,code:String(err?.message||"PRICE_SYNC_FAILED"),detail:err?.detail||null});
    }
  }
  return {securities:results.length,rowsWritten:total,results,orderEndpointsEnabled:false};
}

async function syncHistoricalFx(){
  // The public H.10 series transmits no user portfolio or credentials to FRED.
  // US noon rate is only a historical estimate of a Korean broker's applied FX.
  const url="https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXKOUS&cosd=2020-01-01";
  const reply=await fetch(url,{headers:{accept:"text/csv"},signal:AbortSignal.timeout(22000)});
  if(!reply.ok)throw new Error("FED_FX_HTTP_"+reply.status);
  const csv=await reply.text();
  const lines=csv.trim().split(/\r?\n/);
  if(!/^(DATE|observation_date),DEXKOUS\s*$/i.test(lines[0]?.trim()||""))
    throw new Error("FED_FX_FORMAT_CHANGED");
  const observations:{date:string;rate:number}[]=[];
  for(const line of lines.slice(1)){
    const match=/^(\d{4}-\d{2}-\d{2}),([0-9]+(?:\.[0-9]+)?)\s*$/.exec(line.trim());
    if(!match)continue;
    const rate=Number(match[2]);
    if(rate>=500&&rate<=3000)observations.push({date:match[1],rate});
  }
  if(observations.length<100)throw new Error("FED_FX_TOO_FEW_OBSERVATIONS");
  let written=0;
  for(let i=0;i<observations.length;i+=400){
    written+=Number(await adminRpc("upsert_historical_fx_for_service",{
      p_rows:observations.slice(i,i+400)
    })||0);
  }
  return {ok:true,source:"Federal Reserve H.10 DEXKOUS; historical proxy",
    observations:written,firstDate:observations[0]?.date,
    lastDate:observations[observations.length-1]?.date};
}

async function syncScenarioPrices(userId:string,securityIds:unknown){
  if(!Array.isArray(securityIds)||securityIds.length<1||securityIds.length>4) throw new Error("INVALID_TARGET_SECURITIES");
  const ids=[...new Set(securityIds.map(String))];
  if(ids.some(id=>!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) throw new Error("INVALID_TARGET_SECURITY_ID");
  const {appKey,appSecret}=await credentials(userId);
  const token=await issueToken(appKey,appSecret);
  const lookup=await fetch(SUPABASE_URL+"/rest/v1/securities?select=id,symbol,market,currency&id=in.("+ids.join(",")+")",{
    headers:{apikey:SECRET_KEY}
  });
  if(!lookup.ok) throw new Error("TARGET_SECURITY_LOOKUP_FAILED");
  const secs=await lookup.json();
  if(!Array.isArray(secs)||secs.length!==ids.length) throw new Error("TARGET_SECURITY_NOT_FOUND");
  const results:any[]=[];
  for(const s of secs){
    try{
      const rows=String(s.market)==="KRX"
        ? await domesticChart(appKey,token,s.id,s.symbol,s.currency)
        : await overseasChart(appKey,token,s.id,s.symbol,s.market,s.currency);
      if(!rows.length) throw new Error("NO_PRICE_ROWS");
      const written=Number(await adminRpc("upsert_daily_security_prices_for_service",{p_rows:rows})||0);
      results.push({symbol:s.symbol,ok:true,rows:rows.length,written});
    }catch(e){results.push({symbol:s.symbol,ok:false,code:String((e as Error).message||"TARGET_PRICE_FAILED")})}
  }
  return {results,rowsWritten:results.reduce((n,r)=>n+Number(r.written||0),0),orderEndpointsEnabled:false};
}

function inferSecurityRoute(b:any,sourceCode:string=""){
  const prefix=String(sourceCode||"").slice(0,2).toUpperCase();
  if(prefix==="KR") return {country:"KR",currency:"KRW",exchanges:["KRX"]};
  if(prefix==="US") return {country:"US",currency:"USD",exchanges:["NAS","NYS","AMX"]};
  if(prefix==="JP") return {country:"JP",currency:"JPY",exchanges:["TSE"]};
  if(prefix==="HK") return {country:"HK",currency:"HKD",exchanges:["HKS"]};
  if(prefix==="CN") return {country:"CN",currency:"CNY",exchanges:["SHS","SZS"]};
  if(prefix==="GB") return {country:"GB",currency:"GBP",exchanges:["LSE"]};
  if(prefix==="CA") return {country:"CA",currency:"CAD",exchanges:["TSX"]};
  const domestic=String(b?.dmstc_clsf_nm||"").includes("국내");
  const region=String(b?.dl_crncy_clsf_nm||"").trim();
  if(domestic) return {country:"KR",currency:"KRW",exchanges:["KRX"]};
  if(region.includes("미국")) return {country:"US",currency:"USD",exchanges:["NAS","NYS","AMX"]};
  if(region.includes("일본")) return {country:"JP",currency:"JPY",exchanges:["TSE"]};
  if(region.includes("홍콩")) return {country:"HK",currency:"HKD",exchanges:["HKS"]};
  if(region.includes("중국")) return {country:"CN",currency:"CNY",exchanges:["SHS","SZS"]};
  if(region.includes("영국")) return {country:"GB",currency:"GBP",exchanges:["LSE"]};
  if(region.includes("캐나다")) return {country:"CA",currency:"CAD",exchanges:["TSX"]};
  return {country:"",currency:"USD",exchanges:["NAS","NYS","AMX"]};
}
async function resolveUnknownSecurities(userId:string){
  const {appKey,appSecret}=await credentials(userId);
  const token=await issueToken(appKey,appSecret);
  const rows=await adminRpc("get_unresolved_kb_securities_for_service",{});
  const out:any[]=[];
  for(const r of (Array.isArray(rows)?rows:[])){
    const securityId=String(r?.security_id||"");
    const sourceCode=String(r?.source_code||"").trim();
    if(!securityId||!sourceCode) continue;
    try{
      const data=await callTr(appKey,token,"/api/v1/siqm4900",{stnd_is_cd:sourceCode});
      const b=data?.dataBody||{};
      const route=inferSecurityRoute(b,sourceCode);
      const canonical=String(
        route.country==="KR"
          ? (b?.shrt_is_cd||b?.symbl_is_cd||"")
          : (b?.symbl_is_cd||b?.shrt_is_cd||"")
      ).trim();
      const name=String(b?.hngl_is_nm||b?.hngl_shrt_nm||r?.stored_name||canonical).trim();
      const ok=Boolean(canonical);
      await adminRpc("save_kb_security_resolution_for_service",{
        p_security_id:securityId,
        p_source_code:sourceCode,
        p_canonical_symbol:canonical||null,
        p_canonical_name:name||null,
        p_country:route.country||null,
        p_currency:route.currency||null,
        p_exchange_candidates:route.exchanges,
        p_resolved:ok,
        p_error_code:ok?null:"EMPTY_SYMBOL"
      });
      out.push({securityId,sourceCode,canonical,name,country:route.country,currency:route.currency,exchanges:route.exchanges,ok});
    }catch(e){
      await adminRpc("save_kb_security_resolution_for_service",{
        p_security_id:securityId,p_source_code:sourceCode,p_canonical_symbol:null,p_canonical_name:String(r?.stored_name||""),
        p_country:null,p_currency:String(r?.stored_currency||"USD"),p_exchange_candidates:[],p_resolved:false,
        p_error_code:String((e as any)?.message||"RESOLVE_FAILED").slice(0,120)
      }).catch(()=>{});
      out.push({securityId,sourceCode,ok:false,error:String((e as any)?.message||"RESOLVE_FAILED")});
    }
    await new Promise(res=>setTimeout(res,80));
  }
  return {total:out.length,resolved:out.filter(x=>x.ok).length,failed:out.filter(x=>!x.ok).length,items:out};
}

Deno.serve(async (req:Request) => {
  if (req.method === "OPTIONS") return new Response(null,{status:204,headers:headers(req)});
  if (req.method !== "POST") return json(req,{ok:false,code:"METHOD_NOT_ALLOWED"},405);
  const body = await req.json().catch(()=>({}));
  let userId:string|null = null;
  try { userId = await resolveUser(req,body); }
  catch(e) { return json(req,{ok:false,code:String((e as Error).message||"AUTH_FAILED")},400); }
  if (!userId) return json(req,{ok:false,code:"AUTH_REQUIRED"},401);
  const action = String(body?.action || "preview");
  try {
    if (action === "preview") {
      const p = await previewUser(userId);
      return json(req,{ok:true,mode:"read_only_preview",orderEndpointsEnabled:false,...p});
    }



    if (action === "resolve-security-universe") {
      const rr=await resolveUnknownSecurities(userId);
      return json(req,{ok:true,mode:"security_resolution",...rr,orderEndpointsEnabled:false});
    }
    if (action === "sync-prices") {
      const p=await syncHoldingPrices(userId);
      const fx=await syncHistoricalFx().catch(e=>({ok:false,
        error:String((e as Error)?.message||"FX_SYNC_FAILED")}));
      const rs=Array.isArray(p?.results)?p.results:[];
      const failed=rs.filter((x:any)=>!x?.ok);
      const status=failed.length===0?"success":(failed.length===rs.length?"failed":"partial");
      await adminRpc("log_kb_sync_for_service",{
        p_user_id:userId,p_scope:"kb_price_history",p_status:status,
        p_rows_read:rs.reduce((a:number,x:any)=>a+Number(x?.rows||0),0),
        p_rows_written:Number(p?.rowsWritten||0),
        p_error_code:failed.length?"PRICE_SYNC_PARTIAL":null,
        p_error_message:failed.length?failed.map((x:any)=>String(x?.symbol||"?")+":"+String(x?.code||"failed")).slice(0,10).join(", "):null,
        p_detail:{securities:p?.securities||0,failed:failed.length,order_endpoints_enabled:false}
      }).catch(()=>{});
      return json(req,{ok:true,mode:"price_history_sync",...p,historicalFx:fx});
    }
    if (action === "sync-fx-history") {
      const fx=await syncHistoricalFx();
      return json(req,{ok:true,mode:"historical_fx_proxy",...fx});
    }
    if (action === "sync-target-prices") {
      const p=await syncScenarioPrices(userId,body?.security_ids);
      return json(req,{ok:true,mode:"scenario_price_sync",...p});
    }
    if (action === "sync-current") {
      const s = await syncCurrent(userId);
      return json(req,{ok:true,mode:"current_snapshot_sync",...s});
    }
    if (action === "preview-history") {
      const h = await previewHistory(userId);
      return json(req,{ok:true,mode:"history_preview",...h});
    }
    if (action === "sync-history-month") {
      const month=String(body?.month||"");
      const h=await syncHistoryMonth(userId,month);
      return json(req,{ok:true,mode:"history_month_sync",...h});
    }
    if(action==="backfill-next"){
      const report=await backfillNextMonths(userId,body?.months);
      return json(req,{ok:true,mode:"idempotent_kb_backfill",...report,orderEndpointsEnabled:false});
    }
    return json(req,{ok:false,code:"UNKNOWN_ACTION"},400);
  } catch(e) {
    const err:any=e;
    const code=String(err?.message||"KB_SYNC_FAILED");
    await adminRpc("log_kb_sync_for_service",{
      p_user_id:userId,
      p_scope:"kb_worker_"+action.replace(/[^a-z0-9_-]/gi,"_"),
      p_status:"failed",
      p_rows_read:0,p_rows_written:0,
      p_error_code:code.slice(0,120),
      p_error_message:String(err?.detail?.message||err?.detail||code).slice(0,500),
      p_detail:{action,order_endpoints_enabled:false}
    }).catch(()=>{});
    return json(req,{
      ok:false,
      code,
      detail:err?.detail||null,
      orderEndpointsEnabled:false
    },502);
  }
});
