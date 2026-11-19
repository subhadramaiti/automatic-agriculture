// ---------- DATASET: hand-listed food crops ----------
// base = typical crop water need (mm/day) at 25 °C, 50% humidity, 2 m/s wind, mid-season
const CROPS = [
 {id:"rice",  name:"Rice",   icon:"🌾", base:8.0, stage:"Needs standing water 5 cm", tip:"Keep fields flooded; irrigate in the early morning."},
 {id:"corn",  name:"Corn",   icon:"🌽", base:5.5, stage:"Most thirsty at tasselling",   tip:"Deep, less frequent watering encourages deeper roots."},
 {id:"grapes",name:"Grapes", icon:"🍇", base:4.0, stage:"Cut water near ripening",      tip:"Use drip irrigation; avoid wetting the leaves."},
 {id:"potato",name:"Potato", icon:"🥔", base:4.8, stage:"Keep soil evenly moist",       tip:"Irregular watering causes cracked or hollow tubers."},
 {id:"olive", name:"Olive",  icon:"🫒", base:3.0, stage:"Drought tolerant",             tip:"Water deeply but rarely; roots rot in soggy soil."},
 {id:"tomato",name:"Tomato", icon:"🍅", base:5.0, stage:"Steady moisture at fruiting",  tip:"Water at the base, never from above, to prevent blight."},
 {id:"wheat", name:"Wheat",  icon:"🌿", base:4.5, stage:"Critical at flowering",        tip:"Irrigate at crown-root and grain-filling stages."},
 {id:"cane",  name:"Sugarcane",icon:"🎋",base:7.0,stage:"High demand all season",       tip:"Furrow irrigation works well; mulch to save water."},
 {id:"banana",name:"Banana", icon:"🍌", base:6.5, stage:"Shallow roots, frequent water",tip:"Mulch heavily and water little and often."},
 {id:"onion", name:"Onion",  icon:"🧅", base:3.8, stage:"Stop watering before harvest", tip:"Shallow roots: light and frequent irrigation."}
];
const LOCS = [
 {n:"Chianti Hills",t:16,h:59,w:6,r:0},{n:"Yelahanka, Karnataka",t:28,h:65,w:3,r:0},
 {n:"Punjab Plains",t:35,h:35,w:4,r:0},{n:"Kerala Coast",t:29,h:85,w:2,r:14},{n:"Rajasthan Dry Zone",t:40,h:20,w:7,r:0}
];
const FIELDS = [{n:"Olive Field",c:"olive",a:2.5,p:"Chianti Hills"},{n:"Rice Paddy",c:"rice",a:1.2,p:"Kerala Coast"},{n:"Corn Block",c:"corn",a:3,p:"Punjab Plains"}];

// ---------- WATER MODEL ----------
function waterNeed(crop, W, stageK){
  const fT = 1 + 0.04*(W.t-25);          // hotter = more water
  const fH = 1 + (50-W.h)/200;           // drier air = more water
  const fW = 1 + 0.03*(W.w-2);           // wind dries soil
  const gross = Math.max(0, crop.base*stageK*fT*fH*fW);   // mm/day lost
  const rainUse = W.r*0.8;                                // 80% of rain is useful
  const net = Math.max(0, gross-rainUse);
  return {gross, net, rainUse};
}

const $ = id => document.getElementById(id);
const W = {t:22,h:59,w:6,r:0};
let sel = null, stageK = 1, area = 1;

$("date").textContent = new Date().toLocaleDateString("en-GB",{weekday:"long",day:"2-digit",month:"short",year:"numeric"});
$("loc").innerHTML = LOCS.map((l,i)=>`<option value="${i}">📍 ${l.n}</option>`).join("");

