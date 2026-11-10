import subprocess,json,os
from pathlib import Path
samples=[]
for run in range(5):
 for variant in (['baseline','candidate'] if run%2==0 else ['candidate','baseline']):
  env=dict(os.environ,UI_SOURCE=os.environ['BASELINE_UI' if variant=='baseline' else 'CANDIDATE_UI'],SECURITIES='1',TRANSACTIONS='3000',PAIRS='1',CONDITIONS='none')
  d=json.loads(subprocess.check_output(['node','experiments/refresh-current262.mjs'],env=env,stderr=open('/tmp/refresh-compare262.log','a')))
  for s in d['samples']:s['variant']=variant;s['pair']=run;samples.append(s)
  Path('performance/refresh-compare262.json').write_text(json.dumps(dict(browser=d['browser'],viewport=d['viewport'],transportMs=50,transactions=3000,securities=1,samples=samples)))
  print(run,variant,flush=True)
