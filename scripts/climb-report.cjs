// Run with: node scripts/climb-report.cjs (uses the project's TypeScript compiler).
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const {parseGPX}=require('../src/services/gpx.ts');
const {preprocessElevationProfile,detectClimbs,applyClimbSettings}=require('../src/services/climbs.ts');
const {DEFAULT_CLIMB_SETTINGS}=require('../src/config/climbs.ts');
const report=[];
for(const file of ['samples/berlin.gpx','samples/climbs-demo.gpx']) {
 const route=parseGPX(fs.readFileSync(file,'utf8'));const times=[];
 for(let i=0;i<110;i++){const start=performance.now();detectClimbs(preprocessElevationProfile(route));if(i>=10)times.push(performance.now()-start);}
 times.sort((a,b)=>a-b);
 report.push({file,points:route.points.length,distanceKm:route.totalDistance,climbs:Object.fromEntries(['high','medium','low'].map(preset=>[preset,applyClimbSettings(route,{...DEFAULT_CLIMB_SETTINGS,preset}).climbs.length])),analysisMedianMs:times[50],analysisP95Ms:times[95]});
}
const points=Array.from({length:10001},(_,i)=>({distance:i/100,elevation:500+200*Math.sin(i/150)+(i%3-1)*2,lat:0,lon:i/11100}));
const large={segments:[{points,line:null}]};const times=[];
for(let i=0;i<30;i++){const start=performance.now();detectClimbs(preprocessElevationProfile(large));times.push(performance.now()-start);}times.sort((a,b)=>a-b);
report.push({syntheticPoints:points.length,distanceKm:100,analysisMedianMs:times[15],analysisP95Ms:times[28]});
console.log(JSON.stringify(report,null,2));
fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/climb-analysis-report.json',JSON.stringify(report,null,2)+'\n');
