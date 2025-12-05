/**
 * main.js
 * Handles data fetching, UI rendering, and navigation interactions.
 */

// --- 1. Core Utilities ----------------------------------------------

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("Fetch failed", e);
    renderEmptyState("list-panel", `Connection Error: ${e.message}`);
    return [];
  }
}

async function updateAnalytics() {
  try {
    const [poData, invData, grnData, reconData] = await Promise.all([
      fetchJSON("/api/purchase_orders"),
      fetchJSON("/api/invoices"),
      fetchJSON("/api/goods_receipts"),
      fetchJSON("/api/reconciliation")
    ]);

    // Document counts
    document.getElementById('stat-po').textContent = `${poData.length} PO`;
    document.getElementById('stat-inv').textContent = `${invData.length} INV`;
    document.getElementById('stat-grn').textContent = `${grnData.length} GRN`;

    // Reconciliation status counts
    const matched = reconData.filter(r => r.status === 'matched').length;
    const issues = reconData.filter(r => r.status !== 'matched').length;
    
    document.getElementById('stat-matched').textContent = `${matched} Matched`;
    document.getElementById('stat-issues').textContent = `${issues} Issues`;

    // Decision counts
    const approved = reconData.filter(r => r.decision?.decision === 'approved').length;
    const rejected = reconData.filter(r => r.decision?.decision === 'rejected').length;
    const pending = reconData.filter(r => !r.decision).length;
    
    document.getElementById('stat-approved').textContent = `${approved} Approved`;
    document.getElementById('stat-rejected').textContent = `${rejected} Rejected`;
    document.getElementById('stat-pending').textContent = `${pending} Pending`;

    // Show analytics bar
    document.getElementById('analytics-bar').classList.remove('hidden');
  } catch (e) {
    console.error("Failed to update analytics", e);
  }
}

const formatCurrency = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined) return '-';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch (e) {
    return `${amount} ${currency}`;
  }
};

// --- 2. UI Component Builders ---------------------------------------

function updateHeader(title, count) {
  document.getElementById("page-title").textContent = title;
  document.getElementById("page-count").textContent = `${count} records`;
}

function renderEmptyState(panelId, message) {
  const el = document.getElementById(panelId);
  el.innerHTML = `
    <div class="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center">
      <span class="text-sm font-medium">${message}</span>
    </div>`;
}

function statusBadge(status) {
  // Normalize status string
  const cleanStatus = (status || "unknown").toLowerCase();
  const label = cleanStatus.replace(/_/g, " ").toUpperCase();
  
  const styles = {
    matched: "bg-green-100 text-green-700 ring-1 ring-green-600/20",
    missing_invoice: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
    missing_goods_receipt: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
    amount_mismatch: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
    ghost_po: "bg-purple-50 text-purple-700 ring-1 ring-purple-600/20",
    orphaned_invoice: "bg-orange-50 text-orange-700 ring-1 ring-orange-600/20",
    orphaned_grn: "bg-orange-50 text-orange-700 ring-1 ring-orange-600/20",
    default: "bg-gray-100 text-gray-600 ring-1 ring-gray-600/20"
  };

  const style = styles[cleanStatus] || styles.default;
  return `<span class="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold tracking-wide ${style}">${label}</span>`;
}

