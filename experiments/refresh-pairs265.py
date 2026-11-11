import os,subprocess,json
samples=json.load(open(os.environ["PAIR_PREFIX"])) if os.environ.get("PAIR_PREFIX") else []
for i in range(int(os.environ.get("PAIR_START",0)),3):
 for variant in (['before','after'] if i%2==0 else ['after','before']):
  env=dict(os.environ,UI_SOURCE=os.environ.get('BASELINE_UI','index.html') if variant=='before' else os.environ.get('CANDIDATE_UI','/tmp/candidate265.html'),PERIODS='1M',RUNS='1')
  d=json.loads(subprocess.check_output(['node','experiments/manual-refresh265.mjs'],env=env))
  for x in d['samples']:
   x.update(pair=i,variant=variant)
   x['firstPaintMs']=next(p['ms'] for p in x['paints'] if p['revision']>0)-x['clickOffsetMs']
   x['latestPaintMs']=next(p['ms'] for p in x['paints'] if p['revision']==x['finalRevision'])-x['clickOffsetMs']
   samples.append(x)
open('performance/refresh-pairs265.json','w').write(json.dumps({'scope':'three alternating pairs, Chromium390,4 synthetic holdings,50ms responses,unthrottled CPU,actual click capture,2-month failure fixture; no production timing', 'samples':samples},indent=2))
