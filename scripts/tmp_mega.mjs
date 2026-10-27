import { carasDesdeVertices, construirPegatinas, dot, unit, esc } from '../src/core/geometria.js';
const f=(1+Math.sqrt(5))/2;
const V=[]; for(const a of[-1,1])for(const b of[-1,1])for(const c of[-1,1])V.push([a,b,c]);
for(const a of[-1,1])for(const b of[-1,1]){V.push([0,a/f,b*f]);V.push([a/f,b*f,0]);V.push([a*f,0,b/f]);}
const cyc=(t)=>[t,[t[2],t[0],t[1]],[t[1],t[2],t[0]]];
for (const base of [[0,1,f],[0,f,1]]) {
  const N=[]; for(const a of[-1,1])for(const b of[-1,1]) N.push(...cyc([0,base[1]*a,base[2]*b]));
  const counts=N.map(n=>{const u=unit(n);const m=Math.max(...V.map(v=>dot(v,u)));return V.filter(v=>Math.abs(dot(v,u)-m)<1e-6).length});
  console.log(base, counts.join(','));
}
