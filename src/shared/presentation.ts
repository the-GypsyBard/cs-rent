const labels:Record<string,string>={'款式 1':'P1','款式 2':'P2','款式 3':'P3','款式 4':'P4',Ruby:'红宝石',Sapphire:'蓝宝石',Emerald:'绿宝石','Black Pearl':'黑珍珠','Phase 1':'P1','Phase 2':'P2','Phase 3':'P3','Phase 4':'P4'};
/** Display aliases only. Source IDs and raw phase values remain stable for backups. */
export function styleLabel(value?:string){return value?labels[value]||value:'';}
export function localizedText(value:string){return Object.entries(labels).reduce((s,[raw,label])=>s.replaceAll(raw,label),value);}
const normalize=(s:string)=>s.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
/** Whitespace separates required keywords; punctuation and keyword order do not matter. */
export function matchesSearch(value:string,query:string){const text=normalize(value+' '+localizedText(value));return query.trim().split(/\s+/u).filter(Boolean).every(part=>text.includes(normalize(part)));}
export function searchOption(input:string,option?:{label?:unknown;searchText?:string}){return matchesSearch(option?.searchText||String(option?.label||''),input);}
export function orderedWears(wears:string[]){const order=['崭新出厂','略有磨损','久经沙场','破损不堪','战痕累累','不适用'];return [...wears].sort((a,b)=>order.indexOf(a)-order.indexOf(b));}

export function compareStyles(a?:string,b?:string){const order=['P1','P2','P3','P4','红宝石','蓝宝石','黑珍珠','绿宝石'];const rank=(s?:string)=>{const n=order.indexOf(styleLabel(s));return n<0?99:n;};return rank(a)-rank(b);}
