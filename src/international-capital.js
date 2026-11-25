// Purpose/instrument ledger, not BPM6 classification by ultimate investor ID.
// No extra cash posting or GDP: all amounts refer to existing settled flows.
import {enterpriseBusinesses} from './enterprise-market.js';
const sum=a=>a.reduce((a,b)=>a+b,0);
export const internationalActive=s=>(s.economy?.revision??0)>=21;
export function initializeInternationalCapital(s){if(internationalActive(s)&&!s.internationalCapital)s.internationalCapital={version:1,startedMonth:s.month,last:{},history:[],completions:[]};}
export function stampForeignFunding(s,project,unit){
 if(!internationalActive(s)||project.legacy||project.type!=='private')return project;
 const rows=enterpriseBusinesses(s).filter(c=>c.sector===project.sector||s.firms[project.sector]===c||project.sector===2&&s.enterpriseMarket.companies.includes(c));
 const ids=project.firmIds??project.enterpriseIds,shares=project.firmShares??project.enterpriseShares;
 let paid=0;for(const c of rows){const share=ids?(shares[ids.indexOf(c.id)]??0):rows.length===1?1:0,invoice=project.amount*unit*share;
  const available=Math.min(Math.max(0,c.externalEquityCashLC??0),Math.max(0,c.cash)+invoice),used=Math.min(invoice,available);c.externalEquityCashLC=Math.max(0,(c.externalEquityCashLC??0)-used);paid+=used;
 }
 project.foreignFunding={paidLC:paid,totalPaidLC:project.amount*unit,exchangeRate:s.exchangeRate,rule:'Earmarked primary-equity cash first, bounded by actual funds; not causal identification of investment.'};return project;
}
export function recordForeignCompletion(s,project,capital){if(!internationalActive(s)||!project.foreignFunding)return;const f=project.foreignFunding;s.internationalCapital.completions.push({month:s.month,sector:project.sector,capital,foreignFundedCapital:capital*f.paidLC/Math.max(f.totalPaidLC,1e-12),paidLC:f.paidLC});s.internationalCapital.completions=s.internationalCapital.completions.slice(-360);}
export function finishInternationalCapital(s){
 if(!internationalActive(s))return;const c=s.internationalCapital,e=s.lastReport.external,entries=[...(s.businessDynamics.last.entries??[]).map(x=>({foreign:x.source==='foreign-equity',paidUSD:x.paidUSD??0})),...(s.firmMarkets?.last.entries??[]).map(x=>({foreign:x.foreign,paidUSD:x.paid/s.exchangeRate}))],newFirmUSD=sum(entries.filter(x=>x.foreign).map(x=>x.paidUSD));
 c.last={month:s.month,newFirmEquityUSD:newFirmUSD,existingFirmPrimaryEquityUSD:Math.max(0,e.greenfieldUSD-newFirmUSD),secondaryEquityUSD:e.portfolioEquityUSD,reinvestedEarningsUSD:e.reinvestedFDIUSD,dividendsPaidUSD:e.foreignDividendsUSD,primaryEquityUSD:e.greenfieldUSD,totalEquityFlowUSD:e.inflowUSD+e.reinvestedFDIUSD,completedForeignFundedCapital:sum(c.completions.filter(x=>x.month===s.month).map(x=>x.foreignFundedCapital)),foreignEquityStockUSD:sum(enterpriseBusinesses(s).map(f=>f.foreignEquityUSD??0)),sovereignExternalDebtUSD:sum(s.government.externalBonds.map(b=>b.principal)),classification:'Economic purpose. Aggregate foreign ownership cannot identify BPM6 direct/portfolio relationships or ultimate investors.'};
 c.history.push({...c.last});c.history=c.history.slice(-120);s.lastReport.internationalCapital={...c.last};
}
export function validateInternationalCapital(s){if(!internationalActive(s))return;const c=s.internationalCapital;if(!c||c.version!==1||!Number.isInteger(c.startedMonth)||c.startedMonth>s.month||!Array.isArray(c.history)||c.history.length>120||!Array.isArray(c.completions)||c.completions.length>360)throw new Error('Повреждён учёт иностранного капитала');for(const p of s.projects.filter(p=>p.foreignFunding)){const f=p.foreignFunding;if(!Number.isFinite(f.paidLC)||f.paidLC<0||!Number.isFinite(f.totalPaidLC)||f.totalPaidLC<0||f.paidLC>f.totalPaidLC+1e-6||!Number.isFinite(f.exchangeRate)||f.exchangeRate<=0)throw new Error('Повреждён источник финансирования проекта');}}
