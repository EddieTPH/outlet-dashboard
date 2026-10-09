import "./style.css";

const OUTLETS = ["All", "Tampines", "Jurong", "Orchard"];
const THRESHOLD = 0.9;

/* ---------- Data loading: the ONLY place that knows where data comes from ----------
   Resolves to an array of { outlet, week, sales, target, orders, returns }.
   Reads the outlet_weeks table in Supabase over its REST API (no library needed).
   Config comes from Vite env variables (set them in .env locally and in Vercel):
     VITE_SUPABASE_URL, VITE_SUPABASE_KEY (the publishable / anon key).
   The publishable key is safe in the browser ONLY because the table has row-level
   security with a read-only (select) policy.
------------------------------------------------------------------------------- */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

async function loadData() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_KEY environment variables.");
  }
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/outlet_weeks?select=outlet,week,sales,target,orders,returns&order=id`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.map(r => ({
    outlet: r.outlet, week: r.week,
    sales: Number(r.sales), target: Number(r.target),
    orders: Number(r.orders), returns: Number(r.returns)
  }));
}

/* Offline fallback with the same shape, used when the live load fails. */
async function loadSampleData() {
  const csv = `outlet,week,sales,target,orders,returns
Tampines,2026-09-07,18400,18000,612,9
Tampines,2026-09-14,16100,18000,540,14
Tampines,2026-09-21,19200,18000,640,8
Jurong,2026-09-07,14200,15000,488,11
Jurong,2026-09-14,12600,15000,430,19
Jurong,2026-09-21,15300,15000,512,10
Orchard,2026-09-07,22500,24000,690,12
Orchard,2026-09-14,20100,24000,612,21
Orchard,2026-09-21,24800,24000,742,9`;
  const [head, ...lines] = csv.trim().split("\n");
  const keys = head.split(",");
  return lines.map(l => {
    const v = l.split(",");
    const r = {};
    keys.forEach((k, i) => r[k] = i < 2 ? v[i] : Number(v[i]));
    return r;
  });
}

let ROWS = [], current = "All";
const $ = id => document.getElementById(id);
const money = n => "$" + n.toLocaleString("en-SG");
const fmtWeek = w => new Date(w + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function render() {
  const rows = current === "All" ? ROWS : ROWS.filter(r => r.outlet === current);
  const sum = k => rows.reduce((a, r) => a + r[k], 0);
  const sales = sum("sales"), target = sum("target"), orders = sum("orders"), ret = sum("returns");

  $("k-sales").textContent = money(sales);
  $("k-pct").textContent = target ? (sales / target * 100).toFixed(1) + "%" : "–";
  $("k-orders").textContent = orders.toLocaleString("en-SG");
  $("k-ret").textContent = orders ? (ret / orders * 100).toFixed(1) + "%" : "–";

  // Chart: scale 0–120% of target
  const MAX = 1.2;
  $("chart").innerHTML = rows.map(r => {
    const p = r.sales / r.target, low = p < THRESHOLD;
    return `<div class="col" title="${r.outlet}, ${r.week}: ${money(r.sales)} of ${money(r.target)}">
      <div class="pct ${low ? "low" : ""}">${(p * 100).toFixed(0)}%</div>
      <div class="bar ${low ? "low" : ""}" style="height:${Math.min(p / MAX, 1) * 85}%"></div></div>`;
  }).join("") + `<div class="line90" style="bottom:${THRESHOLD / MAX * 85}%"><span>90%</span></div>`;
  $("labels").innerHTML = rows.map(r => `<div><b>${current === "All" ? r.outlet : fmtWeek(r.week)}</b>${current === "All" ? fmtWeek(r.week) : ""}</div>`).join("");

  // Needs attention, worst first
  const low = rows.filter(r => r.sales / r.target < THRESHOLD)
                  .sort((a, b) => a.sales / a.target - b.sales / b.target);
  $("attn").innerHTML = low.length ? low.map(r => `
    <li><div><div class="o">${r.outlet}</div><div class="w">Week of ${fmtWeek(r.week)}</div></div>
    <div class="r"><div class="p">${(r.sales / r.target * 100).toFixed(1)}%</div>
    <div class="g">${money(r.target - r.sales)} short</div></div></li>`).join("")
    : `<div class="empty">Nothing under 90%. 🎉</div>`;
}

function setupFilters() {
  $("filters").innerHTML = OUTLETS.map(o => `<button data-o="${o}" class="${o === current ? "on" : ""}">${o}</button>`).join("");
  $("filters").onclick = e => {
    const o = e.target.dataset.o;
    if (!o) return;
    current = o;
    [...$("filters").children].forEach(b => b.classList.toggle("on", b.dataset.o === o));
    render();
  };
}

function showBanner(html) {
  $("banner").innerHTML = html;
  $("banner").hidden = false;
}

async function init() {
  $("banner").hidden = true;
  try {
    ROWS = await loadData();
  } catch (err) {
    console.error("Supabase load failed:", err);
    // A TypeError ("Failed to fetch") means the browser never reached Supabase.
    const reason = err instanceof TypeError
      ? "The browser couldn't reach Supabase (network, firewall, ad-blocker or a sandboxed preview is blocking it)."
      : err.message;
    ROWS = await loadSampleData();
    showBanner(`<b>Showing sample data, not live data.</b> ${reason} <button id="retry">Retry</button>`);
    $("retry").onclick = init;
  }
  const weeks = ROWS.map(r => r.week).sort();
  $("range").textContent = `Weeks of ${fmtWeek(weeks[0])} – ${fmtWeek(weeks[weeks.length - 1])}`;
  setupFilters();
  render();
}

init();