function renderCrops(filter=""){
  const f = filter.toLowerCase();
  $("crops").innerHTML = CROPS.filter(c=>c.name.toLowerCase().includes(f)).map(c=>
   `<button class="crop ${sel&&sel.id===c.id?"on":""}" data-id="${c.id}"><span>${c.icon}</span>${c.name}</button>`).join("") || '<div class="empty">No crop found</div>';
}
function renderFields(){
  $("fields").innerHTML = FIELDS.map((f,i)=>{const c=CROPS.find(x=>x.id===f.c);
   return `<div class="field" data-f="${i}" tabindex="0"><div class="img"></div><div class="t"><div><b>${f.n}</b><br><small>${f.p} · ${f.a} ha</small></div><span style="font-size:28px">${c.icon}</span></div></div>`}).join("");
}
function syncWeather(){
  $("sT").textContent=W.t+" °C";$("sH").textContent=W.h+"%";$("sW").textContent=W.w+" m/s";$("sR").textContent=W.r+" mm";
  $("tNow").textContent=(W.t>=0?"+":"")+W.t+"°C";
  $("oT").textContent=W.t+"°C";$("oH").textContent=W.h+"%";$("oW").textContent=W.w+" m/s";$("oR").textContent=W.r+" mm";
  ["temp","hum","wind","rain"].forEach((k,i)=>$(k).value=[W.t,W.h,W.w,W.r][i]);
  renderPanel();
}
function renderPanel(){
  if(!sel) return;
  const r = waterNeed(sel,W,stageK);
  const L = r.net*10000*area;                   // 1 mm over 1 ha = 10,000 L
  const pct = Math.min(100, r.net/12*100); needL = Math.round(L);
  const level = r.net<=0.3 ? "No irrigation needed today — rainfall covers the crop." :
                r.net<3 ? "Light watering needed." : r.net<6 ? "Moderate watering needed." : "Heavy watering needed — crop is under high demand.";
  let extra = "";
  if(W.t>=35) extra += " 🔥 Heat alert: irrigate before 8 AM or after 6 PM.";
  if(W.w>=10) extra += " 💨 Strong wind: prefer drip over sprinkler.";
  if(W.r>=10) extra += " 🌧️ Heavy rain: skip the next irrigation cycle.";
  if(W.h<30) extra += " 🏜️ Very dry air: check soil moisture twice a day.";
  $("panel").innerHTML = `
   <div class="big">${sel.icon}</div><h3>${sel.name} Water Plan</h3><div class="sub">${sel.stage}</div>
   <div class="gauge" style="--p:${pct}"><div><span><b>${r.net.toFixed(1)}</b><small>mm / day</small></span></div></div>
   <div class="grid2">
    <div class="box"><b>${Math.round(L).toLocaleString()} L</b>per day for ${area} ha</div>
    <div class="box"><b>${Math.round(L*7).toLocaleString()} L</b>per week</div>
    <div class="box"><b>${r.gross.toFixed(1)} mm</b>total crop demand</div>
    <div class="box"><b>${r.rainUse.toFixed(1)} mm</b>covered by rain</div>
   </div>
   <div class="ctl">
    <label>Growth stage<select id="stg"><option value="0.6">Seedling (×0.6)</option><option value="1" selected>Mid-season (×1.0)</option><option value="0.8">Harvest stage (×0.8)</option></select></label>
    <label>Field size (ha)<input type="number" id="ar" min="0.1" step="0.1" value="${area}"></label>
   </div>
   <div class="tip"><b>${level}</b>${extra}<br>💡 ${sel.tip}</div>
   <div class="sub" style="margin-top:10px">Weather: ${LOCS[$("loc").value].n} · ${W.t}°C · ${W.h}% humidity · ${W.w} m/s wind · ${W.r} mm rain</div>`;
  $("stg").value = stageK; syncTarget();
  $("stg").onchange = e=>{stageK=+e.target.value;renderPanel()};
  $("ar").oninput = e=>{area=Math.max(0.1,+e.target.value||1);const p=$("ar");const pos=p.selectionStart;renderPanel();$("ar").focus();};
}
function pick(id){
  sel = CROPS.find(c=>c.id===id); renderCrops($("q").value); renderPanel();
  if(innerWidth<860) $("result").scrollIntoView({behavior:"smooth"});
}

