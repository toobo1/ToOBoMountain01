(function (root) {
  'use strict';
  const events = new Set(['start_clicked','core_loaded','game_entered','tutorial_completed',
    'dungeon_entered','foundation_reached','foundation_existing','load_failed']);
  const key = 'tuboshan_funnel_v1';
  let state = {consent:false, player:null, queue:[], seen:[]}, sending = false;
  try { const saved = JSON.parse(localStorage.getItem(key)); if (saved) state = {...state,...saved}; } catch (_) {}
  const save = () => { try { localStorage.setItem(key,JSON.stringify(state)); } catch (_) {} };
  const endpoint = () => {
    try { const u = new URL(root.GAME_FUNNEL_CONFIG?.endpoint); return u.protocol === 'https:' ? u.href : ''; } catch (_) { return ''; }
  };
  function consent(value) {
    state.consent = Boolean(value);
    if (!value) { state.queue=[]; state.player=null; state.seen=[]; }
    save(); flush();
  }
  function track(event) {
    if (!events.has(event) || !state.consent || !endpoint()) return;
    if (state.seen.includes(event)) return;
    if (event === 'foundation_existing' && state.seen.includes('foundation_reached')) return;
    if (state.queue.length >= 100) return;
    state.player ||= crypto.randomUUID();
    state.queue.push({event_id:crypto.randomUUID(),player_id:state.player,event,
      build:String(root.GAME_BUILD || 'unknown').slice(0,40),occurred_at:new Date().toISOString()});
    state.seen.push(event);
    save(); flush();
  }
  async function flush() {
    if (sending || !state.consent || !endpoint() || !state.queue.length) return;
    sending=true;
    const batch=state.queue.slice(0,20), controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    try {
      const response=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({events:batch}),credentials:'omit',signal:controller.signal,keepalive:true});
      if (response.ok) {
        const sent=new Set(batch.map(e=>e.event_id));
        state.queue=state.queue.filter(e=>!sent.has(e.event_id)); save();
      }
    } catch (_) {} finally { clearTimeout(timer); sending=false; }
  }
  function settings() {
    let dialog=document.getElementById('funnel-settings');
    if (!dialog) {
      dialog=document.createElement('dialog'); dialog.id='funnel-settings';
      dialog.style.cssText='max-width:320px;background:#10292b;color:#eeddb3;border:1px solid #c4a468;padding:24px';
      dialog.innerHTML='<h2>匿名遊玩統計</h2><p>同意後回報開始遊玩、教學完成、進入副本、突破築基及載入成敗；附隨機瀏覽器識別碼、版本與時間。不傳送姓名、完整存檔或裝置指紋。停用不影響遊戲；已送出的紀錄不會自動刪除。</p><label><input type="checkbox"> 同意匿名統計</label><p data-state></p><button>儲存並返回</button>';
      dialog.querySelector('button').onclick=()=>{consent(dialog.querySelector('input').checked);dialog.close();};
      document.body.appendChild(dialog);
    }
    dialog.querySelector('input').checked=state.consent;
    dialog.querySelector('[data-state]').textContent=endpoint()?'統計服務已設定。':'尚未設定統計服務，目前不傳送資料。';
    dialog.showModal();
  }
  root.GameFunnel={track,settings,consent,flush};
  root.addEventListener('online',flush);
  setInterval(flush,30000);
})(window);
