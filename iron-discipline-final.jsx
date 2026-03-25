import { useState, useEffect } from "react";

const BG="#0a0a0a",CARD="#111111",BORDER="#222222",ACCENT="#D97706",BLUE="#3B82F6",GREEN="#22c55e",TEXT="#e5e5e5",MUTED="#555555",FF="'Courier New', Courier, monospace";

const PROGRAMS={hypertrophy:[{id:1,name:"Upper Horizontal",tag:"BENCH · ROWS · PUSH/PULL",note:null,circuits:[{id:"d1_s1",label:"STRAIGHT SETS",color:ACCENT,sets:4,rest:"2:00 b/t sets",note:"RPE 8–9. Pick a weight you can control for all 10. 3-sec descent every rep. Volume is the goal this phase.",exercises:[{id:"bench_press",name:"Bench Press",repTarget:"8–10",score:true}]},{id:"d1_c1",label:"CIRCUIT — do all exercises back-to-back, then rest",color:"#7C3AED",sets:4,rest:"1:30 b/t rounds",note:"RPE 9. Row to your belly button — not your shoulder. Keep :10 between exercises to accumulate the pump.",exercises:[{id:"db_bent_row",name:"DB Bent Over Row",repTarget:"10–12"},{id:"db_bench",name:"DB Bench Press",repTarget:"10–12"}]},{id:"d1_c2",label:"CIRCUIT — do all exercises back-to-back, then rest",color:"#7C3AED",sets:3,rest:"1:30 b/t rounds",note:"RPE 9. Max reps dips — add weight if bodyweight is easy for 6+. Row immediately after to balance the push.",exercises:[{id:"bar_dips",name:"Bar Dips (add weight if easy)",repTarget:"Max (min 6)"},{id:"cable_row",name:"Cable or Band Row",repTarget:"12–16"}]},{id:"d1_core",label:"CORE FINISHER — CIRCUIT",color:GREEN,sets:3,rest:"1:00 b/t rounds",note:"RPE 8. Lower back FLAT on dead bugs. Hollow hold: squeeze glutes and abs simultaneously.",exercises:[{id:"d1_hollow",name:"Hollow Body Hold",repTarget:"0:45"},{id:"d1_deadbug",name:"Slow Dead Bugs",repTarget:"20 reps"},{id:"d1_plank",name:"Plank Hold",repTarget:"1:00"}]}]},{id:2,name:"Lower Hinge + Glutes",tag:"RDL · GLUTES · HINGE",note:"Glute and hinge dominant. Minimal quad stress so your runs stay intact.",circuits:[{id:"d2_s1",label:"STRAIGHT SETS",color:ACCENT,sets:4,rest:"2:00 b/t sets",note:"RPE 8–9. Feel the hamstring stretch at the bottom. Use straps so grip is not the limiter.",exercises:[{id:"rdl",name:"Romanian Deadlift",repTarget:"10–12",score:true}]},{id:"d2_c1",label:"CIRCUIT — do all exercises back-to-back, then rest",color:"#7C3AED",sets:3,rest:"1:30 b/t rounds",note:"RPE 9. Single leg RDL: slow and controlled. Glute bridge: squeeze and hold one beat at the top.",exercises:[{id:"sl_rdl",name:"Single Leg RDL",repTarget:"10/side"},{id:"glute_bridge",name:"KB or DB Glute Bridge",repTarget:"15–20"}]},{id:"d2_c2",label:"CIRCUIT — do all exercises back-to-back, then rest",color:"#7C3AED",sets:3,rest:"1:30 b/t rounds",note:"RPE 9. Forward lean on lunges loads the glute over the quad. 3-sec descent on hamstring curl.",exercises:[{id:"db_lunge",name:"DB Walking Lunges (slight forward lean)",repTarget:"16–20 steps"},{id:"ham_curl",name:"Hamstring Curl — Rower or Machine (30X0)",repTarget:"12–15"}]},{id:"d2_core",label:"CORE FINISHER — CIRCUIT",color:GREEN,sets:3,rest:"1:00 b/t rounds",note:"RPE 8. Straight legs on raises — kipping defeats the purpose. Ab wheel: only go as far as your lower back stays flat.",exercises:[{id:"d2_hang_raise",name:"Hanging Leg Raises (straight legs)",repTarget:"10–15"},{id:"d2_rev_crunch",name:"Reverse Crunch",repTarget:"15–20"},{id:"d2_ab_wheel",name:"Ab Wheel Rollout",repTarget:"10–12"}]}]},{id:3,name:"Upper Vertical + Arms",tag:"PULL-UPS · PRESS · ARMS",note:null,circuits:[{id:"d3_s1",label:"SUPERSET — alternate exercises each set, then rest",color:"#7C3AED",sets:4,rest:"1:00 b/t exercises · 2:00 b/t rounds",note:"RPE 9. Aim for 8–10 clean pull-ups. Add weight if bodyweight is easy for 10. Press should be equally hard.",exercises:[{id:"weighted_pullup",name:"Weighted Pull-Ups",repTarget:"8–10",score:true},{id:"strict_press",name:"Strict Press",repTarget:"8–10",score:true}]},{id:"d3_c1",label:"CIRCUIT — do all exercises back-to-back, then rest",color:"#7C3AED",sets:3,rest:"1:30 b/t rounds",note:"RPE 9. Arnold press hits the full delt. Lead elbows on laterals — not hands. Face pulls are not optional.",exercises:[{id:"arnold_press",name:"Arnold Press",repTarget:"10–12"},{id:"lateral_raise",name:"DB Lateral Raises",repTarget:"12–16"},{id:"band_pull_apart",name:"Band Pull-Aparts or Face Pulls",repTarget:"15–20"}]},{id:"d3_c2",label:"CIRCUIT — do all exercises back-to-back, then rest",color:"#7C3AED",sets:3,rest:"1:30 b/t rounds",note:"RPE 9. High reps for the pump. Squeeze at the top of every curl. Full extension on skull crushers.",exercises:[{id:"barbell_curl",name:"Barbell or DB Curl",repTarget:"12–15"},{id:"skull_crusher",name:"DB Skull Crushers",repTarget:"12–15"}]},{id:"d3_core",label:"CORE FINISHER — CIRCUIT",color:GREEN,sets:3,rest:"1:00 b/t rounds",note:"RPE 8. Toes all the way to the bar — full range only. Add a plate on your back for the plank if it feels easy.",exercises:[{id:"d3_ttb",name:"Strict Toes to Bar",repTarget:"10–15"},{id:"d3_weight_sit_up",name:"Weighted Sit-Up (plate at chest)",repTarget:"15–20"},{id:"d3_plank",name:"Weighted Plank (plate on back)",repTarget:"0:45"}]}]},{id:4,name:"Full Body Power",tag:"SQUAT · POWER · CONDITIONING",note:"Moderate squat load — runs take priority. Power complex is explosive. Full send on the finisher.",circuits:[{id:"d4_s1",label:"STRAIGHT SETS",color:ACCENT,sets:4,rest:"2:00 b/t sets",note:"RPE 8. Controlled descent, drive through the whole foot. Moderate load — protecting the legs for run week.",exercises:[{id:"front_squat",name:"Front Squat or Back Squat",repTarget:"8–10",score:true}]},{id:"d4_c1",label:"CIRCUIT — do all exercises back-to-back, then rest",color:"#7C3AED",sets:3,rest:"2:00 b/t rounds",note:"RPE 9. KB swings = hip drive, not arm lift. Push press: dip and drive. Box jumps: land soft, step down, reset.",exercises:[{id:"kb_swing",name:"Heavy KB Swings",repTarget:"12"},{id:"db_push_press",name:"DB Push Press",repTarget:"10–12"},{id:"box_jump",name:"Box Jumps (step down)",repTarget:"8"}]},{id:"d4_metcon",label:"CONDITIONING FINISHER — tap your option",color:"#DC2626",sets:1,rest:"as programmed",isMetcon:true,note:"Rotate A → B → C each week. All sub-15 minutes. Tap the one you completed.",exercises:[{id:"metcon_a",name:"5 rounds: 10 Pull-ups + 10 Dips + :30 rest"},{id:"metcon_b",name:"EMOM 10 min: Even = 12 KB Swings · Odd = 8 Push Press"},{id:"metcon_c",name:"3 rounds: 10 Pushups + 10 Inverted Rows + 10 Air Squats + :60 rest"}]},{id:"d4_core",label:"CORE FINISHER — CIRCUIT",color:GREEN,sets:3,rest:"1:00 b/t rounds",note:"RPE 8. V-ups: reach toes, not shins. Hollow hold: lower back glued to the floor.",exercises:[{id:"d4_vup",name:"V-Ups",repTarget:"15–20"},{id:"d4_hollow",name:"Hollow Body Hold",repTarget:"0:45"},{id:"d4_side_plank",name:"Side Plank Hold (each side)",repTarget:"0:45/side"}]}]}],strength:[{id:1,name:"Upper Horizontal",tag:"BENCH · ROWS · HEAVY PUSH/PULL",note:"Strength phase — fewer reps, heavier weight, longer rest. Build on your hypertrophy base.",circuits:[{id:"d1_s1",label:"STRAIGHT SETS — 5x5",color:ACCENT,sets:5,rest:"3:00 b/t sets",note:"RPE 9. True 5x5 — same heavy weight across all 5 sets. Complete all 5 clean? Add 5lb next session.",exercises:[{id:"bench_press",name:"Bench Press",repTarget:"5",score:true}]},{id:"d1_c1",label:"STRAIGHT SETS — heavy",color:ACCENT,sets:4,rest:"2:00 b/t sets",note:"RPE 9. Weighted dips — add as much weight as you can handle for 6 clean, full-ROM reps.",exercises:[{id:"bar_dips",name:"Weighted Bar Dips (heavy)",repTarget:"5–6",score:true}]},{id:"d1_c2",label:"SUPERSET — alternate exercises each set, then rest",color:"#7C3AED",sets:4,rest:"1:00 b/t exercises · 2:00 b/t rounds",note:"RPE 9. Heavy barbell row — brace core and row to your hip. Keep the incline press controlled.",exercises:[{id:"bb_bent_row",name:"Barbell Bent Over Row",repTarget:"5–6",score:true},{id:"incline_db_press",name:"Incline DB Press",repTarget:"6–8"}]},{id:"d1_core",label:"CORE FINISHER — CIRCUIT",color:GREEN,sets:3,rest:"1:00 b/t rounds",note:"RPE 8. Plank with a plate on your back. Dead bugs: slow, deliberate, lower back flat the whole time.",exercises:[{id:"d1_hollow",name:"Hollow Body Hold",repTarget:"1:00"},{id:"d1_deadbug",name:"Slow Dead Bugs",repTarget:"20 reps"},{id:"d1_plank",name:"Weighted Plank (plate on back)",repTarget:"1:00"}]}]},{id:2,name:"Lower Hinge + Glutes",tag:"DEADLIFT · GLUTES · HEAVY HINGE",note:"Strength phase — conventional deadlift replaces RDL as the anchor. Still glute-dominant.",circuits:[{id:"d2_s1",label:"STRAIGHT SETS — heavy",color:ACCENT,sets:4,rest:"3:00 b/t sets",note:"RPE 9. Big breath, full brace, pull. Control the descent every rep. Real posterior chain strength.",exercises:[{id:"deadlift",name:"Conventional Deadlift",repTarget:"3–5",score:true}]},{id:"d2_c1",label:"STRAIGHT SETS — heavy",color:ACCENT,sets:4,rest:"2:00 b/t sets",note:"RPE 9. Drive through the heel, squeeze at the top, hold one second. The glute king.",exercises:[{id:"hip_thrust",name:"Barbell or DB Hip Thrust",repTarget:"6–8",score:true}]},{id:"d2_c2",label:"SUPERSET — alternate exercises each set, then rest",color:"#7C3AED",sets:3,rest:"1:00 b/t exercises · 2:00 b/t rounds",note:"RPE 9. Split stance RDL loads one leg without the balance challenge. Heavy ham curl — 3-sec descent.",exercises:[{id:"sl_rdl",name:"Split Stance DB RDL (heavy)",repTarget:"6–8/side"},{id:"ham_curl",name:"Hamstring Curl — Rower or Machine (30X0)",repTarget:"8–10"}]},{id:"d2_core",label:"CORE FINISHER — CIRCUIT",color:GREEN,sets:3,rest:"1:00 b/t rounds",note:"RPE 8. Add load everywhere possible. Ab wheel: full extension only if lower back stays flat.",exercises:[{id:"d2_hang_raise",name:"Hanging Leg Raises (straight legs)",repTarget:"12–15"},{id:"d2_rev_crunch",name:"Weighted Reverse Crunch (hold plate)",repTarget:"12–15"},{id:"d2_ab_wheel",name:"Ab Wheel Rollout (full extension)",repTarget:"8–10"}]}]},{id:3,name:"Upper Vertical + Arms",tag:"PULL-UPS · PRESS · HEAVY ARMS",note:"Strength phase — heavier weights, fewer reps. Build vertical pressing and pulling strength.",circuits:[{id:"d3_s1",label:"SUPERSET — 5x5, alternate each set, then rest",color:"#7C3AED",sets:5,rest:"1:30 b/t exercises · 3:00 b/t rounds",note:"RPE 9. Heavy pull + heavy press. Add weight to pull-ups. Same load across all 5 sets. No failed reps.",exercises:[{id:"weighted_pullup",name:"Weighted Pull-Ups (heavy)",repTarget:"4–6",score:true},{id:"strict_press",name:"Strict Press (heavy)",repTarget:"4–6",score:true}]},{id:"d3_c1",label:"STRAIGHT SETS — heavy",color:ACCENT,sets:4,rest:"2:00 b/t sets",note:"RPE 9. Half-kneeling removes your ability to compensate with your lower body. Own the press.",exercises:[{id:"hk_press",name:"Half-Kneeling Single Arm DB Press",repTarget:"6–8/side",score:true}]},{id:"d3_c2",label:"CIRCUIT — do all exercises back-to-back, then rest",color:"#7C3AED",sets:3,rest:"1:30 b/t rounds",note:"RPE 9. Heavy enough on laterals that last 2–3 reps need a little cheat. Face pulls protect your shoulders.",exercises:[{id:"lateral_raise",name:"DB Lateral Raises",repTarget:"10–12"},{id:"band_pull_apart",name:"Band Pull-Aparts or Face Pulls",repTarget:"15–20"}]},{id:"d3_c3",label:"SUPERSET — heavy arms",color:"#7C3AED",sets:3,rest:"1:00 b/t exercises · 1:30 b/t rounds",note:"RPE 9. Heavier curl — fewer reps, more load. Full extension on skull crushers every rep.",exercises:[{id:"barbell_curl",name:"Barbell Curl (heavy)",repTarget:"6–8"},{id:"skull_crusher",name:"DB Skull Crushers (heavy)",repTarget:"6–8"}]},{id:"d3_core",label:"CORE FINISHER — CIRCUIT",color:GREEN,sets:3,rest:"1:00 b/t rounds",note:"RPE 8. Heavier plate on sit-ups. Plank: full tension head to heel for the full minute.",exercises:[{id:"d3_ttb",name:"Strict Toes to Bar",repTarget:"12–15"},{id:"d3_weight_sit_up",name:"Weighted Sit-Up (heavy plate)",repTarget:"12–15"},{id:"d3_plank",name:"Weighted Plank (heavy plate)",repTarget:"1:00"}]}]},{id:4,name:"Full Body Power",tag:"SQUAT · POWER · HEAVY CONDITIONING",note:"Strength phase — heavier squat and power complex. Still controlled — no wrecking legs before run week.",circuits:[{id:"d4_s1",label:"STRAIGHT SETS — heavy",color:ACCENT,sets:4,rest:"3:00 b/t sets",note:"RPE 9. Fewer reps, more load. No bouncing out of the hole. Controlled descent, drive hard out of the bottom.",exercises:[{id:"front_squat",name:"Front Squat or Back Squat",repTarget:"4–6",score:true}]},{id:"d4_c1",label:"CIRCUIT — do all exercises back-to-back, then rest",color:"#7C3AED",sets:4,rest:"2:00 b/t rounds",note:"RPE 9. Heavier KB swings — max hip snap. Heavier push press. Box jumps: focus on height and power.",exercises:[{id:"kb_swing",name:"Heavy KB Swings",repTarget:"8–10"},{id:"db_push_press",name:"DB Push Press (heavy)",repTarget:"6–8"},{id:"box_jump",name:"Box Jumps — max height",repTarget:"5–6"}]},{id:"d4_metcon",label:"CONDITIONING FINISHER — tap your option",color:"#DC2626",sets:1,rest:"as programmed",isMetcon:true,note:"Strength phase finishers — same formats, heavier loads. Tap the one you completed.",exercises:[{id:"metcon_a",name:"5 rounds: 8 Weighted Pull-ups + 8 Weighted Dips + :45 rest"},{id:"metcon_b",name:"EMOM 12 min: Even = 10 Heavy KB Swings · Odd = 6 Heavy Push Press"},{id:"metcon_c",name:"4 rounds: 8 Strict Pull-ups + 10 Ring Rows + 10 Pushups + :60 rest"}]},{id:"d4_core",label:"CORE FINISHER — CIRCUIT",color:GREEN,sets:3,rest:"1:00 b/t rounds",note:"RPE 8. Add load everywhere. Side plank: weight plate on your hip. Make it harder than hypertrophy phase.",exercises:[{id:"d4_vup",name:"Weighted V-Ups (plate at chest)",repTarget:"12–15"},{id:"d4_hollow",name:"Hollow Body Hold",repTarget:"1:00"},{id:"d4_side_plank",name:"Weighted Side Plank (each side)",repTarget:"0:45/side"}]}]}]};

