#!/bin/zsh
# $1 active tab (home|tx|budget|more)  $2 active ink  $3 active pill bg
A=$1; C=$2; P=$3
c(){ [ "$1" = "$A" ] && echo "$C" || echo "#A39A8D"; }
b(){ [ "$1" = "$A" ] && echo "$P" || echo "transparent"; }
cat <<NAV
  <div style="margin-top:auto;display:flex;align-items:center;gap:2px;padding:8px 10px 24px;background:#FFFFFF;border-top:1px solid #EDE8DE;box-shadow:0 -10px 30px -22px rgba(40,32,26,0.55)">
    <a href="#" style="flex:1;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:15px;background:$(b home);color:$(c home)">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.5"/></svg>
      <span style="font-size:10.5px;font-weight:600">Home</span>
    </a>
    <a href="#" style="flex:1;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:15px;background:$(b tx);color:$(c tx)">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13"/><path d="M14 5l3 3-3 3"/><path d="M20 16H7"/><path d="M10 13l-3 3 3 3"/></svg>
      <span style="font-size:10.5px;font-weight:600">Transactions</span>
    </a>
    <div style="flex:1;display:flex;justify-content:center">
      <button style="width:56px;height:56px;border-radius:999px;background:radial-gradient(120% 100% at 30% 10%, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0) 60%),linear-gradient(145deg,#17877A 0%,#0C5B52 100%);color:#FFFFFF;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px -6px rgba(15,107,96,0.55)">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
      </button>
    </div>
    <a href="#" style="flex:1;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:15px;background:$(b budget);color:$(c budget)">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v8.5h8.5"/></svg>
      <span style="font-size:10.5px;font-weight:600">Budget</span>
    </a>
    <a href="#" style="flex:1;min-height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:15px;background:$(b more);color:$(c more)">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/></svg>
      <span style="font-size:10.5px;font-weight:600">More</span>
    </a>
  </div>
NAV
