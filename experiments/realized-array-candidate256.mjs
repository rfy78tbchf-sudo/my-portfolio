// Synthetic-only candidate. Keep financial logic and item order unchanged.
export function candidateSql(source){
  const boundary='  -- Prefer an independently reconciled broker-reported domestic profit.';
  const at=source.indexOf(boundary);
  if(at<0)throw Error('official-source boundary changed');
  let before=source.slice(0,at);
  const append='v_items:=v_items||jsonb_build_array(jsonb_build_object(';
  if(before.split(append).length!==4)throw Error('expected three ledger/pending append sites');
  before=before.replace("  v_items jsonb := '[]'::jsonb;", "  v_items jsonb := '[]'::jsonb;\n  v_item_array jsonb[] := array[]::jsonb[];");
  before=before.replaceAll(append,'v_item_array:=array_append(v_item_array,jsonb_build_object(');
  return before+'  v_items:=to_jsonb(v_item_array);v_item_array:=null;\n'+source.slice(at);
}
