import{t as e}from"./jsx-runtime-xjYCO11z.js";import{a as t,n}from"./index-Bamh1MhP.js";var r=t(),i=e(),a=({state:e})=>{let{historyDrawerExercise:t,setHistoryDrawerExercise:a,getExerciseHistoryData:o,getExercisePr:s,t:c}=e,l=(0,r.useRef)(null),u=t,d=()=>{a(null)};if((0,r.useEffect)(()=>{let e=l.current;e&&(u?e.open||e.showModal():e.open&&e.close())},[u]),(0,r.useEffect)(()=>{let e=l.current;if(!e)return;let t=()=>{d()},n=t=>{if(t.target!==e)return;let n=e.getBoundingClientRect();n.top<=t.clientY&&t.clientY<=n.top+n.height&&n.left<=t.clientX&&t.clientX<=n.left+n.width||e.close()};return e.addEventListener(`close`,t),e.addEventListener(`click`,n),()=>{e.removeEventListener(`close`,t),e.removeEventListener(`click`,n)}},[d]),!u)return null;let f=o(u),p=s(u),m=p.bestLoad?`${p.bestLoad}`:c.noPreviousLoad;return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(`style`,{children:`
        dialog.history-drawer-dialog {
          margin-top: auto;
          margin-bottom: 0;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          width: 100%;
          max-width: 28rem;
          border-top-left-radius: 2rem;
          border-top-right-radius: 2rem;
          border: 1px solid #D8CFBE;
          background-color: #FFFCF4;
          padding: 1.5rem;
          padding-bottom: calc(1.5rem + var(--safe-bottom));
          box-shadow: 0 -10px 25px -5px rgba(0, 0, 0, 0.1), 0 -8px 10px -6px rgba(0, 0, 0, 0.1);
          transform: translateY(100%);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), display 0.25s allow-discrete;
          outline: none;
        }
        dialog.history-drawer-dialog[open] {
          transform: translateY(0);
        }
        @starting-style {
          dialog.history-drawer-dialog[open] {
            transform: translateY(100%);
          }
        }
        dialog.history-drawer-dialog::backdrop {
          background-color: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          opacity: 0;
          transition: opacity 0.25s ease-out, display 0.25s allow-discrete;
        }
        dialog.history-drawer-dialog[open]::backdrop {
          opacity: 1;
        }
        @starting-style {
          dialog.history-drawer-dialog[open]::backdrop {
            opacity: 0;
          }
        }
      `}),(0,i.jsx)(`dialog`,{ref:l,className:`history-drawer-dialog`,"data-testid":`history-drawer`,"aria-labelledby":`history-drawer-title`,children:(0,i.jsxs)(`div`,{className:`flex flex-col h-full max-h-[80vh]`,children:[(0,i.jsxs)(`div`,{className:`flex items-start justify-between border-b border-[#D8CFBE] pb-4`,children:[(0,i.jsxs)(`div`,{className:`min-w-0`,children:[(0,i.jsx)(`span`,{className:`text-[10px] font-black uppercase tracking-wide text-[#2F6F5E]`,children:c.historyDrawerTitle}),(0,i.jsx)(`h3`,{id:`history-drawer-title`,className:`text-2xl font-black text-[#171915] truncate`,children:u})]}),(0,i.jsx)(`button`,{onClick:()=>l.current?.close(),className:`flex h-10 w-10 items-center justify-center rounded-full border border-[#D8CFBE] bg-white text-sm font-black text-[#626A5E] active:bg-[#ECE5D8]`,"aria-label":`Close drawer`,children:c.close})]}),(0,i.jsxs)(`div`,{className:`mt-4 flex-1 overflow-y-auto space-y-4 pr-1`,children:[(0,i.jsxs)(`div`,{className:`rounded-3xl border border-[#D8CFBE] bg-white p-4`,children:[(0,i.jsx)(`span`,{className:`text-[10px] font-black uppercase tracking-wide text-[#626A5E]`,children:c.historyDrawerPr}),(0,i.jsxs)(`div`,{className:`mt-2 grid grid-cols-2 gap-3`,children:[(0,i.jsx)(n,{label:c.bestLoad,value:m}),(0,i.jsx)(n,{label:c.bestSets,value:p.bestSetCount||0})]}),p.bestLoadAt&&(0,i.jsxs)(`p`,{className:`mt-2 text-right text-[10px] font-bold text-[#8D9387]`,children:[`Achieved: `,new Date(p.bestLoadAt).toLocaleDateString()]})]}),(0,i.jsxs)(`div`,{children:[(0,i.jsx)(`h4`,{className:`mb-2 text-xs font-black uppercase tracking-wide text-[#626A5E]`,children:c.historyDrawerRecent}),f.length===0?(0,i.jsx)(`div`,{className:`rounded-3xl border border-dashed border-[#D8CFBE] bg-white/40 p-8 text-center`,children:(0,i.jsx)(`p`,{className:`text-sm font-bold text-[#8D9387]`,children:c.historyDrawerEmpty})}):(0,i.jsx)(`div`,{className:`space-y-2`,children:f.slice().reverse().map((e,t)=>(0,i.jsxs)(`div`,{className:`rounded-2xl border border-[#D8CFBE] bg-white p-3 space-y-2`,children:[(0,i.jsxs)(`div`,{className:`flex items-center justify-between`,children:[(0,i.jsx)(`span`,{className:`text-xs font-black text-[#171915]`,children:e.date}),(0,i.jsxs)(`span`,{className:`rounded-full bg-[#EAF1EA] px-2.5 py-0.5 text-[10px] font-black text-[#17352D]`,children:[e.completedSets,`/`,e.totalSets,` sets`]})]}),(0,i.jsxs)(`div`,{className:`grid grid-cols-2 gap-2 text-xs font-semibold text-[#626A5E]`,children:[e.weight&&(0,i.jsxs)(`div`,{children:[(0,i.jsx)(`span`,{className:`font-bold`,children:`Weight:`}),` `,(0,i.jsx)(`strong`,{className:`text-[#171915] font-black`,children:e.weight})]}),e.rpe&&(0,i.jsxs)(`div`,{children:[(0,i.jsx)(`span`,{className:`font-bold`,children:`RPE:`}),` `,(0,i.jsx)(`strong`,{className:`text-[#171915] font-black`,children:e.rpe})]})]}),e.note&&(0,i.jsx)(`div`,{className:`rounded-xl bg-[#ECE5D8]/50 p-2 text-xs font-medium text-[#31362F] leading-relaxed italic`,children:e.note})]},t))})]})]})]})})]})};export{a as HistoryDrawer};