// ---------- EVENTS ----------
$("crops").addEventListener("click",e=>{const b=e.target.closest(".crop");if(b)pick(b.dataset.id)});
$("fields").addEventListener("click",e=>{const f=e.target.closest(".field");if(!f)return;const d=FIELDS[f.dataset.f];
  const li=LOCS.findIndex(l=>l.n===d.p);$("loc").value=li;Object.assign(W,{t:LOCS[li].t,h:LOCS[li].h,w:LOCS[li].w,r:LOCS[li].r});area=d.a;syncWeather();pick(d.c)});
$("q").addEventListener("input",e=>renderCrops(e.target.value));
$("loc").addEventListener("change",e=>{const l=LOCS[e.target.value];Object.assign(W,{t:l.t,h:l.h,w:l.w,r:l.r});syncWeather()});
[["temp","t"],["hum","h"],["wind","w"],["rain","r"]].forEach(([id,k])=>$(id).addEventListener("input",e=>{W[k]=+e.target.value;syncWeather()}));
$("refresh").addEventListener("click",()=>{Object.assign(W,{t:Math.round(10+Math.random()*30),h:Math.round(25+Math.random()*70),w:Math.round(Math.random()*12),r:Math.random()<.4?Math.round(Math.random()*20):0});syncWeather()});
document.querySelectorAll(".nav button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".nav button").forEach(x=>x.classList.remove("on"));b.classList.add("on");
  const t=b.dataset.go==="top"?document.querySelector(".hero"):document.querySelector("."+b.dataset.go)||$(b.dataset.go);t.scrollIntoView({behavior:"smooth"})}));