function buildMetaGrid(items) {
  // Creates the top data grid in the Detail Pane
  return `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      ${items.map(item => `
        <div class="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <div class="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">${item.label}</div>
          <div class="text-sm font-semibold text-gray-900 truncate" title="${item.value}">${item.value}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function buildTable(headers, rows) {
  // Creates a clean data table
  return `
    <div class="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-6">
      <table class="min-w-full divide-y divide-gray-100">
        <thead class="bg-gray-50">
          <tr>
            ${headers.map(h => `
              <th class="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider ${h.align === 'right' ? 'text-right' : ''}">
                ${h.label}
              </th>`).join('')}
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function buildPDFButton(path) {
  if (!path) {
    return `
      <button disabled class="opacity-50 cursor-not-allowed inline-flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-400">
        No PDF
      </button>`;
  }
  
  return `
    <button onclick="openPdfModal('${encodeURIComponent(path)}')" 
      class="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 hover:border-indigo-300 text-gray-700 rounded-lg text-xs font-semibold transition-all shadow-sm">
      <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"></path></svg>
      View PDF
    </button>
  `;
}

// PDF Modal Controls
window.openPdfModal = (path) => {
  const modal = document.getElementById('pdf-modal');
  const iframe = document.getElementById('pdf-iframe');
  iframe.src = `/api/pdf?path=${path}`;
  modal.classList.remove('hidden');
};

window.closePdfModal = () => {
  const modal = document.getElementById('pdf-modal');
  const iframe = document.getElementById('pdf-iframe');
  iframe.src = '';
  modal.classList.add('hidden');
};

// --- 3. Page Rendering Logic ----------------------------------------

// A. Reconciliation View (Dashboard)
async function renderRecon() {
  updateHeader("Reconciliation Dashboard", "...");
  renderEmptyState("list-panel", "Running 3-way match...");

  const data = await fetchJSON("/api/reconciliation");
  updateHeader("Reconciliation Dashboard", data.length);
  
  // Update analytics
  updateAnalytics();
  
  if (!data.length) return renderEmptyState("list-panel", "No reconciliation tasks found.");

  // Render List
  const listPanel = document.getElementById("list-panel");
  listPanel.innerHTML = data.map((r, idx) => {
    const po = r.po.purchase_order || {};
    
    // Approval status badge
    const approvalStatus = r.decision 
      ? r.decision.decision 
      : 'pending';
    
    const approvalBadgeStyles = {
      approved: "bg-green-50 text-green-700",
      rejected: "bg-red-50 text-red-700",
      pending: "bg-gray-50 text-gray-600"
    };
    
    const approvalBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold tracking-wide uppercase ${approvalBadgeStyles[approvalStatus]}">${approvalStatus}</span>`;
    
    return `
      <div class="list-item group p-5 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-all" data-index="${idx}">
        <div class="flex justify-between items-start mb-3">
          <h3 class="font-bold text-gray-900 text-base">${po.po_number || "Unknown PO"}</h3>
          ${approvalBadge}
        </div>
        <div class="text-sm text-gray-600 mb-3">${(po.vendor && po.vendor.name) || "Unknown Vendor"}</div>
        <div class="flex gap-2 items-center flex-wrap">
          <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] font-semibold bg-gray-50 text-gray-600">INV: ${r.invoices.length}</span>
          <span class="inline-flex items-center px-2.5 py-1 rounded text-[10px] font-semibold bg-gray-50 text-gray-600">GRN: ${r.goods_receipts.length}</span>
          ${statusBadge(r.status)}
        </div>
      </div>
    `;
  }).join("");

  // Setup Interaction
  const rows = document.querySelectorAll(".list-item");
  const select = (idx) => {
    rows.forEach(r => r.classList.remove("active"));
    rows[idx].classList.add("active");
    
    const rec = data[idx];
    const po = rec.po.purchase_order || {};
    const detailPanel = document.getElementById("detail-panel");

    // Issues Section
    const issuesHtml = rec.issues.length 
      ? `<div class="bg-red-50 border border-red-100 rounded-lg p-4 mb-6">
           <h3 class="text-xs font-bold text-red-800 uppercase tracking-wide mb-2 flex items-center gap-2">
             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
             Reconciliation Issues
           </h3>
           <ul class="list-disc pl-5 text-xs text-red-700 space-y-1 font-medium">${rec.issues.map(i => `<li>${i}</li>`).join('')}</ul>
         </div>` 
      : `<div class="bg-green-50 border border-green-100 rounded-lg p-4 mb-6 flex items-center gap-3">
           <div class="bg-green-100 p-1 rounded-full"><svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></div>
           <span class="text-xs font-bold text-green-700">Three-way match successful. Validated against Invoice & GRN.</span>
         </div>`;

    // Helper for linked docs
    const renderRelatedDoc = (doc, type) => {
      const isInv = type === 'inv';
      const docData = isInv ? doc.invoice : doc.goods_receipt;
      const id = isInv ? docData.invoice_number : docData.grn_number;
      const refPO = docData.reference_po;
      const docDate = docData.date;
      const vendorName = docData.vendor?.name || 'Unknown';
      const vendorInitial = vendorName.charAt(0).toUpperCase();
      const items = docData.items || [];
      const itemCount = items.length;
      
      const icon = isInv 
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>';
      
      // Vendor logo or initial badge
      const vendorBadge = docData.vendor?.logo_url
        ? `<img src="${docData.vendor.logo_url}" alt="${vendorName}" class="w-8 h-8 rounded object-cover border border-gray-200">`
        : `<div class="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold text-xs">${vendorInitial}</div>`;

      // Build items list
      const itemsHtml = items.slice(0, 3).map(item => `
        <div class="flex justify-between text-[10px] py-1">
          <span class="text-gray-600 truncate flex-1">${item.description}</span>
          <span class="text-gray-900 font-semibold ml-2">×${item.quantity}</span>
        </div>
      `).join('');
      
      const moreItems = itemCount > 3 ? `<div class="text-[9px] text-gray-400 italic">+${itemCount - 3} more items</div>` : '';

      return `
        <div class="p-3 bg-white border border-gray-100 rounded-lg shadow-sm hover:border-indigo-100 transition-colors">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              ${vendorBadge}
              <div class="bg-indigo-50 text-indigo-600 p-2 rounded-md">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icon}</svg>
              </div>
              <div>
                <div class="text-xs font-bold text-gray-900">${id}</div>
                <div class="text-[10px] text-gray-400 uppercase font-semibold">${isInv ? 'Invoice' : 'Goods Receipt'}</div>
              </div>
            </div>
            <div class="text-right">
               ${isInv ? `<div class="text-xs font-bold text-gray-700">${formatCurrency(docData.grand_total, docData.currency)}</div>` : ''}
               ${docDate ? `<div class="text-[10px] text-gray-400 mt-0.5">${docDate}</div>` : ''}
            </div>
          </div>
          
          <div class="bg-gray-50 rounded-md p-2 mb-2">
            <div class="grid grid-cols-2 gap-2 text-[10px] mb-2">
              <div>
                <span class="text-gray-500">Vendor:</span>
                <div class="font-bold text-gray-900 truncate" title="${vendorName}">${vendorName}</div>
              </div>
              <div>
                <span class="text-gray-500">Ref PO:</span>
                <div class="font-bold text-gray-900">${refPO || '-'}</div>
              </div>
            </div>
            ${isInv ? `
              <div class="grid grid-cols-3 gap-2 text-[10px] pt-2 border-t border-gray-200">
                <div>
                  <span class="text-gray-500">Subtotal:</span>
                  <div class="font-semibold text-gray-900">${formatCurrency(docData.subtotal, docData.currency)}</div>
                </div>
                <div>
                  <span class="text-gray-500">Tax:</span>
                  <div class="font-semibold text-gray-900">${formatCurrency(docData.tax, docData.currency)}</div>
                </div>
                <div>
                  <span class="text-gray-500">Total:</span>
                  <div class="font-bold text-gray-900">${formatCurrency(docData.grand_total, docData.currency)}</div>
                </div>
              </div>
            ` : ''}
          </div>
          
          ${itemCount > 0 ? `
            <div class="bg-gray-50 rounded-md p-2 mb-2">
              <div class="text-[10px] text-gray-400 uppercase font-bold mb-1">Items (${itemCount})</div>
              ${itemsHtml}
              ${moreItems}
            </div>
          ` : ''}
          
          <div class="flex justify-end">
            <button class="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline" 
              onclick="openPdfModal('${encodeURIComponent(doc.source_pdf_path)}')">View PDF</button>
          </div>
        </div>
      `;
    };

    // Build PO items table
    const poItemsHtml = (po.items || []).map(it => `
      <tr>
        <td class="px-4 py-3 text-xs font-medium text-gray-900">${it.description}</td>
        <td class="px-4 py-3 text-xs text-right text-gray-600 font-mono">${it.quantity}</td>
        <td class="px-4 py-3 text-xs text-right text-gray-600 font-mono">${formatCurrency(it.unit_price, po.currency)}</td>
        <td class="px-4 py-3 text-xs text-right text-gray-900 font-mono font-bold">${formatCurrency(it.total, po.currency)}</td>
      </tr>
    `).join("");

    // Decision badge if exists
    const decisionBadge = rec.decision ? `
      <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
        rec.decision.decision === 'approved' 
          ? 'bg-green-100 text-green-700 ring-1 ring-green-600/20' 
          : 'bg-red-100 text-red-700 ring-1 ring-red-600/20'
      }">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          ${rec.decision.decision === 'approved' 
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>'
            : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>'
          }
        </svg>
        ${rec.decision.decision.toUpperCase()}
        <span class="text-[10px] opacity-75">by ${rec.decision.user} at ${new Date(rec.decision.timestamp).toLocaleString()}</span>
      </div>
    ` : '';

    // Vendor logo/initial
    const vendorName = (po.vendor && po.vendor.name) || 'Unknown';
    const vendorInitial = vendorName.charAt(0).toUpperCase();
    const vendorLogo = po.vendor?.logo_url 
      ? `<img src="${po.vendor.logo_url}" alt="${vendorName}" class="w-10 h-10 rounded-lg object-cover border border-gray-200">`
      : `<div class="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">${vendorInitial}</div>`;

    detailPanel.innerHTML = `
      <div class="flex justify-between items-start mb-6">
        <div class="flex gap-4">
          ${vendorLogo}
          <div>
            <div class="flex items-center gap-3 mb-2">
              <h1 class="text-2xl font-bold text-gray-900">${po.po_number || "Unknown PO"}</h1>
              ${statusBadge(rec.status)}
              ${decisionBadge}
            </div>
            <p class="text-sm text-gray-500 font-medium">Vendor: ${vendorName}</p>
            ${rec.decision && rec.decision.comment ? `<p class="text-xs text-gray-500 italic mt-1">Comment: ${rec.decision.comment}</p>` : ''}
          </div>
        </div>
        <div class="flex gap-2 items-center">
          <button onclick="handleReconciliationDecision('${po.po_number}', 'approved')" 
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-semibold transition-all">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            Approve
          </button>
          <button onclick="handleReconciliationDecision('${po.po_number}', 'rejected')" 
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold transition-all">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            Reject
          </button>
          ${buildPDFButton(rec.po.source_pdf_path)}
        </div>
      </div>

      ${issuesHtml}

      ${buildMetaGrid([
        { label: "Date", value: po.date || "-" },
        { label: "Buyer", value: (po.buyer && po.buyer.name) || "-" },
        { label: "Ship To", value: (po.buyer && po.buyer.address) || "See PDF" },
        { label: "Currency", value: po.currency || "-" },
      ])}

      <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Purchase Order Items</h3>
      ${buildTable(
        [ { label: "Description" }, { label: "Qty", align: "right" }, { label: "Unit Price", align: "right" }, { label: "Total", align: "right" } ],
        poItemsHtml
      )}

      <div class="flex justify-end mb-8">
        <div class="w-72 bg-white rounded-lg border border-gray-200 p-6 shadow-sm space-y-3">
          <div class="flex justify-between text-xs font-medium text-gray-500"><span>Subtotal</span> <span>${formatCurrency(po.subtotal, po.currency)}</span></div>
          <div class="flex justify-between text-xs font-medium text-gray-500"><span>Tax</span> <span>${formatCurrency(po.tax, po.currency)}</span></div>
          <div class="pt-3 border-t border-gray-100 flex justify-between text-base font-bold text-gray-900"><span>Total</span> <span>${formatCurrency(po.grand_total, po.currency)}</span></div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Linked Invoices</h3>
          <div class="space-y-2">
            ${rec.invoices.length ? rec.invoices.map(d => renderRelatedDoc(d, 'inv')).join('') : '<div class="text-sm text-gray-400 italic bg-white p-4 rounded border border-dashed border-gray-200">No invoices linked</div>'}
          </div>
        </div>
        <div>
          <h3 class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Linked Goods Receipts</h3>
          <div class="space-y-2">
            ${rec.goods_receipts.length ? rec.goods_receipts.map(d => renderRelatedDoc(d, 'grn')).join('') : '<div class="text-sm text-gray-400 italic bg-white p-4 rounded border border-dashed border-gray-200">No GRNs linked</div>'}
          </div>
        </div>
      </div>
    `;
  };

  rows.forEach((row, idx) => row.addEventListener("click", () => select(idx)));
  if (data.length > 0) select(0);
}

