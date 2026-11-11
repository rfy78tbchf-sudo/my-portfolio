import subprocess,json,os
from pathlib import Path
samples=[]
for run in range(3):
 for variant in (['baseline','candidate'] if run%2==0 else ['candidate','baseline']):
  env=dict(os.environ,UI_SOURCE=os.environ['BASELINE_UI' if variant=='baseline' else 'CANDIDATE_UI'],HOLDINGS='4')
  env.pop('REQUIRE_FRESH_SWITCH',None)
  d=json.loads(subprocess.check_output(['node','tests/refresh_view_switch253.mjs'],env=env))
  samples.append(dict(variant=variant,run=run,**d['samples'][0]))
Path('performance/refresh-switch262.json').write_text(json.dumps(dict(browser='chromium',transportMs=50,heldTotalMs=1000,samples=samples)))
print(json.dumps(samples))
