// Scoped styles for the Research Library. Uses the app's theme variables so it
// follows light/dark automatically. Report A = brand green, Report B = blue.
export const RESEARCH_CSS = `
.rl{--rl-a:var(--blue);--rl-b:#3b82d6;--rl-a-bg:var(--green-bg);--rl-b-bg:rgba(59,130,214,.14);display:flex;flex-direction:column;gap:18px;font-size:14px;color:var(--ink)}
.rl *{box-sizing:border-box}
.rl h2,.rl h3,.rl h4,.rl p{margin:0}
.rl-pad{padding:20px 22px}
.rl-sec-title{font-size:15px;font-weight:700;letter-spacing:-.01em}
.rl-sub{color:var(--muted);font-size:13px;line-height:1.55}
.rl-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.rl-spread{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.rl-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s,transform .05s}
.rl-btn:hover:not(:disabled){background:var(--btn-hover)}
.rl-btn:active:not(:disabled){transform:translateY(1px)}
.rl-btn:disabled{opacity:.55;cursor:not-allowed}
.rl-btn.primary{background:var(--blue);border-color:var(--blue);color:#fff}
.rl-btn.primary:hover:not(:disabled){background:var(--blue-dk);border-color:var(--blue-dk)}
.rl-btn.danger{color:var(--red)}
.rl-btn.ghost{border-color:transparent;background:transparent;padding:7px 10px}
.rl-btn:focus-visible,.rl-drop:focus-visible,.rl-item:focus-visible,.rl-tab:focus-visible,.rl-chip:focus-visible,.rl-ta:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
.rl-banner{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:9px;font-size:13px;line-height:1.5;border:1px solid}
.rl-banner.warn{background:var(--amber-bg);border-color:var(--amber);color:var(--ink)}
.rl-banner.err{background:var(--red-bg);border-color:var(--red);color:var(--ink)}
.rl-tag{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700;letter-spacing:.02em}
.rl-tag.a{background:var(--rl-a-bg);color:var(--green)}
.rl-tag.b{background:var(--rl-b-bg);color:#5b9ee8}

/* upload */
.rl-drops{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width:760px){.rl-drops{grid-template-columns:1fr}}
.rl-drop{position:relative;border:1.5px dashed var(--line);border-radius:12px;padding:26px 18px;text-align:center;cursor:pointer;background:var(--card-2);transition:border-color .15s,background .15s;min-height:158px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
.rl-drop:hover,.rl-drop.over{border-color:var(--blue);background:var(--green-bg)}
.rl-drop.b:hover,.rl-drop.b.over{border-color:var(--rl-b);background:var(--rl-b-bg)}
.rl-drop.has{border-style:solid;align-items:stretch;text-align:left;justify-content:center;cursor:default}
.rl-drop input{display:none}
.rl-dz-ic{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--card);border:1px solid var(--line);color:var(--muted)}
.rl-file{display:flex;align-items:center;gap:12px}
.rl-file-ic{width:42px;height:52px;border-radius:6px;background:var(--card);border:1px solid var(--line);display:grid;place-items:center;font-size:10px;font-weight:800;color:var(--red);flex:none}
.rl-file-name{font-weight:600;word-break:break-word;line-height:1.35}
.rl-ta{width:100%;resize:vertical;min-height:44px;padding:10px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card-2);color:var(--ink);font:inherit;font-size:14px;line-height:1.5}
.rl-ta::placeholder{color:var(--muted)}

/* library */
.rl-list{display:flex;flex-direction:column}
.rl-item{display:flex;gap:14px;align-items:flex-start;padding:16px 20px;border-top:1px solid var(--line-soft);cursor:pointer;transition:background .12s;text-align:left;width:100%;background:transparent;border-left:0;border-right:0;border-bottom:0;color:inherit;font:inherit}
.rl-item:first-child{border-top:0}
.rl-item:hover{background:var(--row-hover)}
.rl-item-title{font-weight:700;font-size:14.5px;line-height:1.35}
.rl-item-head{color:var(--ink-2);font-size:13px;line-height:1.5;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rl-meta{display:flex;gap:6px 14px;flex-wrap:wrap;margin-top:8px;color:var(--muted);font-size:12px}
.rl-meta span{display:inline-flex;align-items:center;gap:5px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rl-status{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap}
.rl-status.complete{background:var(--green-bg);color:var(--green)}
.rl-status.processing{background:var(--amber-bg);color:var(--amber)}
.rl-status.failed{background:var(--red-bg);color:var(--red)}
.rl-mini{height:5px;border-radius:5px;background:var(--line);overflow:hidden;margin-top:8px;max-width:260px}
.rl-mini i{display:block;height:100%;background:var(--blue);transition:width .4s}
.rl-empty{padding:42px 20px;text-align:center;color:var(--muted);line-height:1.6}

/* tabs */
.rl-tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);padding:4px 14px 0;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}
.rl-tab{padding:16px 15px 17px;border:0;background:transparent;color:var(--muted);font:inherit;font-size:14px;font-weight:600;cursor:pointer;box-shadow:inset 0 -2px 0 transparent;white-space:nowrap;flex:none}
.rl-tab:hover{color:var(--ink)}
.rl-tab.on{color:var(--ink);box-shadow:inset 0 -2px 0 var(--blue)}
.rl-tab small{color:var(--muted);font-weight:600;margin-left:5px}

/* results */
.rl-grid{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:18px;align-items:start}
@media (max-width:1180px){.rl-grid{grid-template-columns:1fr}}
.rl-headline{font-size:20px;font-weight:700;line-height:1.4;letter-spacing:-.015em}
.rl-prose p{font-size:15px;line-height:1.7;color:var(--ink-2)}
.rl-prose p + p{margin-top:12px}
.rl-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width:760px){.rl-two{grid-template-columns:1fr}}
.rl-box{border:1px solid var(--line);border-radius:10px;padding:16px 18px;background:var(--card-2)}
.rl-box.a{border-top:3px solid var(--rl-a)}
.rl-box.b{border-top:3px solid var(--rl-b)}
.rl-list-ul{margin:10px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:7px;font-size:14px;line-height:1.55;color:var(--ink-2)}
.rl-label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.rl-diff{border:1px solid var(--line);border-radius:10px;overflow:hidden}
.rl-diff + .rl-diff{margin-top:12px}
.rl-diff-h{padding:11px 16px;background:var(--card-2);font-weight:700;border-bottom:1px solid var(--line)}
.rl-diff-cols{display:grid;grid-template-columns:1fr 1fr}
@media (max-width:760px){.rl-diff-cols{grid-template-columns:1fr}}
.rl-diff-col{padding:13px 16px;font-size:14px;line-height:1.55;color:var(--ink-2)}
.rl-diff-col + .rl-diff-col{border-left:1px solid var(--line-soft)}
@media (max-width:760px){.rl-diff-col + .rl-diff-col{border-left:0;border-top:1px solid var(--line-soft)}}
.rl-diff-ins{padding:11px 16px;border-top:1px solid var(--line-soft);font-size:13.5px;line-height:1.55;color:var(--ink);background:var(--card)}
.rl-table{width:100%;border-collapse:collapse;font-size:14px}
.rl-table th{text-align:left;padding:11px 14px;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line);background:var(--card-2);position:sticky;top:0}
.rl-table td{padding:12px 14px;border-bottom:1px solid var(--line-soft);vertical-align:top;line-height:1.5}
.rl-table tr:last-child td{border-bottom:0}
.rl-table td.m{font-weight:600;min-width:130px}
.rl-table td.note{color:var(--muted);font-size:12.5px}
.rl-scroll{overflow-x:auto}
.rl-comp{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px}
.rl-comp.high{background:var(--green-bg);color:var(--green)}
.rl-comp.medium{background:var(--amber-bg);color:var(--amber)}
.rl-comp.low{background:var(--red-bg);color:var(--red)}
.rl-kf{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-top:10px}
.rl-kf div{border:1px solid var(--line);border-radius:9px;padding:10px 12px;background:var(--card)}
.rl-kf b{display:block;font-size:16px;margin-top:3px}
.rl-kf span{font-size:11.5px;color:var(--muted);line-height:1.4;display:block}
.rl-themes{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.rl-theme{font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--line);color:var(--ink-2)}

/* ask panel */
.rl-ask{position:sticky;top:14px;display:flex;flex-direction:column;max-height:calc(100vh - 40px);min-height:420px}
@media (max-width:1180px){.rl-ask{position:static;max-height:none}}
.rl-ask-head{padding:16px 18px;border-bottom:1px solid var(--line)}
.rl-msgs{flex:1;overflow-y:auto;padding:16px 16px 6px;display:flex;flex-direction:column;gap:14px;min-height:200px;max-height:560px}
.rl-msg{max-width:92%;font-size:14px;line-height:1.6}
.rl-msg.user{align-self:flex-end;background:var(--blue);color:#fff;padding:9px 13px;border-radius:14px 14px 3px 14px;white-space:pre-wrap;word-break:break-word}
.rl-msg.assistant{align-self:flex-start;background:var(--card-2);border:1px solid var(--line);padding:11px 14px;border-radius:14px 14px 14px 3px;color:var(--ink)}
.rl-msg .md p + p,.rl-msg .md p + ul,.rl-msg .md ul + p,.rl-msg .md p + ol,.rl-msg .md ol + p{margin-top:8px}
.rl-msg .md ul,.rl-msg .md ol{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px}
.rl-msg .md code{background:var(--line-soft);padding:1px 5px;border-radius:4px;font-size:12.5px}
.rl-src{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px;align-items:center}
.rl-src small{color:var(--muted);font-size:11px;margin-right:2px}
.rl-time{font-size:10.5px;color:var(--muted);margin-top:5px}
.rl-user-time{align-self:flex-end}
.rl-chip{display:inline-flex;text-align:left;padding:8px 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink-2);font:inherit;font-size:12.5px;line-height:1.4;cursor:pointer;transition:border-color .15s,background .15s}
.rl-chip:hover:not(:disabled){border-color:var(--blue);background:var(--green-bg)}
.rl-sugg{display:flex;flex-direction:column;gap:8px;padding:2px 0 6px}
.rl-compose{display:flex;gap:8px;padding:12px 14px;border-top:1px solid var(--line);align-items:flex-end}
.rl-dots{display:inline-flex;gap:4px;padding:4px 2px}
.rl-dots i{width:7px;height:7px;border-radius:50%;background:var(--muted);animation:rl-bounce 1.1s infinite ease-in-out}
.rl-dots i:nth-child(2){animation-delay:.15s}.rl-dots i:nth-child(3){animation-delay:.3s}

/* loader */
.rl-load{display:flex;flex-direction:column;align-items:center;padding:34px 22px 30px;text-align:center}
.rl-scene{width:100%;max-width:560px}
.rl-scene svg{width:100%;height:auto;overflow:visible}
.rl-doc-body{fill:var(--card);stroke:var(--line);stroke-width:1.5}
.rl-doc-line{stroke:var(--line);stroke-width:3;stroke-linecap:round}
.rl-doc.a .rl-doc-top{fill:var(--rl-a)}
.rl-doc.b .rl-doc-top{fill:var(--rl-b)}
.rl-doc.busy .rl-doc-line{animation:rl-pulse 1.4s ease-in-out infinite}
.rl-doc.busy .rl-doc-line:nth-child(odd){animation-delay:.25s}
.rl-scan{animation:rl-scan 1.8s ease-in-out infinite alternate}
.rl-doc.a .rl-scan{fill:var(--rl-a)}
.rl-doc.b .rl-scan{fill:var(--rl-b)}
.rl-beam{fill:none;stroke-width:2;stroke-dasharray:5 7;stroke-linecap:round;animation:rl-dash 1.1s linear infinite}
.rl-beam.a{stroke:var(--rl-a)}.rl-beam.b{stroke:var(--rl-b)}
.rl-node{fill:var(--card);stroke:var(--line);stroke-width:1.5}
.rl-node-ring{fill:none;stroke:var(--blue);stroke-width:2.5;stroke-linecap:round;stroke-dasharray:60 200;transform-origin:280px 82px;animation:rl-spin 1.5s linear infinite}
.rl-load-title{font-size:18px;font-weight:700;margin-top:6px}
.rl-load-msg{color:var(--muted);margin-top:6px;min-height:20px;animation:rl-fade .4s ease both}
.rl-bar{width:100%;max-width:560px;height:8px;border-radius:99px;background:var(--line);overflow:hidden;margin-top:20px;position:relative}
.rl-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--blue),var(--blue-dk));transition:width .5s ease;position:relative;overflow:hidden}
.rl-bar i:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);animation:rl-shimmer 1.6s infinite}
.rl-steps{width:100%;max-width:560px;margin-top:22px;display:flex;flex-direction:column;gap:2px;text-align:left}
.rl-step{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:9px;font-size:13.5px;color:var(--muted);transition:background .2s,color .2s}
.rl-step.active{background:var(--card-2);color:var(--ink);font-weight:600}
.rl-step.done{color:var(--ink-2)}
.rl-step.err{color:var(--red)}
.rl-step-ic{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;flex:none;border:1.5px solid var(--line);background:var(--card)}
.rl-step.done .rl-step-ic{background:var(--blue);border-color:var(--blue);color:#fff}
.rl-step.err .rl-step-ic{border-color:var(--red);color:var(--red)}
.rl-step.active .rl-step-ic{border-color:var(--blue)}
.rl-spinner{width:11px;height:11px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--blue);animation:rl-spin 0.8s linear infinite}
.rl-step-t{flex:1}
.rl-step-s{font-size:12px;color:var(--muted);font-weight:500}
.rl-foot{margin-top:18px;font-size:12px;color:var(--muted)}

@keyframes rl-scan{from{transform:translateY(0)}to{transform:translateY(74px)}}
@keyframes rl-dash{to{stroke-dashoffset:-24}}
@keyframes rl-spin{to{transform:rotate(360deg)}}
@keyframes rl-pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes rl-shimmer{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
@keyframes rl-fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes rl-bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-4px);opacity:1}}
@media (prefers-reduced-motion:reduce){.rl *{animation:none!important;transition:none!important}}
`;