// B. Invoices View
async function renderInvoices() {
  updateHeader("Invoices", "...");
  renderEmptyState("list-panel", "Loading invoices...");
  
  const data = await fetchJSON("/api/invoices");
  updateHeader("Invoices", data.length);
  if (!data.length) return renderEmptyState("list-panel", "No invoices found.");

  const listPanel = document.getElementById("list-panel");
  listPanel.innerHTML = data.map((d, idx) => {
    const inv = d.invoice || {};
    return `
      <div class="list-item group p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer border-l-4 border-l-transparent transition-all" data-index="${idx}">
        <div class="flex justify-between items-start mb-1">
          <span class="font-bold text-gray-900 group-hover:text-indigo-600 text-sm">${inv.invoice_number || "Draft"}</span>
          <span class="text-xs text-gray-500 font-mono font-semibold">${formatCurrency(inv.grand_total, inv.currency)}</span>
        </div>
        <div class="flex justify-between items-end">
          <div class="text-xs text-gray-500">
            <div class="mb-0.5 truncate w-40 font-medium">${(inv.vendor && inv.vendor.name) || "Unknown"}</div>
            <div class="text-[10px] text-gray-400">PO: ${inv.reference_po || "-"}</div>
          </div>
          <span class="text-[10px] text-gray-400 font-medium">${inv.date || ""}</span>
        </div>
      </div>
    `;
  }).join("");

  const rows = document.querySelectorAll(".list-item");
  const select = (idx) => {
    rows.forEach(r => r.classList.remove("active"));
    rows[idx].classList.add("active");
    
    const d = data[idx];
    const inv = d.invoice || {};
    const detailPanel = document.getElementById("detail-panel");

    const itemsHtml = (inv.items || []).map(it => `
      <tr>
        <td class="px-4 py-3 text-xs font-medium text-gray-900">${it.description}</td>
        <td class="px-4 py-3 text-xs text-right text-gray-600 font-mono">${it.quantity}</td>
        <td class="px-4 py-3 text-xs text-right text-gray-600 font-mono">${formatCurrency(it.unit_price, inv.currency)}</td>
        <td class="px-4 py-3 text-xs text-right text-gray-900 font-mono font-bold">${formatCurrency(it.total, inv.currency)}</td>
      </tr>
    `).join("");

    detailPanel.innerHTML = `
      <div class="flex justify-between items-start mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">${inv.invoice_number || "Draft Invoice"}</h1>
          <p class="text-sm text-gray-500 font-medium">Issued by ${(inv.vendor && inv.vendor.name)}</p>
        </div>
        ${buildPDFButton(d.source_pdf_path)}
      </div>

      ${buildMetaGrid([
        { label: "Ref PO", value: inv.reference_po || "-" },
        { label: "Date", value: inv.date || "-" },
        { label: "Tax Rate", value: inv.tax_rate ? (inv.tax_rate * 100).toFixed(0) + '%' : '-' },
        { label: "Currency", value: inv.currency || "-" },
      ])}

      ${buildTable(
        [ { label: "Description" }, { label: "Qty", align: "right" }, { label: "Unit Price", align: "right" }, { label: "Total", align: "right" } ],
        itemsHtml
      )}

      <div class="flex justify-end">
        <div class="w-72 bg-white rounded-lg border border-gray-200 p-6 shadow-sm space-y-3">
          <div class="flex justify-between text-xs font-medium text-gray-500"><span>Subtotal</span> <span>${formatCurrency(inv.subtotal, inv.currency)}</span></div>
          <div class="flex justify-between text-xs font-medium text-gray-500"><span>Tax</span> <span>${formatCurrency(inv.tax, inv.currency)}</span></div>
          <div class="pt-3 border-t border-gray-100 flex justify-between text-base font-bold text-gray-900"><span>Total</span> <span>${formatCurrency(inv.grand_total, inv.currency)}</span></div>
        </div>
      </div>
    `;
  };

  rows.forEach((row, idx) => row.addEventListener("click", () => select(idx)));
  if (data.length > 0) select(0);
}

