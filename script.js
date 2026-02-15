// ===== Router =====
const pages = document.querySelectorAll('.page');
const links = document.querySelectorAll('.nav a');
function showPage(hash){
if(!hash) hash = '#home';
pages.forEach(p => p.classList.toggle('active', ('#' + p.id) === hash));
links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === hash));
}
window.addEventListener('hashchange', () => showPage(location.hash));
showPage(location.hash);

// ===== Transactions: Add -> Table + Storage =====
const form = document.getElementById('txn-form');
const tbody = document.getElementById('tx-list');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportCsvBtn');
const importBtn = document.getElementById('importCsvBtn');

// Use localStorage to persist
const STORAGE_KEY = 'finsight_txns_v1';

/** Load/save helpers */
function loadTxns(){
try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}catch{ return []; }
}
function saveTxns(list){
localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** App state */
let txns = loadTxns();

/** Currency formatter */
const fmtCurrency = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' });

/** Render table from state */
function renderTable(){
if(!tbody) return;
tbody.innerHTML = '';
// newest first by date
const rows = [...txns].sort((a,b) => (b.date||'').localeCompare(a.date||'')); 
for(const t of rows){
    const tr = document.createElement('tr');
    tr.dataset.id = String(t.id);
    tr.innerHTML = `
    <td>${t.date || ''}</td>
    <td>${cap((t.type||'').toString())}</td>
    <td>${t.category || ''}</td>
    <td>${fmtCurrency.format(Number(t.amount||0))}</td>
    <td>${escapeHtml(t.note || '')}</td>
    <td><button class="icon-danger" title="Delete" data-action="del">
            <span class="material-symbols-outlined">close</span>
        </button></td>
    `;
    tbody.appendChild(tr);
}
}

/** Add a transaction from the form */
form?.addEventListener('submit', (e) => {
e.preventDefault();
const date = document.getElementById('date').value;
const type = document.getElementById('type').value;
const category = document.getElementById('category').value || 'Other';
const amount = document.getElementById('amount').value;
const note = document.getElementById('note').value;

if(!date || !type || !amount){ return; }

const txn = {
    id: Date.now(), // simple id
    date,
    type,          // 'expense' | 'income'
    category,
    amount: Number(amount),
    note
};
txns.push(txn);
saveTxns(txns);
renderTable();
updateDashboard(); // <— keep Home in sync
form.reset();
// keep today's date selected (optional nicety)
document.getElementById('date').valueAsDate = new Date();
});

/** Delete handler via event delegation */
tbody?.addEventListener('click', (e) => {
const btn = e.target.closest('button[data-action="del"]');
if(!btn) return;
const tr = btn.closest('tr');
const id = Number(tr?.dataset.id);
if(!id) return;
txns = txns.filter(t => t.id !== id);
saveTxns(txns);
renderTable();
updateDashboard(); // <— keep Home in sync
});

/** Reset data button */
resetBtn?.addEventListener('click', () => {
if(confirm('Clear all transactions?')){
    txns = [];
    saveTxns(txns);
    renderTable();
    updateDashboard(); // <— keep Home in sync
}
});

/** (Optional) Export CSV */
exportBtn?.addEventListener('click', () => {
if(!txns.length){ alert('No transactions to export.'); return; }
const header = ['date','type','category','amount','note'];
const lines = [header.join(',')].concat(
    txns.map(t => [
    t.date,
    t.type,
    csvEscape(t.category||''),
    t.amount,
    csvEscape(t.note||'')
    ].join(','))
);
const blob = new Blob([lines.join('\n')], {type:'text/csv'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'transactions.csv';
a.click();
URL.revokeObjectURL(url);
});

/** (Optional) Import CSV (very basic) */
importBtn?.addEventListener('click', async () => {
const input = document.createElement('input');
input.type = 'file';
input.accept = '.csv,text/csv';
input.onchange = async () => {
    const file = input.files?.[0];
    if(!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const [head, ...rows] = lines;
    const cols = head.split(',').map(s=>s.trim().toLowerCase());
    const idx = {
    date: cols.indexOf('date'),
    type: cols.indexOf('type'),
    category: cols.indexOf('category'),
    amount: cols.indexOf('amount'),
    note: cols.indexOf('note'),
    };
    for(const r of rows){
    const parts = splitCsv(r);
    if(idx.date<0 || idx.type<0 || idx.amount<0) continue;
    txns.push({
        id: Date.now() + Math.random(),
        date: parts[idx.date] || '',
        type: (parts[idx.type] || 'expense').toLowerCase(),
        category: parts[idx.category] || 'Other',
        amount: Number(parts[idx.amount] || 0),
        note: parts[idx.note] || ''
    });
    }
    saveTxns(txns);
    renderTable();
    updateDashboard(); // <— keep Home in sync
};
input.click();
});

// ===== Helpers =====
function cap(s){ return (s||'').charAt(0).toUpperCase() + (s||'').slice(1); }
function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function csvEscape(s){ if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`; return s; }
function splitCsv(line){
const out=[]; let cur=''; let q=false;
for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"' ){ if(q && line[i+1]==='"'){ cur+='"'; i++; } else { q=!q; } }
    else if(ch===',' && !q){ out.push(cur); cur=''; }
    else { cur+=ch; }
}
out.push(cur);
return out.map(s=>s.trim());
}

// ===== Dashboard (Home) – KPIs + Charts (NEW) =====
let pieChart = null;
let barChart = null;

function monthKey(iso){
if(!iso) return 'Unknown';
const [y,m] = iso.split('-');
if(!y || !m) return 'Unknown';
return `${y}-${m}`;
}

function aggregate(list){
const out = {
    incomeTotal: 0,
    expenseTotal: 0,
    expenseByCat: new Map(),
    monthly: new Map(), // "YYYY-MM" -> {inc, exp}
};

for(const t of list){
    const amt = Number(t.amount||0);
    const mkey = monthKey(t.date);
    if(!out.monthly.has(mkey)) out.monthly.set(mkey, {inc:0, exp:0});

    if((t.type||'expense').toLowerCase() === 'income'){
    out.incomeTotal += amt;
    out.monthly.get(mkey).inc += amt;
    }else{
    out.expenseTotal += amt;
    out.monthly.get(mkey).exp += amt;
    const cat = (t.category || 'Other');
    out.expenseByCat.set(cat, (out.expenseByCat.get(cat)||0) + amt);
    }
}

return out;
}

function renderKPIs(){
const { incomeTotal, expenseTotal } = aggregate(txns);
const net = incomeTotal - expenseTotal;

const elInc = document.getElementById('kpi-income');
const elExp = document.getElementById('kpi-expenses');
const elNet = document.getElementById('kpi-net');

if(elInc) elInc.textContent = fmtCurrency.format(incomeTotal);
if(elExp) elExp.textContent = fmtCurrency.format(expenseTotal);
if(elNet) elNet.textContent = fmtCurrency.format(net);
}

function renderPie(){
const ctx = document.getElementById('pie-expenses');
if(!ctx) return;

const { expenseByCat } = aggregate(txns);
const labels = [...expenseByCat.keys()];
const data = [...expenseByCat.values()];

if(pieChart) pieChart.destroy();

pieChart = new Chart(ctx, {
    type: 'pie',
    data: {
    labels,
    datasets: [{ data }]
    },
    options: {
    plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: {
        label: (ctx) => `${ctx.label}: ${fmtCurrency.format(ctx.parsed)}`
        }}
    }
    }
});
}

function renderBar(){
const ctx = document.getElementById('bar-monthly');
if(!ctx) return;

const { monthly } = aggregate(txns);
const sortedKeys = [...monthly.keys()].sort(); // chronological
const inc = sortedKeys.map(k => monthly.get(k).inc);
const exp = sortedKeys.map(k => monthly.get(k).exp);

if(barChart) barChart.destroy();

barChart = new Chart(ctx, {
    type: 'bar',
    data: {
    labels: sortedKeys,
    datasets: [
        { label: 'Income', data: inc },
        { label: 'Expense', data: exp }
    ]
    },
    options: {
    responsive: true,
    plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: {
        label: (ctx) => `${ctx.dataset.label}: ${fmtCurrency.format(ctx.parsed.y||0)}`
        }}
    },
    scales: {
        y: {
        beginAtZero: true,
        ticks: {
            callback: (v) => fmtCurrency.format(v)
        }
        }
    }
    }
});
}

function updateDashboard(){
renderKPIs();
renderPie();
renderBar();
}

// Initial table + dashboard render + default date in form
renderTable();
updateDashboard();
const dateInput = document.getElementById('date');
if(dateInput && !dateInput.value) dateInput.valueAsDate = new Date();
