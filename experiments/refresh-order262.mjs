// Rejected-candidate generator; never edits the application in place.
import {readFileSync,writeFileSync} from 'node:fs';
const [input,output]=process.argv.slice(2);if(!input||!output||input===output)throw Error('Separate input/output paths required');
const s=readFileSync(input,'utf8'),needle="stockView==='total'&&live&&live.stockPnl&&live.stockPnl.ok";
if(s.split(needle).length!==2)throw Error('Source drift');
writeFileSync(output,s.replace(needle,"stockView==='total'&&live&&!live.stockPnlLoading&&live.stockPnl&&live.stockPnl.ok"));