// C. Purchase Orders View
async function renderPO() {
  updateHeader("Purchase Orders", "...");
  renderEmptyState("list-panel", "Loading POs...");

  const data = await fetchJSON("/api/purchase_orders");
  updateHeader("Purchase Orders", data.length);
  if (!data.length) return renderEmptyState("list-panel", "No POs found.");

  const listPanel = document.getElementById("list-panel");
  listPanel.innerHTML = data.map((d, idx) => {
    const po = d.purchase_order || {};
    return `
      <div class="list-item group p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer border-l-4 border-l-transparent transition-all" data-index="${idx}">
        <div class="flex justify-between items-start mb-1">
          <span class="font-bold text-gray-900 group-hover:text-indigo-600 text-sm">${po.po_number || "Draft"}</span>
          <span class="text-xs text-gray-500 font-mono font-semibold">${formatCurrency(po.grand_total, po.currency)}</span>
        </div>
        <div class="flex justify-between items-end">
          <div class="text-xs text-gray-500 font-medium truncate w-40">${(po.vendor && po.vendor.name) || "Unknown Vendor"}</div>
          <span class="text-[10px] text-gray-400 font-medium">${po.date || ""}</span>
        </div>
      </div>
    `;
  }).join("");

  const rows = document.querySelectorAll(".list-item");
  const select = (idx) => {
    rows.forEach(r => r.classList.remove("active"));
    rows[idx].classList.add("active");
    
    const d = data[idx];
    const po = d.purchase_order || {};
    const detailPanel = document.getElementById("detail-panel");

    const itemsHtml = (po.items || []).map(it => `
      <tr>
        <td class="px-4 py-3 text-xs font-medium text-gray-900">${it.description}</td>
        <td class="px-4 py-3 text-xs text-right text-gray-600 font-mono">${it.quantity}</td>
        <td class="px-4 py-3 text-xs text-right text-gray-600 font-mono">${formatCurrency(it.unit_price, po.currency)}</td>
        <td class="px-4 py-3 text-xs text-right text-gray-900 font-mono font-bold">${formatCurrency(it.total, po.currency)}</td>
      </tr>
    `).join("");

    detailPanel.innerHTML = `
      <div class="flex justify-between items-start mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">${po.po_number || "Draft PO"}</h1>
          <p class="text-sm text-gray-500 font-medium">Vendor: ${(po.vendor && po.vendor.name)}</p>
        </div>
        ${buildPDFButton(d.source_pdf_path)}
      </div>

      ${buildMetaGrid([
        { label: "Date", value: po.date || "-" },
        { label: "Buyer", value: (po.buyer && po.buyer.name) || "-" },
        { label: "Ship To", value: (po.buyer && po.buyer.address) || "See PDF" },
        { label: "Currency", value: po.currency || "-" },
      ])}

      ${buildTable(
        [ { label: "Description" }, { label: "Qty", align: "right" }, { label: "Unit Price", align: "right" }, { label: "Total", align: "right" } ],
        itemsHtml
      )}

      <div class="flex justify-end">
        <div class="w-72 bg-white rounded-lg border border-gray-200 p-6 shadow-sm space-y-3">
          <div class="flex justify-between text-xs font-medium text-gray-500"><span>Subtotal</span> <span>${formatCurrency(po.subtotal, po.currency)}</span></div>
          <div class="flex justify-between text-xs font-medium text-gray-500"><span>Tax</span> <span>${formatCurrency(po.tax, po.currency)}</span></div>
          <div class="pt-3 border-t border-gray-100 flex justify-between text-base font-bold text-gray-900"><span>Total</span> <span>${formatCurrency(po.grand_total, po.currency)}</span></div>
        </div>
      </div>
    `;
  };

  rows.forEach((row, idx) => row.addEventListener("click", () => select(idx)));
  if (data.length > 0) select(0);
}

