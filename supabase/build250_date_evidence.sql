-- Build250: share owned domestic date evidence and immutable projections within one RPC.
-- Preserve RLS, source filters, matching cardinality and full history. No data writes.
do $patch$
declare d text; h text;
begin
 select pg_get_functiondef('public.get_live_period_stock_pnl(text)'::regprocedure) into d;
 h:=md5(btrim(d,E' \n\r\t'));
 if h='a1c5b0dd24c00467912fc425ce351892' then return; end if;
 if h<>'d01b995dee57a93d3468e6e8b820ab4b' then raise exception 'Build250 period definition drift';end if;
 if (length(d)-length(replace(d,$old0$), domestic_date_candidates as materialized ($old0$,'')))/length($old0$), domestic_date_candidates as materialized ($old0$)<>1 then raise exception 'Build250 pattern 0 drift';end if;
 d:=replace(d,$old0$), domestic_date_candidates as materialized ($old0$,$new0$), owned_date_evidence as materialized (
 select r.*,trim(r.provider_payload->>'stnd_is_cd') evidence_isin,
 trim(r.provider_payload->>'trd_dl_ccd') evidence_side,
 to_char(r.realized_date,'YYYYMMDD')=trim(r.provider_payload->>'trd_dt') evidence_date_valid
 from public.realized_pnl_events r join account a on a.id=r.account_id
 where r.source='api' and r.currency='KRW' and r.provider_event_id like 'KB:SSQM2442:%'
), domestic_date_candidates as materialized ($new0$);
 if (length(d)-length(replace(d,$old1$join public.realized_pnl_events r on r.account_id=t.account_id$old1$,'')))/length($old1$join public.realized_pnl_events r on r.account_id=t.account_id$old1$)<>1 then raise exception 'Build250 pattern 1 drift';end if;
 d:=replace(d,$old1$join public.realized_pnl_events r on r.account_id=t.account_id$old1$,$new1$join owned_date_evidence r on r.account_id=t.account_id$new1$);
 if (length(d)-length(replace(d,$old2$join public.realized_pnl_events r on r.account_id=g.account_id$old2$,'')))/length($old2$join public.realized_pnl_events r on r.account_id=g.account_id$old2$)<>1 then raise exception 'Build250 pattern 2 drift';end if;
 d:=replace(d,$old2$join public.realized_pnl_events r on r.account_id=g.account_id$old2$,$new2$join owned_date_evidence r on r.account_id=g.account_id$new2$);
 if (length(d)-length(replace(d,$old3$and trim(r.provider_payload->>'stnd_is_cd')=$old3$,'')))/length($old3$and trim(r.provider_payload->>'stnd_is_cd')=$old3$)<>2 then raise exception 'Build250 pattern 3 drift';end if;
 d:=replace(d,$old3$and trim(r.provider_payload->>'stnd_is_cd')=$old3$,$new3$and r.evidence_isin=$new3$);
 if (length(d)-length(replace(d,$old4$and trim(r.provider_payload->>'trd_dl_ccd')=case t.type$old4$,'')))/length($old4$and trim(r.provider_payload->>'trd_dl_ccd')=case t.type$old4$)<>1 then raise exception 'Build250 pattern 4 drift';end if;
 d:=replace(d,$old4$and trim(r.provider_payload->>'trd_dl_ccd')=case t.type$old4$,$new4$and r.evidence_side=case t.type$new4$);
 if (length(d)-length(replace(d,$old5$and trim(r.provider_payload->>'trd_dl_ccd')=case g.type$old5$,'')))/length($old5$and trim(r.provider_payload->>'trd_dl_ccd')=case g.type$old5$)<>1 then raise exception 'Build250 pattern 5 drift';end if;
 d:=replace(d,$old5$and trim(r.provider_payload->>'trd_dl_ccd')=case g.type$old5$,$new5$and r.evidence_side=case g.type$new5$);
 if (length(d)-length(replace(d,$old6$and to_char(r.realized_date,'YYYYMMDD')=trim(r.provider_payload->>'trd_dt')
 and r.realized_date between$old6$,'')))/length($old6$and to_char(r.realized_date,'YYYYMMDD')=trim(r.provider_payload->>'trd_dt')
 and r.realized_date between$old6$)<>2 then raise exception 'Build250 pattern 6 drift';end if;
 d:=replace(d,$old6$and to_char(r.realized_date,'YYYYMMDD')=trim(r.provider_payload->>'trd_dt')
 and r.realized_date between$old6$,$new6$and r.evidence_date_valid
 and r.realized_date between$new6$);
 execute d;
end $patch$;