// ---------- PUMP CONTROLLER ----------
let needL = 0;
const P = {on:false, got:0, tgt:0, t:null, manual:false};
function log(m){const l=$("plog");l.textContent=new Date().toLocaleTimeString()+"  "+m+"\n"+l.textContent}
function syncTarget(){ if(!P.on && !P.manual) $("tgt").value = needL||""; renderPlan(); }
function draw(){
  const pc = P.tgt ? Math.min(100,P.got/P.tgt*100) : 0;
  $("bar").style.width = pc+"%"; $("got").textContent = P.got.toFixed(1)+" / "+P.tgt+" L delivered";
  const led=$("led"); led.textContent = P.on?"PUMP ON":"PUMP OFF"; led.className = "led"+(P.on?" on":"");
  $("go").disabled = P.on; $("halt").disabled = !P.on;
}
async function esp(path){ const r = await fetch("http://"+$("ip").value.trim()+path); return r.json(); }
async function startPump(){
  P.tgt = Math.round(+$("tgt").value);
  if(!(P.tgt>0)){ log("Tap a crop first or enter target litres."); return; }
  P.got = 0; P.on = true; draw(); log("Pump START – target "+P.tgt+" L");
  if($("mode").value==="esp"){
    try{ await esp("/start?litres="+P.tgt); }
    catch(e){ P.on=false; draw(); log("ESP32 not reachable. Open this file locally (not the https link) on the same Wi-Fi."); return; }
    P.t = setInterval(async()=>{
      try{ const s = await esp("/status"); P.got = s.litres; draw();
           if(!s.running || P.got>=P.tgt) stopPump("Target reached – relay OFF"); }
      catch(e){ log("Lost link to ESP32"); }
    },500);
  } else {
    const rate = +$("rate").value || 30;
    P.t = setInterval(()=>{
      P.got += rate/60*0.1*60;                       // litres per 100 ms, ×60 demo speed
      if(P.got>=P.tgt){ P.got=P.tgt; stopPump("Target reached – pump stopped automatically"); }
      draw();
    },100);
  }
}
async function stopPump(msg){
  if(!P.on) return; clearInterval(P.t); P.on=false;
  if($("mode").value==="esp"){ try{ await esp("/stop"); }catch(e){} }
  draw(); log(msg||"Pump stopped manually");
}
// ---------- AUTO (AI) MODE ----------
const COORD = [[43.47,11.25],[13.10,77.59],[30.90,75.85],[10.0,76.3],[26.9,70.9]];
let AUTO = false, autoTimer = null;
function aiDecide(){
  if(!sel) return null;
  const r = waterNeed(sel,W,stageK); let L = r.net*10000*area; const why = [];
  why.push(`Weather: ${W.t}°C, ${W.h}% humidity, ${W.w} m/s wind, ${W.r} mm rain.`);
  if(W.r>=10) return {skip:true, why:[...why,"🌧️ Heavy rain – soil gets enough water, so I skip irrigation today."]};
  if(r.net<0.3) return {skip:true, why:[...why,"Cool weather / rain already covers the crop – skip today."]};
  if(W.h>85){ L*=0.9; why.push("💧 Very humid air – water cut by 10% to avoid fungal disease."); }
  let cycles = [{time:$("atime").value, L:Math.round(L)}];
  if(W.t>=35){ cycles=[{time:$("atime").value,L:Math.round(L/2)},{time:"18:00",L:Math.round(L/2)}]; why.push("🔥 Hot day – split into morning and evening to cut evaporation."); }
  if(W.w>=10) why.push("💨 Windy – drip irrigation recommended.");
  return {skip:false, cycles, why};
}
function renderPlan(){
  const d = aiDecide(), el = $("plan"); if(!el) return;
  if(!d){ el.textContent="Tap a crop to see the AI plan."; return; }
  el.innerHTML = `<b>${sel.icon} ${sel.name} – AI decision for today</b><br>` +
    (d.skip ? "⏸️ No irrigation today." : d.cycles.map(c=>`⏰ ${c.time} → ${c.L.toLocaleString()} L`).join("<br>")) +
    "<br><small>" + d.why.join("<br>") + "</small>";
}
function setTab(m){
  const a = m==="auto";
  $("tabA").classList.toggle("on",a); $("tabM").classList.toggle("on",!a);
  $("autoBox").hidden = !a; $("tgtLbl").hidden = a; $("use").hidden = a; renderPlan();
}
$("tabM").onclick = ()=>setTab("manual"); $("tabA").onclick = ()=>setTab("auto");
$("atime").oninput = renderPlan;
function autoRunToday(){
  const d = aiDecide(); if(!d) return;
  d.why.forEach(w=>log("AI: "+w.replace(/<[^>]*>/g,"")));
  if(d.skip){ log("AI: skipped today."); return; }
  if(P.on) return;
  $("tgt").value = d.cycles[0].L; P.manual = true; startPump();
  if(d.cycles[1]) log("AI: second cycle scheduled "+d.cycles[1].time+" ("+d.cycles[1].L+" L)");
}
async function toggleAuto(){
  const btn = $("autoBtn");
  if(AUTO){
    AUTO=false; clearInterval(autoTimer);
    if($("mode").value==="esp"){ try{ await esp("/auto?on=0"); }catch(e){} }
    btn.textContent="🤖 Enable Auto – one click"; log("Auto mode OFF"); return;
  }
  if(!sel){ log("Tap a crop first so the AI knows what to water."); return; }
  if($("mode").value==="esp"){
    const [lat,lon] = COORD[$("loc").value]; const [h,m] = $("atime").value.split(":");
    try{
      await esp(`/auto?on=1&base=${sel.base}&k=${stageK}&area=${area}&lat=${lat}&lon=${lon}&hour=${+h}&min=${+m}`);
      log("Auto saved in ESP32. It will read the weather and water by itself daily at "+$("atime").value+". You can close this app.");
    }catch(e){ log("ESP32 not reachable – open this file locally on the same Wi-Fi once to switch Auto on."); return; }
    AUTO=true;
  } else {
    AUTO=true; log("Auto (demo): 1 simulated day = 20 s, weather changes every day.");
    autoRunToday();
    autoTimer = setInterval(()=>{ $("refresh").click(); autoRunToday(); }, 20000);
  }
  btn.textContent="⏹ Disable Auto";
}
$("autoBtn").onclick = toggleAuto;

$("go").onclick = startPump; $("halt").onclick = ()=>stopPump();
$("tgt").oninput = ()=>{P.manual=true};
$("use").onclick = ()=>{P.manual=false; syncTarget()};
draw();

Object.assign(W,LOCS[0]); $("loc").value=0;
renderCrops(); renderFields(); syncWeather();