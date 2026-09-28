/* Shared shell of the two playable lesson pages: a DOM helper, the source note,
   and the step machine (phase chips, jump list, owner notes). Each page brings
   its own screens and its own 3D world. */
(function(){
"use strict";
function h(tag, attrs){
  var el=document.createElement(tag);
  if(attrs) for(var k in attrs){
    var v=attrs[k];
    if(k==="class") el.className=v;
    else if(k==="html") el.innerHTML=v;
    else if(k==="text") el.textContent=v;
    else if(k.slice(0,2)==="on") el.addEventListener(k.slice(2),v);
    else if(v===true) el.setAttribute(k,"");
    else if(v!==false && v!=null) el.setAttribute(k,v);
  }
  for(var i=2;i<arguments.length;i++){ var c=arguments[i]; if(c==null) continue; el.appendChild(typeof c==="string"?document.createTextNode(c):c); }
  return el;
}
/** A folded source note: who said it, when, what it supports, what to be careful about. */
function src(publisher, title, url, date, supports, limit){
  return h("details",{class:"src"},h("summary",{text:"出处（点开看）"}),
    h("p",null,publisher+" · "+date+" · ",h("a",{href:url,target:"_blank",rel:"noopener"},title)),
    h("p",{text:"它说的："+supports}),
    h("p",{text:"要注意："+limit+" 核对于 2026-09-28。"}));
}
var PH=["猜","跑","看","改","做"];
/** run({screens, world, titles}) wires the page's #card, #notes, #phases, #count and #jump. */
function run(o){
  var cardEl=document.getElementById("card"), notesEl=document.getElementById("notes"), phasesEl=document.getElementById("phases"), countEl=document.getElementById("count"), jumpEl=document.getElementById("jump");
  var screens=o.screens, cur=0;
  phasesEl.innerHTML=""; jumpEl.innerHTML="";
  PH.forEach(function(p){ phasesEl.append(h("span",{text:p})); });
  screens.forEach(function(s,i){
    jumpEl.append(h("li",null,h("button",{type:"button","data-i":String(i),onclick:function(){ goTo(i); }},h("span",{class:"ph",text:s.label}),h("span",{text:s.title}))));
  });
  function goTo(i){
    cur=i; var s=screens[i];
    cardEl.innerHTML=""; s.render(cardEl);
    if(s.preset && o.world && o.world.go) o.world.go(s.preset);
    var pi=s.phase?PH.indexOf(s.phase):(s.last?5:-1);
    [].forEach.call(phasesEl.children,function(x,j){ x.className= j===pi?"on":(j<pi?"done":""); });
    countEl.textContent=(i+1)+" / "+screens.length;
    [].forEach.call(jumpEl.querySelectorAll("button"),function(b){ if(+b.dataset.i===i) b.setAttribute("aria-current","step"); else b.removeAttribute("aria-current"); });
    notesEl.innerHTML="";
    var dl=h("dl");
    [["互动组件",s.notes.comp],["3D 舞台",s.notes.stage],["真实世界",s.notes.real],["课文",s.notes.text]].forEach(function(r){ if(r[1]) dl.append(h("dt",{text:r[0]}),h("dd",{text:r[1]})); });
    notesEl.append(h("h2",{text:"这一屏：「"+s.label+"」"}),dl);
    if(window.innerWidth<=980 && i>0 && !o.noScroll) document.querySelector(".dev").scrollIntoView({block:"start",behavior:"smooth"});
  }
  function next(){ if(cur<screens.length-1) goTo(cur+1); }
  return {goTo:goTo,next:next,get i(){return cur;}};
}
window.Lesson={h:h,src:src,run:run};
})();
