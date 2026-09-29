/* Plays one lesson from its data (window.LESSON): the same step kinds the product's
   step lessons use — choose, send, find, match, sort, build, make, check — plus an
   opening and a finish. Every AI answer here is a written example, and says so. */
(function(){
"use strict";
var L = window.LESSON, h = Lesson.h, src = Lesson.src, app = null;
function next(){ app.next(); }
function srcOf(s){ return s ? src(s[0], s[1], s[2], s[3], s[4], s[5]) : null; }

// ───────── the world: one stage for the lesson, a still picture when WebGL is missing
var stageEl = document.getElementById("stage"), W = null, still = null;
function stillFor(p){
  if(!still){ still = h("img",{class:"stage-img",alt:"舞台的静态画面"}); stageEl.append(still); }
  still.src = "assets/views/w-" + ({find:"guess", match:"guess", point:"guess"}[p] || p) + ".jpg";
}
try{
  if(!window.Toy) throw new Error("no bundle");
  var probe = document.createElement("canvas");
  if(!(probe.getContext("webgl2") || probe.getContext("webgl"))) throw new Error("no webgl");
  W = Toy.mount(stageEl, Toy.SCENES["world-lesson1"], { opts: L.world || {} }).scene;
}catch(e){ W = null; stageEl.innerHTML = ""; stillFor("intro"); }
function later(fn, ms){ setTimeout(function(){ fn && fn(); }, ms); }
var world = {
  go:function(p){ W ? W.go(p) : stillFor(p); },
  react:function(k){ W && W.react(k); },
  fly:function(back, done){ W ? W.fly(back, done) : later(done, 1600); },
  throwBall:function(i, ok, done){ W ? W.throwBall(i, ok, done) : later(done, 500); },
  addWagon:function(c){ W && W.addWagon(c); },
  clearWagons:function(){ W && W.clearWagons(); },
  depart:function(ok, done){ W ? W.depart(ok, done) : later(done, 600); },
  makeItem:function(done){ W ? W.makeItem(done) : later(done, 800); },
  celebrate:function(){ W && W.celebrate(); }
};

// ───────── lesson state and small shared pieces
var S = { choice:null, built:[], made:"" };
var HUES = ["#f2c963","#8fd0b8","#a9c9ec","#f3a58a","#f1b8c8","#c9b8f0"];
function materialCard(id, compact){
  var m = L.materials[id]; if(!m) return null;
  var box = h("div",{class:"material" + (compact ? " compact" : "")}, h("div",{class:"mlabel",text:m.label}));
  (m.lines || []).forEach(function(line){ box.append(h("p",{class:"mline",text:line})); });
  if(m.body) box.append(h("p",{class:"mbody",text:m.body}));
  return box;
}
function answerBox(text, label){
  return h("div",{class:"answer"}, h("span",{class:"who"}, label || "AI 的回答", h("span",{class:"demo",text:"示例：真课里是 AI 现场写的"})), h("p",{class:"atext",text:text}));
}
function waiting(msg){ return h("div",{class:"wait"}, h("span",{class:"dots"}, h("i"), h("i"), h("i")), msg || "纸飞机在飞，AI 在写……"); }
/* Element.append would print a skipped (null) part as the word "null"; add() drops it. */
function add(el){ for(var i = 1; i < arguments.length; i++){ var n = arguments[i]; if(n != null) el.append(n); } }
function checklist(items){ var ul = h("ul",{class:"check"}); items.forEach(function(t){ ul.append(h("li",{text:t})); }); return ul; }
function nextBtn(label){ return h("div",{class:"row"}, h("button",{class:"btn go",type:"button",onclick:next}, label || "继续")); }
function eyebrow(step, name){ return h("div",{class:"eyebrow",text:step.phase + " · " + name}); }
function requestText(id){
  if(id === "built") return builtText();
  var r = L.requests[id]; return r ? r.prompt : "";
}
function builtText(){
  var b = L.steps.find(function(s){ return s.kind === "build"; });
  var ids = S.built.length ? S.built : (b ? b.answers[0] : []);
  return ids.map(function(id){ return b.pieces.find(function(p){ return p.id === id; }).text; }).join("");
}
function attachOf(id){
  if(id === "built"){ var b = L.steps.find(function(s){ return s.kind === "build"; }); return b && b.attach; }
  var r = L.requests[id]; return r && r.attach;
}
function sentences(text){
  return text.split(/\n+/).flatMap(function(line){ return line.split(/(?<=[。！？!?])/); }).map(function(s){ return s.trim(); }).filter(Boolean);
}
var NAME = { choose:"选一个", send:"发出去", find:"点一处", match:"连一连", sort:"分一分（3D 小回合）", build:"排一排", make:"自己做", check:"选一个" };
var PRESET = { choose:"guess", send:"send", find:"find", match:"match", sort:"round", build:"build", make:"make", check:"make" };

// ───────── step renderers
var R = {};
R.choose = function(c, st){
  var fb = h("p",{class:"fb",hidden:true,text:st.after});
  var go = h("button",{class:"btn go",type:"button",disabled:!S.choice,onclick:next}, st.go || "发出去试试");
  var opts = h("div",{class:"opts"});
  st.options.forEach(function(o){
    var r = L.requests[o.requestId];
    var b = h("button",{class:"opt" + (S.choice === o.requestId ? " picked" : ""),type:"button",onclick:function(){
      S.choice = o.requestId; [].forEach.call(opts.children, function(x){ x.classList.remove("picked"); }); b.classList.add("picked");
      fb.hidden = false; go.disabled = false; world.react("ok");
    }}, r.prompt, r.attach ? h("span",{class:"attach-note",text:"（后面贴上：" + L.materials[r.attach].label.replace(/（练习）/,"") + "）"}) : null);
    opts.append(b);
  });
  if(S.choice) fb.hidden = false;
  add(c, eyebrow(st, NAME.choose), h("h2",{text:st.title}), st.sub ? h("p",{class:"sub",text:st.sub}) : null, opts, fb, h("div",{class:"row"}, go));
};
R.send = function(c, st){
  var id = st.request === "chosen" ? (S.choice || st.fallback) : st.request;
  var att = attachOf(id), area = h("div",{class:"opts"});
  var send = h("button",{class:"btn go",type:"button",onclick:function(){
    send.disabled = true; send.textContent = "发出去了";
    var w = waiting(); area.append(w);
    if(st.wait) area.append(h("div",{class:"real"}, h("span",{class:"tag",text:"等回信的时候"}), h("p",{text:st.wait.text}), srcOf(st.wait.src)));
    world.fly(true, function(){
      w.remove();
      var text = st.request === "built" ? L.demo.built : L.demo[id];
      area.append(answerBox(text));
      var line = st.debriefs ? st.debriefs[id] : st.after;
      if(line) area.append(h("p",{class:"fb",text:line}));
      area.append(nextBtn());
    });
  }}, "发出去");
  add(c, eyebrow(st, NAME.send), h("h2",{text:st.title}),
    h("div",{class:"composer"}, att ? h("div",{class:"att"}, h("span",{class:"clip",text:"📎"}), L.materials[att].label.replace(/（练习）/,"")) : null,
      h("div",{class:"msg",text:requestText(id)}), h("div",{class:"row"}, send)), area);
};
R.find = function(c, st){
  var id = S.choice || st.fallback, text = L.demo[id] || "";
  var parts = sentences(text), has = parts.some(function(p){ return st.terms.some(function(t){ return p.indexOf(t) >= 0; }); });
  var fb = h("p",{class:"fb",hidden:true}), nx = h("div",{hidden:true}, nextBtn());
  var list = h("div",{class:"sents"});
  parts.forEach(function(p){
    var b = h("button",{class:"sent",type:"button",onclick:function(){
      var ok = st.terms.some(function(t){ return p.indexOf(t) >= 0; });
      b.className = "sent " + (ok ? "hit" : "miss"); fb.className = "fb " + (ok ? "ok" : "no");
      fb.textContent = ok ? st.found : st.miss; fb.hidden = false; if(ok) nx.hidden = false; world.react(ok ? "ok" : "no");
    }}, p);
    list.append(b);
  });
  add(c, eyebrow(st, NAME.find), h("h2",{text:st.title}), h("p",{class:"sub",text:"这是刚才它回你的话。"}), list);
  if(!has) add(c, h("button",{class:"opt",type:"button",onclick:function(){ fb.className = "fb ok"; fb.textContent = st.absent; fb.hidden = false; nx.hidden = false; world.react("ok"); }}, st.absentLabel || "它没写这个"));
  add(c, fb, nx);
};
R.match = function(c, st){
  var sel = null, done = {}, n = 0, ids = st.requestIds, order = st.order || ids.slice().reverse();
  var fb = h("p",{class:"fb",hidden:true}), nx = h("div",{hidden:true}, nextBtn());
  var asks = h("div",{class:"pairs"}, h("h3",{text:"三句请求"})), answers = h("div",{class:"pairs"}, h("h3",{text:"三个回答（示例）"}));
  var askBtns = {};
  ids.forEach(function(rid, i){
    var b = h("button",{class:"pair",type:"button",onclick:function(){ if(done[rid]) return; sel = rid; Object.keys(askBtns).forEach(function(k){ askBtns[k].classList.toggle("sel", k === sel); }); }},
      h("span",{class:"n",text:String(i + 1)}), h("span",{text:L.requests[rid].prompt}));
    askBtns[rid] = b; asks.append(b);
  });
  order.forEach(function(rid){
    var num = h("span",{class:"n",text:"?"});
    var b = h("button",{class:"pair",type:"button",onclick:function(){
      if(b.classList.contains("done")) return;
      if(!sel){ fb.className = "fb"; fb.textContent = "先点上面的一句请求。"; fb.hidden = false; return; }
      if(sel === rid){
        done[rid] = true; n++; b.className = "pair done"; num.textContent = String(ids.indexOf(rid) + 1); askBtns[rid].className = "pair done"; sel = null; world.react("ok");
        fb.className = "fb ok"; fb.textContent = n < ids.length ? "连上了。" : st.after; fb.hidden = false; if(n === ids.length) nx.hidden = false;
      } else {
        b.classList.add("bad"); setTimeout(function(){ b.classList.remove("bad"); }, 700); world.react("no");
        fb.className = "fb no"; fb.textContent = st.miss || "不是这个。对照一下请求里说了什么、没说什么。"; fb.hidden = false;
      }
    }}, num, h("span",{class:"atext",text:L.demo[rid]}));
    answers.append(b);
  });
  add(c, eyebrow(st, NAME.match), h("h2",{text:st.title}), asks, answers, fb, nx);
};
R.sort = function(c, st){
  var i = 0, pips = h("div",{class:"pips","aria-hidden":"true"}), card = h("div",{class:"roundcard"});
  st.cards.forEach(function(){ pips.append(h("i")); });
  var fb = h("p",{class:"fb",hidden:true}), cnt = h("p",{class:"sub"});
  var nextCard = h("button",{class:"btn",type:"button",hidden:true,onclick:function(){ i++; show(); }}, "下一张");
  var done = h("div",{hidden:true}, h("p",{class:"fb ok",text:st.after}), h("div",{style:"margin-top:10px"}, nextBtn()));
  var bins = h("div",{class:"bins"});
  st.buckets.forEach(function(name, bi){
    bins.append(h("button",{class:"btn " + (bi ? "no" : "yes"),type:"button",onclick:function(){
      if(i >= st.cards.length) return; var k = st.cards[i], ok = k.b === bi;
      world.throwBall(bi, ok);
      if(ok){ fb.className = "fb ok"; fb.textContent = "对。" + k.why; pips.children[i].className = "ok"; bins.hidden = true; if(i === st.cards.length - 1) done.hidden = false; else nextCard.hidden = false; }
      else { fb.className = "fb no"; fb.textContent = k.not + " 再放一次。"; }
      fb.hidden = false;
    }}, name));
  });
  function show(){
    nextCard.hidden = true; fb.hidden = true; bins.hidden = false;
    [].forEach.call(pips.children, function(p, j){ if(j === i) p.className = "now"; });
    card.textContent = st.cards[i].t; cnt.textContent = "第 " + (i + 1) + " 张，共 " + st.cards.length + " 张";
  }
  add(c, eyebrow(st, NAME.sort), h("h2",{text:st.title}), st.sub ? h("p",{class:"sub",text:st.sub}) : null, st.material ? materialCard(st.material, true) : null, cnt, pips, card, bins, fb, h("div",{class:"row"}, nextCard), done);
  show();
};
R.build = function(c, st){
  S.built = []; world.clearWagons();
  var sentence = h("div",{class:"sentence","aria-label":"你拼的请求"}), tray = h("div",{class:"tray"});
  var fb = h("p",{class:"fb",hidden:true}), nx = h("div",{hidden:true}, nextBtn("发出去看看"));
  var color = function(id){ return HUES[st.pieces.findIndex(function(p){ return p.id === id; }) % HUES.length]; };
  function paint(){
    sentence.innerHTML = "";
    S.built.forEach(function(id, k){
      var p = st.pieces.find(function(x){ return x.id === id; });
      sentence.append(h("button",{class:"chip",type:"button",style:"background:" + color(id),title:"点一下拿掉",onclick:function(){
        S.built.splice(k, 1); world.clearWagons(); S.built.forEach(function(j){ world.addWagon(parseInt(color(j).slice(1), 16)); }); paint();
      }}, p.text));
    });
    [].forEach.call(tray.children, function(b){ b.disabled = S.built.indexOf(b.dataset.id) >= 0; });
  }
  st.pieces.forEach(function(p){
    tray.append(h("button",{class:"chip",type:"button","data-id":p.id,style:"background:" + color(p.id),onclick:function(){
      if(S.built.indexOf(p.id) >= 0 || S.built.length >= 6) return; S.built.push(p.id); world.addWagon(parseInt(color(p.id).slice(1), 16)); paint(); fb.hidden = true;
    }}, p.text));
  });
  var goBtn = h("button",{class:"btn go",type:"button",onclick:function(){
    if(!S.built.length){ fb.className = "fb"; fb.textContent = "先点几块积木。"; fb.hidden = false; return; }
    var bad = S.built.map(function(id){ return st.pieces.find(function(x){ return x.id === id; }); }).find(function(p){ return p.why; });
    var ok = st.answers.some(function(a){ return a.join() === S.built.join(); });
    goBtn.disabled = true; world.depart(ok, function(){ goBtn.disabled = false; });
    if(ok){ fb.className = "fb ok"; fb.textContent = st.after; nx.hidden = false; tray.hidden = true; goBtn.hidden = true; }
    else if(bad){ fb.className = "fb no"; fb.textContent = "「" + bad.text + "」：" + bad.why + " 点它一下拿掉。"; }
    else { fb.className = "fb no"; fb.textContent = st.hint; }
    fb.hidden = false;
  }}, "拼好了，发车");
  add(c, eyebrow(st, NAME.build), h("h2",{text:st.title}), st.context ? h("p",{class:"context",text:st.context}) : null, sentence, tray, h("div",{class:"row"}, goBtn), fb, nx);
  paint();
};
R.make = function(c, st){
  var q = h("textarea",{rows:"3",placeholder:st.placeholder,"aria-label":"你的请求"}); q.value = S.madeQ || "";
  var fb = h("p",{class:"fb",hidden:true}), area = h("div",{class:"opts"});
  var send = h("button",{class:"btn go",type:"button",onclick:function(){
    var v = q.value.trim(); S.madeQ = v;
    if(v.length < 6){ fb.className = "fb"; fb.textContent = "先写一句完整的请求。"; fb.hidden = false; return; }
    fb.hidden = true; send.disabled = true; area.innerHTML = "";
    var w = waiting(); area.append(w); world.go("send");
    world.fly(true, function(){
      world.go("make"); w.remove(); send.disabled = false;
      var rule = st.rules.find(function(r){ return new RegExp(r.test).test(v); }) || st.fallback;
      area.append(answerBox(rule.answer));
      if(rule.feedback) area.append(h("p",{class:"fb " + (rule.good ? "ok" : "no"),text:rule.feedback}));
      if(rule.good){
        var edit = h("textarea",{rows:"5","aria-label":"改成你的话"}); edit.value = rule.draft || rule.answer;
        var fb2 = h("p",{class:"fb",hidden:true});
        var save = h("button",{class:"btn go",type:"button",onclick:function(){
          if(edit.value.indexOf("___") >= 0){ fb2.className = "fb no"; fb2.textContent = "还有空着的地方：这些得你来定。"; fb2.hidden = false; return; }
          S.made = edit.value.trim(); save.disabled = true;
          world.makeItem(function(){ fb2.className = "fb ok"; fb2.textContent = "做好了：「" + st.artifact + "」摆上了架子。"; fb2.hidden = false; area.append(nextBtn()); });
        }}, "改好了，就用这版");
        area.append(h("p",{class:"sub",text:rule.draft ? "它照这些写的回信草稿，空着的地方你来定：" : "在下面改成你自己的话，改好再定稿："}), edit, h("div",{class:"row"}, save), fb2);
      }
    });
  }}, "发出去");
  add(c, eyebrow(st, NAME.make), h("h2",{text:st.title}), h("p",{text:st.scenario}), materialCard(st.material), h("p",{class:"sub",text:st.goal}), q,
    checklist(st.checklist), h("div",{class:"row"}, send), fb, area);
};
R.check = function(c, st){
  var fb = h("p",{class:"fb",hidden:true}), nx = h("div",{hidden:true}, nextBtn("学完了")), opts = h("div",{class:"opts"});
  st.options.forEach(function(o){
    var b = h("button",{class:"opt",type:"button",onclick:function(){ [].forEach.call(opts.children, function(x){ x.classList.remove("picked"); }); b.classList.add("picked"); fb.className = "fb ok"; fb.textContent = o.after; fb.hidden = false; nx.hidden = false; world.react("ok"); }}, o.label);
    opts.append(b);
  });
  add(c, eyebrow(st, NAME.check), h("h2",{text:st.title}), S.made ? h("div",{class:"answer"}, h("span",{class:"who",text:"你定稿的那一版"}), h("p",{class:"atext",text:S.made})) : null, opts, fb, nx);
};

// ───────── opening and finish
function intro(c){
  var i = L.intro;
  add(c, h("div",{class:"eyebrow",text:"开场 · 第 " + L.n + " 关"}), h("h2",{text:L.title}),
    h("div",{class:"real"}, h("span",{class:"tag",text:"真实世界里的事"}), h("p",{text:i.door.text}), srcOf(i.door.src)),
    h("p",{text:i.situation}), h("p",{class:"sub",text:i.need}), i.material ? materialCard(i.material) : null, nextBtn("开始"));
}
function finish(c){
  var f = L.finish; world.celebrate();
  var cards = h("div",{class:"review"});
  f.cards.forEach(function(cd){
    var on = false, b = h("button",{class:"rc",type:"button","aria-pressed":"false"}, h("b",{text:"复习卡 · 正面"}), cd[0]);
    b.addEventListener("click", function(){ on = !on; b.setAttribute("aria-pressed", String(on)); b.innerHTML = ""; b.append(h("b",{text:on ? "复习卡 · 背面" : "复习卡 · 正面"}), on ? cd[1] : cd[0]); });
    cards.append(b);
  });
  var chest = h("div",{class:"chest",hidden:true}, h("p",{html:"<b>带回岛上：</b>" + f.island}), h("p",{class:"sub",text:"两张复习卡，明天会再来找你。点一下翻面："}), cards);
  var open = h("button",{class:"btn go",type:"button",onclick:function(){ open.hidden = true; chest.hidden = false; world.react("ok"); }}, "开宝箱");
  add(c, h("div",{class:"eyebrow",text:"学完了"}), h("p",{class:"take",text:f.take}),
    h("div",{class:"real"}, h("span",{class:"tag",text:"你知道吗"}), h("p",{text:f.after.text}), srcOf(f.after.src)),
    h("div",{class:"row"}, open), chest, h("p",{class:"fb",html:"<b>今天就用一次：</b>" + f.today}),
    h("div",{class:"row"}, h("button",{class:"btn ghost",type:"button",onclick:function(){ S.choice = null; S.built = []; S.made = ""; S.madeQ = ""; app.goTo(0); }}, "从头再玩一遍"), L.nextHref ? h("a",{href:L.nextHref}, L.nextLabel) : null));
}

// ───────── screens
var screens = [{ label:"开场", title:"真实世界之门", preset:"intro", notes:L.intro.notes, render:intro }];
var count = {};
L.steps.forEach(function(st){
  count[st.phase] = (count[st.phase] || 0) + 1;
  screens.push({ label: st.phase + " " + count[st.phase], title: NAME[st.kind] + "：" + (st.short || st.title), phase: st.phase, preset: PRESET[st.kind], notes: st.notes || {}, render: function(c){ R[st.kind](c, st); } });
});
screens.push({ label:"学完", title:"你知道吗 + 带回岛上", preset:"done", last:true, notes:L.finish.notes, render:finish });
// a phase numbered once needs no number
screens.forEach(function(s){ if(s.phase && count[s.phase] === 1) s.label = s.phase; });
app = Lesson.run({ screens: screens, world: world });
window.__lesson = { goTo: app.goTo, S: S, has3D: !!W };
app.goTo(0);
})();
