# Run from repo root with BASELINE_UI and CANDIDATE_UI pointing to exact source files.
import subprocess,json,os
from pathlib import Path
samples=[]
for run in range(5):
 for variant in (['baseline','candidate'] if run%2==0 else ['candidate','baseline']):
  env=dict(os.environ,UI_SOURCE=os.environ['BASELINE_UI' if variant=='baseline' else 'CANDIDATE_UI'],PAIRS='1')
  d=json.loads(subprocess.check_output(['node','experiments/realized-profile261.mjs'],env=env,stderr=open('/tmp/compare261.log','a')))
  for s in d['samples']:s['variant']=variant;s['pair']=run;samples.append(s)
  Path('performance/realized-format261.json').write_text(json.dumps({'browser':d['browser'],'viewport':d['viewport'],'cpuThrottle':4,'transportMs':50,'transactions':3000,'samples':samples}))
  print(run,variant,flush=True)