// D. Goods Receipts View
async function renderGRN() {
  updateHeader("Goods Receipts", "...");
  renderEmptyState("list-panel", "Loading GRNs...");

  const data = await fetchJSON("/api/goods_receipts");
  updateHeader("Goods Receipts", data.length);
  if (!data.length) return renderEmptyState("list-panel", "No GRNs found.");

  const listPanel = document.getElementById("list-panel");
  listPanel.innerHTML = data.map((d, idx) => {
    const grn = d.goods_receipt || {};
    return `
      <div class="list-item group p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer border-l-4 border-l-transparent transition-all" data-index="${idx}">
        <div class="flex justify-between items-start mb-1">
          <span class="font-bold text-gray-900 group-hover:text-indigo-600 text-sm">${grn.grn_number || "Draft"}</span>
        </div>
        <div class="flex justify-between items-end">
          <div class="text-xs text-gray-500">
            <div class="mb-0.5 font-medium truncate w-40">${(grn.vendor && grn.vendor.name) || "Unknown"}</div>
            <div class="text-[10px] text-gray-400">PO: ${grn.reference_po || "-"}</div>
          </div>
          <span class="text-[10px] text-gray-400 font-medium">${grn.date || ""}</span>
        </div>
      </div>
    `;
  }).join("");

  const rows = document.querySelectorAll(".list-item");
  const select = (idx) => {
    rows.forEach(r => r.classList.remove("active"));
    rows[idx].classList.add("active");
    
    const d = data[idx];
    const grn = d.goods_receipt || {};
    const detailPanel = document.getElementById("detail-panel");

    const itemsHtml = (grn.items || []).map(it => `
      <tr>
        <td class="px-4 py-3 text-xs font-medium text-gray-900">${it.description}</td>
        <td class="px-4 py-3 text-xs text-right text-gray-600 font-mono">${it.quantity}</td>
        <td class="px-4 py-3 text-xs text-right"><span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 uppercase tracking-wide">${it.status || "Received"}</span></td>
      </tr>
    `).join("");

    detailPanel.innerHTML = `
      <div class="flex justify-between items-start mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">${grn.grn_number || "Draft GRN"}</h1>
          <p class="text-sm text-gray-500 font-medium">Ref PO: ${grn.reference_po}</p>
        </div>
        ${buildPDFButton(d.source_pdf_path)}
      </div>

      ${buildMetaGrid([
        { label: "Received Date", value: grn.date || "-" },
        { label: "Vendor", value: (grn.vendor && grn.vendor.name) || "-" },
        { label: "Receiver", value: (grn.buyer && grn.buyer.name) || "-" },
        { label: "Items Count", value: (grn.items && grn.items.length) || 0 },
      ])}

      ${buildTable(
        [ { label: "Description" }, { label: "Qty Recvd", align: "right" }, { label: "Inspection Status", align: "right" } ],
        itemsHtml
      )}
    `;
  };

  rows.forEach((row, idx) => row.addEventListener("click", () => select(idx)));
  if (data.length > 0) select(0);
}

