/* PRESERVA seller dashboard (FRONTEND DEMO, localStorage).
   Layer 1 `repo` is the only part that touches storage: replace its bodies
   with fetch() calls to your API/database later. The UI below never changes. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const peso = n => "₱" + Number(n).toLocaleString("en-PH", { maximumFractionDigits: 2 });

  /* ---------- 1. DATA LAYER (swap for API calls) ---------- */
  const read = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  const repo = {
    products: { all: () => read("preserva_products"), save: l => localStorage.setItem("preserva_products", JSON.stringify(l)) },
    orders:   { all: () => read("preserva_orders"),   save: l => localStorage.setItem("preserva_orders", JSON.stringify(l)) }
  };

  /* ---------- 2. ACCESS CONTROL ---------- */
  const Auth = window.PreservaAuth;
  const chk = Auth.requireRole("seller");
  if (!chk.ok) {
    if (chk.reason === "login") { location.replace("login.html"); return; }
    $("gateText").textContent = "This dashboard is for Seller accounts. You are signed in as " + Auth.ROLES[chk.user.role].label + ".";
    $("gateBtn").href = Auth.dashboardFor(chk.user.role);
    $("dashGate").hidden = false;
    return;
  }
  const me = chk.user; // Reminder: real security must be enforced by your server.
  $("dashContent").hidden = false;
  $("uName").textContent = me.fullName;
  $("pfName").textContent = me.fullName; $("pfUser").textContent = me.username; $("pfEmail").textContent = me.email;

  const mine = () => repo.products.all().filter(p => p.sellerId === me.id);
  const myOrders = () => repo.orders.all().filter(o => o.sellerId === me.id);
  const price = p => p.discountPrice && p.discountPrice < p.price ? p.discountPrice : p.price;
  const toast = t => { const x = $("toast"); x.textContent = t; x.classList.add("show"); setTimeout(() => x.classList.remove("show"), 2200); };
  const table = (heads, rows, emptyMsg) => rows.length
    ? `<table class="dt"><thead><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`
    : `<p class="empty">${emptyMsg}</p>`;

  /* ---------- 3. NAVIGATION ---------- */
  const titles = { dashboard: "Dashboard", products: "My Products", add: "Add Product", orders: "Orders", sales: "Sales", profile: "Profile", msgs: "Messages" };
  function go(view) {
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("on", v.id === "v-" + view));
    document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("on", b.dataset.view === view));
    $("viewTitle").textContent = titles[view];
    $("sidebar").classList.remove("open");
    render();
    if (view === "msgs") PreservaMessages.mount($("msgHost"), me);
  }
  PreservaMessages.badges(me.id);
  document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => go(b.dataset.view)));
  $("menuBtn").addEventListener("click", () => $("sidebar").classList.toggle("open"));
  $("logoutBtn").addEventListener("click", () => { Auth.logout(); location.assign("index.html"); });

  /* ---------- 4. RENDERING ---------- */
  const STATUS = ["pending", "accepted", "preparing", "ready", "completed", "rejected"];
  const pillFor = s => `<span class="pill ${s === "pending" ? "warn" : s === "rejected" ? "bad" : ""}">${s}</span>`;

  function orderRow(o, controls) {
    return `<tr><td>${esc(o.productName)}</td><td>${esc(o.buyerName)}<br><small>${o.buyerType === "business" ? "Business" : "Local"} buyer</small></td>
      <td>${o.qty}</td><td>${peso(o.total)}</td><td>${pillFor(o.status)}</td>${controls ? `<td class="row-actions">${controls(o)}</td>` : ""}</tr>`;
  }

  function render() {
    const vs = Auth.currentUser() || me, vst = vs.vendorStatus || "approved";
    $("vendorBanner").hidden = vst === "approved";
    $("vendorBanner").textContent = vst === "pending" ? "Your seller account is waiting for admin approval. You can't list products until it is approved."
      : vst === "rejected" ? "Your seller registration was rejected." + (vs.vendorNote ? " Reason: " + vs.vendorNote : "") + " Please contact an administrator." : "";
    const prods = mine(), orders = myOrders();
    const done = orders.filter(o => o.status === "completed");
    const total = done.reduce((s, o) => s + o.total, 0);

    $("stats").innerHTML = [
      [prods.length, "Products listed"], [prods.filter(p => p.qty > 0).length, "Available products"],
      [prods.filter(p => p.qty === 0).length, "Sold out"], [orders.filter(o => o.status === "pending").length, "Pending orders"],
      [peso(total), "Total sales"]
    ].map(([n, l]) => `<div class="stat-card"><strong>${n}</strong><span>${l}</span></div>`).join("");

    $("recentOrders").innerHTML = table(["Product", "Buyer", "Qty", "Total", "Status"],
      orders.slice(-5).reverse().map(o => orderRow(o)), "No orders yet.");

    $("productTable").innerHTML = table(["", "Product", "Category", "Freshness", "Price", "Left", ""],
      prods.map(p => `<tr><td>${p.image ? `<img src="${esc(p.image)}" alt="">` : "🥬"}</td>
        <td><b>${esc(p.name)}</b><br><small>${esc(p.description || "")}</small></td><td>${esc(p.category)}<br><span class="pill ${(p.status||"approved")==="approved"?"":"warn"}">${esc(p.status||"approved")}</span></td>
        <td><span class="pill ${p.freshness === "Fresh" ? "" : "warn"}">${esc(p.freshness)}</span></td>
        <td>${peso(price(p))}/${esc(p.unit)}${price(p) < p.price ? `<br><s>${peso(p.price)}</s>` : ""}</td><td>${p.qty}</td>
        <td class="row-actions"><button class="btn-sm" data-act="edit" data-id="${p.id}">Edit</button>
        <button class="btn-sm ghost" data-act="disc" data-id="${p.id}">Discount</button>
        <button class="btn-sm danger" data-act="del" data-id="${p.id}">Delete</button></td></tr>`),
      "You have no products yet. Use “Add Product” to list your first one.");

    $("orderTable").innerHTML = table(["Product", "Buyer", "Qty", "Total", "Status", "Actions"],
      orders.slice().reverse().map(o => orderRow(o, x => x.status === "pending"
        ? `<button class="btn-sm" data-oact="accepted" data-id="${x.id}">Accept</button><button class="btn-sm danger" data-oact="rejected" data-id="${x.id}">Reject</button>`
        : x.status === "rejected" ? "—" : `<select data-ostatus="${x.id}">${STATUS.slice(1, 5).map(s => `<option ${s === x.status ? "selected" : ""}>${s}</option>`).join("")}</select>`)),
      "No orders yet.");

    $("salesStats").innerHTML = [[peso(total), "Total sales"], [done.length, "Completed orders"],
      [done.reduce((s, o) => s + o.qty, 0), "Items sold"]].map(([n, l]) => `<div class="stat-card"><strong>${n}</strong><span>${l}</span></div>`).join("");
    $("salesTable").innerHTML = table(["Product", "Buyer", "Qty", "Total", "Status"], done.map(o => orderRow(o)), "No completed sales yet.");
  }

  /* ---------- 5. PRODUCT ACTIONS ---------- */
  function resetForm() {
    $("pForm").reset(); $("pId").value = ""; $("imgPrev").hidden = true; $("imgPrev").removeAttribute("src");
    $("formTitle").textContent = "Add product"; $("formErr").textContent = "";
  }
  $("cancelEdit").addEventListener("click", resetForm);

  // Shrinks images so they fit in localStorage (a real backend would store files instead).
  $("pImg").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 500 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = img.width * s; c.height = img.height * s;
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        $("imgPrev").src = c.toDataURL("image/jpeg", 0.7); $("imgPrev").hidden = false;
      };
      img.src = r.result;
    };
    r.readAsDataURL(f);
  });

  $("pForm").addEventListener("submit", e => {
    e.preventDefault();
    const cu = Auth.currentUser(); // re-checked on every save, admins can change this at any time
    if (!cu || (cu.vendorStatus || "approved") !== "approved" || (cu.perms && cu.perms.sell === false)) { $("formErr").textContent = "Your account can't list products right now. Please check with an administrator."; return; }
    const p = Number($("pPrice").value), d = Number($("pDisc").value), q = Number($("pQty").value);
    const err = !$("pName").value.trim() ? "Enter a product name." : !(p > 0) ? "Enter the original price."
      : d && d >= p ? "The discounted price must be lower than the original price." : $("pQty").value === "" || q < 0 ? "Enter the quantity available." : "";
    if (err) { $("formErr").textContent = err; return; }
    const all = repo.products.all(), id = $("pId").value;
    const data = { name: $("pName").value.trim(), category: $("pCat").value, freshness: $("pFresh").value, unit: $("pUnit").value,
      price: p, discountPrice: d || null, qty: q, description: $("pDesc").value.trim(), image: $("imgPrev").hidden ? "" : $("imgPrev").src };
    if (id) Object.assign(all.find(x => x.id === id && x.sellerId === me.id) || {}, data);
    else all.push({ id: "p_" + Date.now().toString(36), sellerId: me.id, sellerName: me.fullName, status: "pending", createdAt: new Date().toISOString(), ...data });
    repo.products.save(all);
    toast(id ? "Product updated" : "Product added"); resetForm(); go("products");
  });

  $("productTable").addEventListener("click", e => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const all = repo.products.all(), p = all.find(x => x.id === b.dataset.id && x.sellerId === me.id); if (!p) return;
    if (b.dataset.act === "del" && confirm("Delete “" + p.name + "”?")) { repo.products.save(all.filter(x => x !== p)); toast("Product deleted"); render(); }
    if (b.dataset.act === "disc") {
      const v = prompt("Discounted price in ₱ for " + p.name + " (original " + p.price + "). Leave empty to remove the discount:", p.discountPrice || "");
      if (v === null) return;
      const n = Number(v);
      if (v.trim() && !(n > 0 && n < p.price)) return toast("Discount must be lower than the original price");
      p.discountPrice = v.trim() ? n : null; repo.products.save(all); toast("Discount updated"); render();
    }
    if (b.dataset.act === "edit") {
      go("add"); $("formTitle").textContent = "Edit product"; $("pId").value = p.id;
      $("pName").value = p.name; $("pCat").value = p.category; $("pFresh").value = p.freshness; $("pUnit").value = p.unit;
      $("pPrice").value = p.price; $("pDisc").value = p.discountPrice || ""; $("pQty").value = p.qty; $("pDesc").value = p.description || "";
      if (p.image) { $("imgPrev").src = p.image; $("imgPrev").hidden = false; }
    }
  });

  /* ---------- 6. ORDER ACTIONS ---------- */
  function setStatus(id, status) {
    const all = repo.orders.all(), o = all.find(x => x.id === id && x.sellerId === me.id); if (!o) return;
    if (status === "rejected" && o.status !== "rejected" && !o.demo) { const ps = repo.products.all(), pr = ps.find(x => x.id === o.productId); if (pr) { pr.qty += o.qty; repo.products.save(ps); } }
    o.status = status; repo.orders.save(all); toast("Order " + status); render();
  }
  $("orderTable").addEventListener("click", e => { const b = e.target.closest("[data-oact]"); if (b) setStatus(b.dataset.id, b.dataset.oact); });
  $("orderTable").addEventListener("change", e => { if (e.target.dataset.ostatus) setStatus(e.target.dataset.ostatus, e.target.value); });
  $("demoOrder").addEventListener("click", () => {
    const prods = mine(); if (!prods.length) return toast("Add a product first");
    const p = prods[Math.floor(Math.random() * prods.length)], qty = 1 + Math.floor(Math.random() * 3), biz = Math.random() > .5;
    const all = repo.orders.all();
    all.push({ id: "o_" + Date.now().toString(36), sellerId: me.id, productId: p.id, productName: p.name, qty, total: qty * price(p),
      buyerName: biz ? "Demo Restaurant" : "Demo Household", buyerType: biz ? "business" : "local", status: "pending", demo: true, createdAt: new Date().toISOString() });
    repo.orders.save(all); toast("Demo order added"); render();
  });

  render();
})();
