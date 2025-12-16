/**
 * Export Service - PDF and Print functionality
 * Provides methods to export law data, comparisons, and checklists
 */

// Generate printable HTML content
function generatePrintableHTML(title, content, metadata = {}) {
  const date = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          padding: 40px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          border-bottom: 3px solid #f97316;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          font-size: 24px;
          color: #111827;
          margin-bottom: 8px;
        }
        .header .meta {
          font-size: 12px;
          color: #6b7280;
        }
        .header .framework-badge {
          display: inline-block;
          padding: 4px 12px;
          background: #fef3c7;
          color: #92400e;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          margin-top: 10px;
        }
        .section {
          margin-bottom: 24px;
        }
        .section h2 {
          font-size: 18px;
          color: #1f2937;
          border-left: 4px solid #f97316;
          padding-left: 12px;
          margin-bottom: 12px;
        }
        .section h3 {
          font-size: 14px;
          color: #374151;
          margin-bottom: 8px;
        }
        .section p, .section li {
          font-size: 13px;
          color: #4b5563;
          margin-bottom: 8px;
        }
        .section ul, .section ol {
          padding-left: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 12px;
        }
        th, td {
          border: 1px solid #e5e7eb;
          padding: 10px;
          text-align: left;
        }
        th {
          background: #f9fafb;
          font-weight: 600;
          color: #374151;
        }
        tr:nth-child(even) {
          background: #f9fafb;
        }
        .checklist-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .checklist-item:last-child {
          border-bottom: none;
        }
        .checkbox {
          width: 18px;
          height: 18px;
          border: 2px solid #d1d5db;
          border-radius: 4px;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }
        .status-compliant { background: #d1fae5; color: #065f46; }
        .status-partial { background: #fef3c7; color: #92400e; }
        .status-non-compliant { background: #fee2e2; color: #991b1b; }
        .status-not-reviewed { background: #e5e7eb; color: #374151; }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 11px;
          color: #9ca3af;
          text-align: center;
        }
        @media print {
          body { padding: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <div class="meta">
          Generated: ${date}
          ${metadata.author ? ` | Author: ${metadata.author}` : ''}
        </div>
        ${metadata.framework ? `<span class="framework-badge">${metadata.framework}</span>` : ''}
      </div>
      ${content}
      <div class="footer">
        WHS Safety Compliance Navigator - Amazon MEU WHS Delivery Last Mile Logistics
      </div>
    </body>
    </html>
  `
}

// Open print dialog with generated content
function openPrintWindow(html) {
  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}

// Download as HTML file
function downloadHTML(html, filename) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export a single law section
 */
export function exportLawSection(law, section, options = {}) {
  const { framework = '', action = 'print' } = options

  const content = `
    <div class="section">
      <h2>${law.abbreviation || law.title}</h2>
      <h3>${section.number} - ${section.title || ''}</h3>
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-top: 12px;">
        <p style="white-space: pre-wrap;">${section.content || ''}</p>
      </div>
    </div>
  `

  const html = generatePrintableHTML(
    `${law.abbreviation || law.title} - ${section.number}`,
    content,
    { framework }
  )

  if (action === 'download') {
    downloadHTML(html, `${law.abbreviation || 'law'}-${section.number}.html`)
  } else {
    openPrintWindow(html)
  }
}

/**
 * Export a full law document
 */
export function exportFullLaw(law, sections = [], options = {}) {
  const { framework = '', action = 'print' } = options

  const sectionsHTML = sections.map(section => `
    <div class="section">
      <h3>${section.number} - ${section.title || ''}</h3>
      <p style="white-space: pre-wrap;">${section.content || ''}</p>
    </div>
  `).join('')

  const content = `
    <div class="section">
      <h2>${law.abbreviation || law.title}</h2>
      ${law.description ? `<p>${law.description}</p>` : ''}
    </div>
    ${sectionsHTML}
  `

  const html = generatePrintableHTML(
    law.abbreviation || law.title,
    content,
    { framework }
  )

  if (action === 'download') {
    downloadHTML(html, `${law.abbreviation || 'law'}-full.html`)
  } else {
    openPrintWindow(html)
  }
}

/**
 * Export comparison results
 */
export function exportComparison(comparison, options = {}) {
  const { sourceFramework = '', targetFramework = '', action = 'print' } = options

  let tableHTML = ''
  if (comparison.comparisonTable) {
    const rows = comparison.comparisonTable.rows || []
    const headers = comparison.comparisonTable.headers || []

    tableHTML = `
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
  }

  const content = `
    <div class="section">
      <h2>Cross-Border Comparison: ${sourceFramework} vs ${targetFramework}</h2>
      ${comparison.equivalent ? `
        <div style="background: #dbeafe; padding: 16px; border-radius: 8px; margin: 12px 0;">
          <h3>Equivalent Provision</h3>
          <p>${comparison.equivalent}</p>
        </div>
      ` : ''}
      ${tableHTML}
      ${comparison.differences && comparison.differences.length > 0 ? `
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 12px 0;">
          <h3>Key Differences</h3>
          <ul>
            ${comparison.differences.map(d => `<li>${d}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${comparison.recommendation ? `
        <div style="background: #d1fae5; padding: 16px; border-radius: 8px; margin: 12px 0;">
          <h3>Recommendation</h3>
          <p>${comparison.recommendation}</p>
        </div>
      ` : ''}
    </div>
  `

  const html = generatePrintableHTML(
    `Law Comparison: ${sourceFramework} vs ${targetFramework}`,
    content,
    { framework: `${sourceFramework} ↔ ${targetFramework}` }
  )

  if (action === 'download') {
    downloadHTML(html, `comparison-${sourceFramework}-${targetFramework}.html`)
  } else {
    openPrintWindow(html)
  }
}

/**
 * Export compliance checklist
 */
export function exportChecklist(checklist, options = {}) {
  const { framework = '', action = 'print', title = 'Compliance Checklist' } = options

  const itemsHTML = checklist.items.map(item => `
    <div class="checklist-item">
      <div class="checkbox"></div>
      <div>
        <strong>${item.title || item.requirement}</strong>
        ${item.description ? `<p>${item.description}</p>` : ''}
        ${item.reference ? `<p style="font-size: 11px; color: #6b7280;">Reference: ${item.reference}</p>` : ''}
      </div>
    </div>
  `).join('')

  const content = `
    <div class="section">
      <h2>${title}</h2>
      ${checklist.description ? `<p>${checklist.description}</p>` : ''}
      <div style="margin-top: 20px;">
        ${itemsHTML}
      </div>
    </div>
  `

  const html = generatePrintableHTML(title, content, { framework })

  if (action === 'download') {
    downloadHTML(html, `checklist-${Date.now()}.html`)
  } else {
    openPrintWindow(html)
  }
}

/**
 * Export audit trail
 */
export function exportAuditTrail(auditEntries, options = {}) {
  const { framework = '', action = 'print' } = options

  const entriesHTML = auditEntries.map(entry => `
    <tr>
      <td>${new Date(entry.timestamp).toLocaleString()}</td>
      <td>${entry.action || '-'}</td>
      <td>${entry.lawId || entry.lawTitle || '-'}</td>
      <td>${entry.user || 'Anonymous'}</td>
      <td>${entry.notes || '-'}</td>
    </tr>
  `).join('')

  const content = `
    <div class="section">
      <h2>Audit Trail Report</h2>
      <table>
        <thead>
          <tr>
            <th>Date/Time</th>
            <th>Action</th>
            <th>Law/Section</th>
            <th>User</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${entriesHTML}
        </tbody>
      </table>
    </div>
  `

  const html = generatePrintableHTML('Audit Trail Report', content, { framework })

  if (action === 'download') {
    downloadHTML(html, `audit-trail-${Date.now()}.html`)
  } else {
    openPrintWindow(html)
  }
}

/**
 * Export compliance dashboard summary
 */
export function exportComplianceSummary(stats, details = [], options = {}) {
  const { framework = '', action = 'print' } = options

  const content = `
    <div class="section">
      <h2>Compliance Status Summary</h2>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0;">
        <div style="background: #d1fae5; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #065f46;">${stats.compliant || 0}</div>
          <div style="font-size: 12px; color: #065f46;">Compliant</div>
        </div>
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #92400e;">${stats.partial || 0}</div>
          <div style="font-size: 12px; color: #92400e;">Partial</div>
        </div>
        <div style="background: #fee2e2; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #991b1b;">${stats.nonCompliant || 0}</div>
          <div style="font-size: 12px; color: #991b1b;">Non-Compliant</div>
        </div>
        <div style="background: #e5e7eb; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #374151;">${stats.notReviewed || 0}</div>
          <div style="font-size: 12px; color: #374151;">Not Reviewed</div>
        </div>
      </div>
    </div>
    ${details.length > 0 ? `
      <div class="section">
        <h2>Detailed Status</h2>
        <table>
          <thead>
            <tr>
              <th>Law/Regulation</th>
              <th>Status</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            ${details.map(d => `
              <tr>
                <td>${d.title || d.lawId}</td>
                <td><span class="status-badge status-${d.status.replace('-', '-')}">${d.status}</span></td>
                <td>${d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
  `

  const html = generatePrintableHTML('Compliance Status Summary', content, { framework })

  if (action === 'download') {
    downloadHTML(html, `compliance-summary-${Date.now()}.html`)
  } else {
    openPrintWindow(html)
  }
}

export default {
  exportLawSection,
  exportFullLaw,
  exportComparison,
  exportChecklist,
  exportAuditTrail,
  exportComplianceSummary
}
