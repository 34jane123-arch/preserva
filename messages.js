/* PRESERVA messaging (FRONTEND PROTOTYPE).
   Messages live in this browser's localStorage only, so they work between accounts used in the SAME
   browser on the same device, NOT between different devices. Real chat needs a backend, a database and a
   real-time service (WebSocket, etc.). Only `store` and the poll in mount() would change.
   Keys: preserva_conversations, preserva_messages. */
(function () {
  "use strict";
  const rd = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  const store = {
    convs: { all: () => rd("preserva_conversations"), save: l => localStorage.setItem("preserva_conversations", JSON.stringify(l)) },
    msgs:  { all: () => rd("preserva_messages"),      save: l => localStorage.setItem("preserva_messages", JSON.stringify(l)) }
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const when = iso => iso ? new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const convId = (a, b) => [a, b].sort().join("__");
  const isBuyer = r => r === "local" || r === "business";

  /* ---- service (all access checks live here; a backend must repeat them) ---- */
  const mine = uid => store.convs.all().filter(c => c.participants.some(p => p.id === uid));
  const unreadFor = (uid, cid) => store.msgs.all().filter(m => m.receiverId === uid && !m.isRead && (!cid || m.conversationId === cid)).length;
  function ensure(me, other) { // other = {id, name, role}; only buyer <-> seller chats are allowed
    if (!(isBuyer(me.role) && other.role === "seller") && !(me.role === "seller" && isBuyer(other.role))) return null;
    const id = convId(me.id, other.id), all = store.convs.all();
    let c = all.find(x => x.conversationId === id);
    if (!c) {
      c = { conversationId: id, participants: [{ id: me.id, name: me.fullName, role: me.role }, { id: other.id, name: other.name, role: other.role }], lastMessage: "", lastMessageTime: null };
      all.push(c); store.convs.save(all);
    }
    return c;
  }
  const canMsg = () => { const cu = window.PreservaAuth && window.PreservaAuth.currentUser(); return !(cu && cu.perms && cu.perms.message === false); }; // admins can switch messaging off per account
  function report(me, cid, reason) { // stores a report for the admin dashboard; only the reported message is shared
    const c = store.convs.all().find(x => x.conversationId === cid);
    if (!c || !c.participants.some(p => p.id === me.id)) return "Conversation not found.";
    const other = c.participants.find(p => p.id !== me.id);
    const last = store.msgs.all().filter(m => m.conversationId === cid && m.senderId === other.id).pop();
    if (!last) return "There is no message from this person to report yet.";
    reason = String(reason || "").trim().slice(0, 200);
    if (!reason) return "Enter a reason to send a report.";
    const all = rd("preserva_reports");
    all.push({ id: "r_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type: "message", targetUserId: other.id, productId: "", productName: "",
      reporterId: me.id, reporterName: me.fullName, reporterRole: me.role, reason, details: "", excerpt: String(last.messageText).slice(0, 300), status: "open", createdAt: new Date().toISOString() });
    localStorage.setItem("preserva_reports", JSON.stringify(all));
    return "";
  }
  function send(me, cid, text) {
    if (!canMsg()) return false;
    text = String(text || "").trim().slice(0, 500);
    const all = store.convs.all(), c = all.find(x => x.conversationId === cid);
    if (!text || !c || !c.participants.some(p => p.id === me.id)) return false;
    const to = c.participants.find(p => p.id !== me.id), now = new Date().toISOString(), ms = store.msgs.all();
    ms.push({ messageId: "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), conversationId: cid, senderId: me.id, senderName: me.fullName, receiverId: to.id, messageText: text, timestamp: now, isRead: false });
    store.msgs.save(ms); c.lastMessage = text; c.lastMessageTime = now; store.convs.save(all);
    return true;
  }
  function markRead(me, cid) {
    const ms = store.msgs.all(); let changed = false;
    ms.forEach(m => { if (m.conversationId === cid && m.receiverId === me.id && !m.isRead) { m.isRead = true; changed = true; } });
    if (changed) store.msgs.save(ms);
  }

  /* ---- navigation badges: any element with data-msg-badge ---- */
  let badgeTimer;
  function badges(uid) {
    const upd = () => document.querySelectorAll("[data-msg-badge]").forEach(b => { const n = unreadFor(uid); b.textContent = n; b.hidden = !n; });
    clearInterval(badgeTimer); upd(); badgeTimer = setInterval(upd, 1500); window.addEventListener("storage", upd);
  }

  /* ---- UI ---- */
  let timer;
  function mount(host, me, openWith) {
    clearInterval(timer);
    host.innerHTML = `<div class="msg-app"><aside class="msg-list"><input class="msg-search" type="search" placeholder="Search conversations" aria-label="Search conversations"><div class="msg-convs"></div></aside>
      <section class="msg-chat"><div class="msg-head"></div><div class="msg-log" aria-live="polite"></div>
      <form class="msg-form"><input maxlength="500" placeholder="Type a message…" aria-label="Message" autocomplete="off"><button class="btn-sm" type="submit">Send</button></form></section></div>`;
    const q = s => host.querySelector(s), app = q(".msg-app"), input = q(".msg-form input"), sendBtn = q(".msg-form button");
    let sel = null;
    if (openWith) { const c = ensure(me, openWith); if (c) sel = c.conversationId; }

    function drawList() {
      const term = q(".msg-search").value.toLowerCase().trim();
      const list = mine(me.id).filter(c => c.participants.find(p => p.id !== me.id).name.toLowerCase().includes(term))
        .sort((a, b) => String(b.lastMessageTime || "").localeCompare(String(a.lastMessageTime || "")));
      q(".msg-convs").innerHTML = list.length ? list.map(c => {
        const o = c.participants.find(p => p.id !== me.id), n = unreadFor(me.id, c.conversationId);
        return `<div class="msg-conv ${c.conversationId === sel ? "on" : ""}" data-cid="${esc(c.conversationId)}"><div class="msg-av">${esc(o.name[0] || "?")}</div>
          <div class="msg-meta"><b>${esc(o.name)}</b><small>${esc(c.lastMessage || "No messages yet")}</small></div>
          <div><div class="msg-time">${when(c.lastMessageTime)}</div>${n ? `<span class="msg-dot">${n}</span>` : ""}</div></div>`;
      }).join("") : `<p class="msg-empty" style="padding:20px">No conversations yet. Use “Contact Seller” on a product or order.</p>`;
    }
    function drawChat() {
      const c = mine(me.id).find(x => x.conversationId === sel);
      input.disabled = sendBtn.disabled = !c;
      if (!c) { q(".msg-head").textContent = "Messages"; q(".msg-log").innerHTML = `<p class="msg-empty">Select a conversation to start chatting.</p>`; return; }
      const o = c.participants.find(p => p.id !== me.id);
      q(".msg-head").innerHTML = `<button class="msg-back" type="button" aria-label="Back">←</button><span>${esc(o.name)} <small>(${o.role === "seller" ? "Seller" : o.role === "business" ? "Business Buyer" : "Local Buyer"})</small></span><button class="msg-report" type="button">Report</button>`;
      markRead(me, sel);
      const ms = store.msgs.all().filter(m => m.conversationId === sel), log = q(".msg-log"), atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
      log.innerHTML = ms.length ? ms.map(m => `<div class="msg-b ${m.senderId === me.id ? "me" : ""}"><b>${esc(m.senderId === me.id ? "You" : m.senderName)}</b><br>${esc(m.messageText)}<small>${when(m.timestamp)}</small></div>`).join("") : `<p class="msg-empty">Say hello! Ask about availability or bulk orders.</p>`;
      if (atEnd || !log.dataset.init) { log.scrollTop = log.scrollHeight; log.dataset.init = 1; }
    }
    const draw = () => { drawList(); drawChat(); };
    q(".msg-convs").addEventListener("click", e => { const d = e.target.closest("[data-cid]"); if (!d) return; sel = d.dataset.cid; app.classList.add("chat-open"); q(".msg-log").dataset.init = ""; draw(); });
    q(".msg-head").addEventListener("click", e => {
      if (e.target.closest(".msg-back")) { app.classList.remove("chat-open"); return; }
      if (e.target.closest(".msg-report") && sel) {
        const why = prompt("Why are you reporting this person? (for example: abusive language, spam, scam)"); if (why === null) return;
        const err = report(me, sel, why); alert(err || "Report sent to the administrators. Only the reported message is shared with them.");
      }
    });
    q(".msg-search").addEventListener("input", drawList);
    q(".msg-form").addEventListener("submit", e => { e.preventDefault(); if (!canMsg()) { alert("Messaging is turned off for your account. Please contact an administrator."); return; } if (sel && send(me, sel, input.value)) { input.value = ""; q(".msg-log").dataset.init = ""; draw(); } });
    if (sel) app.classList.add("chat-open");
    draw();
    // "Live" updates: poll + storage event (same browser only; a backend would push instead)
    timer = setInterval(() => { if (host.isConnected && host.offsetParent !== null) draw(); }, 1500);
    window.addEventListener("storage", draw);
  }

  window.PreservaMessages = { mount, ensure, send, unread: uid => unreadFor(uid), badges, mine };
})();