function todayKey(){return new Date().toISOString().slice(0,10);}
function fmt(d){try{return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"});}catch{return d;}}

function allExercisesForPRs(){
  const seen=new Set(),out=[];
  ["hypertrophy","strength"].forEach(ph=>{
    PROGRAMS[ph].forEach(day=>{
      day.circuits.filter(c=>!c.isMetcon).forEach(c=>{
        c.exercises.forEach(ex=>{
          if(!seen.has(ex.id)){seen.add(ex.id);out.push({...ex,dayId:day.id,dayName:day.name});}
        });
      });
    });
  });
  return out;
}

async function storageSave(key,value){
  try{const r=await window.storage.set(key,value);if(r)return;throw new Error("null");}
  catch{try{localStorage.setItem(key,value);}catch{}}
}
async function storageLoad(key){
  try{const r=await window.storage.get(key);if(r&&r.value)return r.value;}catch{}
  try{return localStorage.getItem(key);}catch{}
  return null;
}

export default function IronDiscipline(){
  const [tab,setTab]=useState("workout");
  const [activeDay,setActiveDay]=useState(0);
  const [phase,setPhase]=useState("hypertrophy");
  const [sets,setSets]=useState({});
  const [metconSel,setMetconSel]=useState({});
  const [prs,setPrs]=useState({});
  const [history,setHistory]=useState([]);
  const [aiResponse,setAiResponse]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [saveMsg,setSaveMsg]=useState("");
  const [noteOpen,setNoteOpen]=useState({});
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{
    (async()=>{
      const prsRaw=await storageLoad("id_prs");
      if(prsRaw){try{setPrs(JSON.parse(prsRaw));}catch{}}
      const histRaw=await storageLoad("id_history");
      if(histRaw){try{setHistory(JSON.parse(histRaw));}catch{}}
      const todayRaw=await storageLoad("id_log:"+todayKey());
      if(todayRaw){try{const p=JSON.parse(todayRaw);if(p.sets)setSets(p.sets);if(p.metconSel)setMetconSel(p.metconSel);}catch{}}
      setLoaded(true);
    })();
  },[]);

  const day=PROGRAMS[phase][activeDay];
  const blank=()=>({weight:"",reps:"",done:false});

  function getRows(cId,exId,count){
    const k=cId+"__"+exId;
    return Array.from({length:count},(_,i)=>(sets[k]&&sets[k][i])?sets[k][i]:blank());
  }

  function updateSet(cId,exId,idx,field,val,total){
    const k=cId+"__"+exId;
    setSets(prev=>{
      const base=Array.from({length:total},(_,i)=>(prev[k]&&prev[k][i])?{...prev[k][i]}:blank());
      base[idx]={...base[idx],[field]:val};
      return{...prev,[k]:base};
    });
  }

  function toggleDone(cId,exId,idx,total){
    const k=cId+"__"+exId;
    setSets(prev=>{
      const base=Array.from({length:total},(_,i)=>(prev[k]&&prev[k][i])?{...prev[k][i]}:blank());
      base[idx]={...base[idx],done:!base[idx].done};
      return{...prev,[k]:base};
    });
  }

  async function saveWorkout(){
    const newPrs={...prs};
    Object.entries(sets).forEach(([k,rows])=>{
      const exId=k.split("__")[1];
      (rows||[]).forEach(r=>{
        const w=parseFloat(r.weight);
        if(!w)return;
        if(!newPrs[exId]||w>newPrs[exId].weight)newPrs[exId]={weight:w,date:todayKey()};
      });
    });
    const entry={date:todayKey(),dayIdx:activeDay,dayName:day.name,phase,sets,metconSel};
    const newHistory=[entry,...history.filter(h=>!(h.date===todayKey()&&h.dayIdx===activeDay))].slice(0,100);
    const todayLog=JSON.stringify({sets,metconSel});
    try{
      await storageSave("id_prs",JSON.stringify(newPrs));
      await storageSave("id_history",JSON.stringify(newHistory));
      await storageSave("id_log:"+todayKey(),todayLog);
      setPrs(newPrs);setHistory(newHistory);
      setSaveMsg("✓ SAVED");setTimeout(()=>setSaveMsg(""),2500);
    }catch(e){setSaveMsg("ERR: "+String(e?.message||e).slice(0,24));}
  }

  async function getCoaching(){
    setAiLoading(true);setAiResponse("");
    const lc=day.circuits.filter(c=>!c.isMetcon);
    const loggedLines=lc.flatMap(c=>c.exercises.map(ex=>{
      const rows=getRows(c.id,ex.id,c.sets);
      const detail=rows.map((r,i)=>"Set "+(i+1)+": "+(r.weight?r.weight+"lb":"no weight")+" x "+(r.reps||"??")).join(" | ");
      return ex.name+" (target "+ex.repTarget+"): "+detail;
    }));
    const prLines=lc.flatMap(c=>c.exercises.map(ex=>{
      const pr=prs[ex.id];
      return pr?ex.name+": PR = "+pr.weight+"lb ("+fmt(pr.date)+")":ex.name+": no PR";
    }));
    const sdh=history.filter(h=>h.dayIdx===activeDay&&h.phase===phase).slice(0,3);
    const histLines=sdh.length?sdh.map(h=>h.date+": "+lc.flatMap(c=>c.exercises.map(ex=>{
      const k=c.id+"__"+ex.id;
      const best=(h.sets[k]||[]).reduce((mx,r)=>Math.max(mx,parseFloat(r.weight)||0),0);
      return ex.name+" "+(best?best+"lb":"—");
    })).join(", ")).join("\n"):"No prior history for this day.";
    const prompt=["You are a direct S&C coach. Athlete: hybrid, 5+ runs/week, 4 lifting sessions. Iron Discipline program.","","TODAY: Day "+day.id+" — "+day.name+" ("+(phase==="hypertrophy"?"Wks 1-2 Hypertrophy":"Wks 3-4 Strength")+")","","LOGGED:",loggedLines.join("\n"),"","PRs:",prLines.join("\n"),"","HISTORY (last 3 same day):",histLines,"","Bullet points only. No preamble.","1. Each exercise: too light/appropriate/too heavy + exact lb recommendation for next session.","2. Flag rep drops >20% across sets.","3. Note any PRs hit today.","4. One-sentence session grade.","5. One specific goal for next session."].join("\n");
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      setAiResponse(data.content?.map(c=>c.text||"").join("")||"No response received.");
    }catch(e){setAiResponse("Could not reach AI: "+String(e?.message||e));}
    setAiLoading(false);
  }

  if(!loaded)return(<div style={{background:BG,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FF,color:MUTED,letterSpacing:3,fontSize:11}}>LOADING...</div>);

  return(
    <div style={{fontFamily:FF,background:BG,minHeight:"100vh",color:TEXT,maxWidth:600,margin:"0 auto"}}>

      {/* HEADER */}
      <div style={{background:"#0d0d0d",borderBottom:"1px solid "+BORDER,padding:"18px 14px 12px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:8,color:ACCENT,letterSpacing:3,marginBottom:3}}>IRON DISCIPLINE</div>
            <div style={{fontSize:20,fontWeight:900,letterSpacing:-0.5,lineHeight:1}}>WORKOUT TRACKER</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:9,color:MUTED}}>{new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>
            <div style={{fontSize:8,color:ACCENT,marginTop:3,letterSpacing:1}}>{phase==="hypertrophy"?"WK 1–2 · HYPERTROPHY":"WK 3–4 · STRENGTH"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginTop:12}}>
          {[["hypertrophy","WEEKS 1–2 · HYPERTROPHY"],["strength","WEEKS 3–4 · STRENGTH"]].map(([v,l])=>(
            <button key={v} onClick={()=>{setPhase(v);setAiResponse("");}} style={{flex:1,padding:"8px 4px",fontSize:9,fontWeight:900,letterSpacing:1,background:phase===v?ACCENT:"#1a1a1a",color:phase===v?"#000":MUTED,border:"none",cursor:"pointer",fontFamily:FF}}>{l}</button>
          ))}
        </div>
      </div>

      {/* NAV */}
      <div style={{display:"flex",borderBottom:"1px solid "+BORDER}}>
        {[["workout","WORKOUT"],["prs","PRs"],["log","HISTORY"]].map(([v,l])=>(
          <button key={v} onClick={()=>{setTab(v);setAiResponse("");}} style={{flex:1,padding:"10px 4px",fontSize:9,fontWeight:900,letterSpacing:2,background:tab===v?CARD:BG,color:tab===v?ACCENT:MUTED,border:"none",borderBottom:tab===v?"2px solid "+ACCENT:"2px solid transparent",cursor:"pointer",fontFamily:FF}}>{l}</button>
        ))}
      </div>

      <div style={{padding:"14px 12px 80px"}}>

        {/* WORKOUT TAB */}
        {tab==="workout"&&(
          <>
            <div style={{display:"flex",gap:6,marginBottom:16}}>
              {PROGRAMS[phase].map((d,i)=>(
                <button key={i} onClick={()=>{setActiveDay(i);setAiResponse("");}} style={{flex:1,padding:"9px 4px",background:activeDay===i?ACCENT:"#151515",color:activeDay===i?"#000":MUTED,border:"none",cursor:"pointer",fontFamily:FF,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <span style={{fontSize:9,fontWeight:900}}>DAY</span>
                  <span style={{fontSize:18,fontWeight:900,lineHeight:1}}>{d.id}</span>
                </button>
              ))}
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:8,color:ACCENT,letterSpacing:2,marginBottom:3}}>DAY {day.id} · {day.tag}</div>
              <div style={{fontSize:18,fontWeight:900}}>{day.name.toUpperCase()}</div>
              {day.note&&<div style={{fontSize:10,color:"#777",marginTop:5,borderLeft:"2px solid "+ACCENT,paddingLeft:8,lineHeight:1.6}}>{day.note}</div>}
            </div>

            <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap"}}>
              {[[ACCENT,"Straight Sets"],["#7C3AED","Circuit / Superset"],[GREEN,"Core"],["#DC2626","Conditioning"]].map(([color,label])=>(
                <div key={label} style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:10,height:10,background:color,flexShrink:0}}/>
                  <span style={{fontSize:9,color:MUTED,letterSpacing:1}}>{label}</span>
                </div>
              ))}
            </div>

            {day.circuits.map(circuit=>{
              const isMetcon=!!circuit.isMetcon;
              const totalSets=circuit.sets;
              const isOpen=noteOpen[circuit.id];
              const doneSoFar=isMetcon?0:circuit.exercises.reduce((sum,ex)=>sum+getRows(circuit.id,ex.id,totalSets).filter(r=>r.done).length,0);
              const doneTotal=circuit.exercises.length*totalSets;
              return(
                <div key={circuit.id} style={{border:"2px solid "+circuit.color,background:CARD,marginBottom:12,overflow:"hidden"}}>
                  <div style={{background:circuit.color+"18",borderBottom:"1px solid "+circuit.color+"44",padding:"9px 12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:8,color:circuit.color,letterSpacing:2,fontWeight:900}}>{circuit.label}</div>
                        <div style={{fontSize:9,color:MUTED,marginTop:2}}>{isMetcon?"choose one":totalSets+" sets"} · rest {circuit.rest}</div>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        {!isMetcon&&<div style={{fontSize:9,color:doneSoFar===doneTotal&&doneTotal>0?GREEN:MUTED}}>{doneSoFar}/{doneTotal}</div>}
                        {isMetcon&&metconSel[circuit.id]&&<div style={{fontSize:9,color:GREEN,letterSpacing:1}}>DONE ✓</div>}
                        <button onClick={()=>setNoteOpen(n=>({...n,[circuit.id]:!n[circuit.id]}))} style={{background:"transparent",border:"1px solid "+circuit.color+"55",color:circuit.color,padding:"3px 7px",fontSize:9,cursor:"pointer",fontFamily:FF,letterSpacing:1}}>{isOpen?"HIDE":"GOAL"}</button>
                      </div>
                    </div>
                    {isOpen&&<div style={{marginTop:8,fontSize:10,color:"#999",lineHeight:1.7,borderTop:"1px solid "+circuit.color+"22",paddingTop:8}}>{circuit.note}</div>}
                  </div>

                  <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:12}}>
                    {isMetcon&&circuit.exercises.map((ex,exIdx)=>{
                      const isSel=metconSel[circuit.id]===ex.id;
                      const letter=["A","B","C"][exIdx]??String(exIdx+1);
                      return(
                        <button key={ex.id} onClick={()=>setMetconSel(m=>({...m,[circuit.id]:m[circuit.id]===ex.id?null:ex.id}))} style={{width:"100%",textAlign:"left",padding:"12px",background:isSel?"#071a07":"#161616",border:"2px solid "+(isSel?GREEN:"#2a2a2a"),cursor:"pointer",fontFamily:FF,display:"flex",gap:12,alignItems:"flex-start"}}>
                          <div style={{width:30,height:30,flexShrink:0,background:isSel?GREEN:"#222",color:isSel?"#000":MUTED,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900}}>{isSel?"✓":letter}</div>
                          <div style={{fontSize:12,color:isSel?TEXT:"#888",lineHeight:1.6,paddingTop:4}}>{ex.name}</div>
                        </button>
                      );
                    })}

                    {!isMetcon&&circuit.exercises.map((ex,exIdx)=>{
                      const rows=getRows(circuit.id,ex.id,totalSets);
                      const pr=prs[ex.id];
                      return(
                        <div key={ex.id}>
                          {exIdx>0&&<div style={{height:1,background:circuit.color+"22",marginBottom:12}}/>}
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                            <div>
                              <div style={{fontSize:13,fontWeight:700}}>{ex.name}</div>
                              <div style={{fontSize:9,color:MUTED,marginTop:2}}>Target: {ex.repTarget}</div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              {pr&&<div style={{fontSize:9,color:ACCENT,letterSpacing:1}}>PR {pr.weight}lb</div>}
                              {ex.score&&<div style={{fontSize:8,color:"#444",marginTop:1,letterSpacing:1}}>TRACK WEIGHT</div>}
                            </div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"22px 1fr 1fr 30px",gap:5,marginBottom:5}}>
                            {["SET","LBS","REPS","✓"].map(h=>(<div key={h} style={{fontSize:8,color:MUTED,textAlign:"center"}}>{h}</div>))}
                          </div>
                          {rows.map((row,idx)=>(
                            <div key={idx} style={{display:"grid",gridTemplateColumns:"22px 1fr 1fr 30px",gap:5,marginBottom:5,alignItems:"center"}}>
                              <div style={{fontSize:9,color:MUTED,textAlign:"center"}}>{idx+1}</div>
                              <input type="number" inputMode="decimal" placeholder="lbs" value={row.weight} onChange={e=>updateSet(circuit.id,ex.id,idx,"weight",e.target.value,totalSets)} style={{background:row.done?"#071a07":"#1a1a1a",border:"1px solid "+(row.done?GREEN+"55":BORDER),color:TEXT,padding:"8px 4px",fontSize:14,fontWeight:700,fontFamily:FF,textAlign:"center",width:"100%",boxSizing:"border-box",outline:"none"}}/>
                              <input type="number" inputMode="decimal" placeholder="reps" value={row.reps} onChange={e=>updateSet(circuit.id,ex.id,idx,"reps",e.target.value,totalSets)} style={{background:row.done?"#071a07":"#1a1a1a",border:"1px solid "+(row.done?GREEN+"55":BORDER),color:TEXT,padding:"8px 4px",fontSize:14,fontWeight:700,fontFamily:FF,textAlign:"center",width:"100%",boxSizing:"border-box",outline:"none"}}/>
                              <button onClick={()=>toggleDone(circuit.id,ex.id,idx,totalSets)} style={{background:row.done?GREEN:"#1a1a1a",border:"1px solid "+(row.done?GREEN:BORDER),color:row.done?"#000":MUTED,padding:"8px 0",fontSize:12,cursor:"pointer",fontFamily:FF,width:"100%"}}>✓</button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button onClick={saveWorkout} style={{flex:1,padding:"14px",background:ACCENT,color:"#000",border:"none",fontSize:10,fontWeight:900,letterSpacing:2,cursor:"pointer",fontFamily:FF}}>{saveMsg||"SAVE WORKOUT"}</button>
              <button onClick={getCoaching} disabled={aiLoading} style={{flex:1,padding:"14px",background:aiLoading?"#1a1a1a":"#060d1a",color:aiLoading?MUTED:BLUE,border:"1px solid "+(aiLoading?BORDER:BLUE),fontSize:10,fontWeight:900,letterSpacing:2,cursor:aiLoading?"default":"pointer",fontFamily:FF}}>{aiLoading?"ANALYZING...":"GET COACHING"}</button>
            </div>

            {aiResponse&&(
              <div style={{background:"#060c18",border:"1px solid "+BLUE,padding:16,marginTop:10}}>
                <div style={{fontSize:8,color:BLUE,letterSpacing:3,marginBottom:10}}>AI COACH</div>
                <div style={{fontSize:12,color:"#bbb",lineHeight:1.9,whiteSpace:"pre-wrap"}}>{aiResponse}</div>
              </div>
            )}
          </>
        )}

        {/* PRs TAB */}
        {tab==="prs"&&(()=>{
          const allEx=allExercisesForPRs();
          const hasPrs=allEx.some(e=>prs[e.id]);
          return(
            <>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:8,color:ACCENT,letterSpacing:3,marginBottom:3}}>ALL TIME</div>
                <div style={{fontSize:18,fontWeight:900}}>PERSONAL RECORDS</div>
                <div style={{fontSize:10,color:MUTED,marginTop:4}}>Tracks both hypertrophy and strength phase lifts.</div>
              </div>
              {!hasPrs?(<div style={{fontSize:12,color:MUTED,textAlign:"center",paddingTop:50,lineHeight:2}}>No PRs yet.<br/>Log and save workouts to track them.</div>):(
                [1,2,3,4].map(dayId=>{
                  const dayName=PROGRAMS.hypertrophy.find(d=>d.id===dayId)?.name||"";
                  const exList=allEx.filter(e=>e.dayId===dayId&&prs[e.id]);
                  if(!exList.length)return null;
                  return(
                    <div key={dayId} style={{marginBottom:20}}>
                      <div style={{fontSize:9,color:ACCENT,letterSpacing:2,marginBottom:8,borderBottom:"1px solid "+BORDER,paddingBottom:6}}>DAY {dayId} · {dayName.toUpperCase()}</div>
                      {exList.map(ex=>{
                        const pr=prs[ex.id];
                        return(
                          <div key={ex.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #151515"}}>
                            <span style={{fontSize:12,color:"#ccc"}}>{ex.name}</span>
                            <div style={{textAlign:"right"}}>
                              <span style={{fontSize:15,fontWeight:900,color:ACCENT}}>{pr.weight}lb</span>
                              <div style={{fontSize:9,color:MUTED,marginTop:1}}>{fmt(pr.date)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </>
          );
        })()}

        {/* HISTORY TAB */}
        {tab==="log"&&(
          <>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:8,color:ACCENT,letterSpacing:3,marginBottom:3}}>SESSION LOG</div>
              <div style={{fontSize:18,fontWeight:900}}>HISTORY</div>
            </div>
            {history.length===0?(<div style={{fontSize:12,color:MUTED,textAlign:"center",paddingTop:50}}>No sessions saved yet.</div>):(
              history.map((h,i)=>{
                const phData=PROGRAMS[h.phase]||PROGRAMS.hypertrophy;
                const dInfo=phData[h.dayIdx];
                if(!dInfo)return null;
                const mc=dInfo.circuits.find(c=>c.isMetcon);
                const mcId=h.metconSel&&mc&&h.metconSel[mc.id];
                const mcIdx=mc?.exercises.findIndex(e=>e.id===mcId)??-1;
                const fl=mcIdx>=0?["A","B","C"][mcIdx]:null;
                const loggedEx=dInfo.circuits.filter(c=>!c.isMetcon).flatMap(c=>
                  c.exercises.map(ex=>{
                    const k=Object.keys(h.sets||{}).find(key=>key.endsWith("__"+ex.id));
                    if(!k)return null;
                    const best=(h.sets[k]||[]).reduce((mx,r)=>Math.max(mx,parseFloat(r.weight)||0),0);
                    if(!best)return null;
                    return{name:ex.name,best};
                  }).filter(Boolean)
                );
                return(
                  <div key={i} style={{background:CARD,border:"1px solid "+BORDER,padding:14,marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:900}}>DAY {dInfo.id} — {dInfo.name}</div>
                        <div style={{fontSize:9,color:MUTED,marginTop:2}}>{fmt(h.date)} · {(h.phase||"hypertrophy").toUpperCase()}</div>
                      </div>
                      {fl&&<div style={{fontSize:9,color:GREEN,letterSpacing:1,alignSelf:"flex-start"}}>FINISHER {fl}</div>}
                    </div>
                    {loggedEx.length===0?(<div style={{fontSize:10,color:MUTED}}>No weights logged this session.</div>):(
                      loggedEx.map(({name,best})=>(
                        <div key={name} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #151515"}}>
                          <span style={{fontSize:11,color:"#999"}}>{name}</span>
                          <span style={{fontSize:11,color:"#ccc",fontWeight:700}}>{best}lb</span>
                        </div>
                      ))
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

      </div>
    </div>
  );
}