// --- 4. Reconciliation Decision Handler ----------------------------

let pendingDecision = null;

window.handleReconciliationDecision = (poNumber, decision) => {
  // Store decision details
  pendingDecision = { poNumber, decision };
  
  // Update modal title and button
  const modal = document.getElementById('comment-modal');
  const modalTitle = document.getElementById('modal-title');
  const submitBtn = document.getElementById('modal-submit-btn');
  const commentInput = document.getElementById('comment-input');
  
  modalTitle.textContent = `${decision === 'approved' ? 'Approve' : 'Reject'} ${poNumber}`;
  submitBtn.textContent = decision === 'approved' ? 'Approve' : 'Reject';
  submitBtn.className = `flex-1 px-4 py-2 rounded-lg font-medium text-sm text-white ${
    decision === 'approved' 
      ? 'bg-green-600 hover:bg-green-700' 
      : 'bg-red-600 hover:bg-red-700'
  }`;
  
  // Clear previous comment and show modal
  commentInput.value = '';
  modal.classList.remove('hidden');
  commentInput.focus();
};

window.closeCommentModal = () => {
  document.getElementById('comment-modal').classList.add('hidden');
  pendingDecision = null;
};

window.submitDecision = async () => {
  if (!pendingDecision) return;
  
  const comment = document.getElementById('comment-input').value.trim();
  const { poNumber, decision } = pendingDecision;
  
  // Close modal
  closeCommentModal();
  
  try {
    const response = await fetch('/api/reconciliation/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        po_number: poNumber,
        decision: decision,
        comment: comment || ''
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save decision: ${response.status}`);
    }
    
    const result = await response.json();
    
    // Show success toast
    showToast(`✓ Reconciliation ${decision} for ${poNumber}`, 'success');
    
    // Refresh the reconciliation view and analytics
    renderRecon();
    
  } catch (error) {
    console.error('Error saving decision:', error);
    showToast(`Failed to save decision: ${error.message}`, 'error');
  }
};

// Toast notification helper
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium text-sm z-50 transform transition-all ${
    type === 'success' ? 'bg-green-600' : 'bg-red-600'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- 5. Sidebar Toggle ---------------------------------------------

window.toggleSidebar = () => {
  const sidebar = document.getElementById('sidebar');
  const sidebarTitle = document.getElementById('sidebar-title');
  const sidebarIcon = document.getElementById('sidebar-icon');
  const navTexts = document.querySelectorAll('.nav-text');
  const navLabels = document.querySelectorAll('.nav-label');
  
  const isCollapsed = sidebar.classList.contains('w-16');
  
  if (isCollapsed) {
    // Expand
    sidebar.classList.remove('w-16');
    sidebar.classList.add('w-64');
    sidebarTitle.classList.remove('hidden');
    navTexts.forEach(el => el.classList.remove('hidden'));
    navLabels.forEach(el => el.classList.remove('hidden'));
    sidebarIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"></path>';
  } else {
    // Collapse
    sidebar.classList.remove('w-64');
    sidebar.classList.add('w-16');
    sidebarTitle.classList.add('hidden');
    navTexts.forEach(el => el.classList.add('hidden'));
    navLabels.forEach(el => el.classList.add('hidden'));
    sidebarIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path>';
  }
};

// --- 6. Navigation & Initialization ---------------------------------

window.triggerNav = (type) => {
  // Update UI Sidebar
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active', 'border-indigo-500', 'bg-gray-800', 'text-white'));
  const btn = document.getElementById(`nav-${type}`);
  if(btn) btn.classList.add('active');

  // Route
  if (type === 'recon') renderRecon();
  if (type === 'po') renderPO();
  if (type === 'grn') renderGRN();
  if (type === 'invoice') renderInvoices();
};

// Initialize app
window.addEventListener("DOMContentLoaded", () => {
  triggerNav('recon'); // Default View
});