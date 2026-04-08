// lib/export.ts - PDF and CSV export utilities

export interface ExportData {
  meetingName: string;
  summary: string;
  decisions: string[];
  actionItems: Array<{
    who: string;
    what: string;
    due_date: string;
  }>;
  meetingDate?: string;
  wordCount?: number;
  speakerCount?: number;
}

/**
 * Generate CSV content from meeting data
 */
export function generateCSV(data: ExportData): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`"Meeting: ${data.meetingName}"`);
  lines.push(`"Generated: ${new Date().toLocaleString()}"`);
  lines.push('');
  
  // Summary
  lines.push('"SUMMARY"');
  lines.push(`"${data.summary.replace(/"/g, '""')}"`);
  lines.push('');
  
  // Decisions
  lines.push('"DECISIONS"');
  if (data.decisions.length > 0) {
    data.decisions.forEach((decision, idx) => {
      lines.push(`"${idx + 1}. ${decision.replace(/"/g, '""')}"`);
    });
  } else {
    lines.push('"No decisions recorded"');
  }
  lines.push('');
  
  // Action Items
  lines.push('"ACTION ITEMS"');
  if (data.actionItems.length > 0) {
    lines.push('"Assigned To","Task","Due Date"');
    data.actionItems.forEach((item) => {
      lines.push(
        `"${item.who.replace(/"/g, '""')}","${item.what.replace(/"/g, '""')}","${item.due_date}"`
      );
    });
  } else {
    lines.push('"No action items recorded"');
  }
  
  return lines.join('\n');
}

/**
 * Generate PDF-like HTML that can be printed or converted to PDF
 */
export function generateHTMLForPDF(data: ExportData): string {
  const decisionsHTML = data.decisions.length > 0
    ? data.decisions.map((d, i) => `<li>${escapeHtml(d)}</li>`).join('\n')
    : '<li style="color: #999;">No decisions recorded</li>';
  
  const actionsHTML = data.actionItems.length > 0
    ? `<table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Assigned To</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Task</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Due Date</th>
          </tr>
        </thead>
        <tbody>
          ${data.actionItems.map(item => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(item.who)}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(item.what)}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${escapeHtml(item.due_date)}</td>
            </tr>
          `).join('\n')}
        </tbody>
      </table>`
    : '<p style="color: #999;">No action items recorded</p>';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(data.meetingName)}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 40px;
          color: #333;
        }
        h1 { color: #2c3e50; margin-bottom: 10px; }
        h2 { 
          color: #34495e; 
          margin-top: 30px; 
          margin-bottom: 15px; 
          font-size: 18px;
          border-bottom: 3px solid #3498db;
          padding-bottom: 8px;
        }
        .meta {
          color: #666;
          font-size: 14px;
          margin-bottom: 30px;
        }
        .summary {
          background-color: #ecf0f1;
          padding: 15px;
          border-left: 4px solid #3498db;
          margin-bottom: 20px;
          line-height: 1.6;
        }
        ul { line-height: 1.8; }
        li { margin-bottom: 8px; }
        table { margin-top: 10px; }
        th, td { text-align: left; }
        @media print {
          body { margin: 0; }
          h2 { page-break-after: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(data.meetingName)}</h1>
      <div class="meta">
        Generated: ${new Date().toLocaleString()}
        ${data.meetingDate ? `<br>Meeting Date: ${new Date(data.meetingDate).toLocaleDateString()}` : ''}
        ${data.wordCount ? `<br>Word Count: ${data.wordCount}` : ''}
        ${data.speakerCount ? `<br>Speakers: ${data.speakerCount}` : ''}
      </div>
      
      <h2>Summary</h2>
      <div class="summary">
        ${escapeHtml(data.summary).replace(/\n/g, '<br>')}
      </div>
      
      <h2>Decisions</h2>
      <ul>
        ${decisionsHTML}
      </ul>
      
      <h2>Action Items</h2>
      ${actionsHTML}
    </body>
    </html>
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Trigger browser download
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Download meeting data as CSV
 */
export function downloadAsCSV(data: ExportData) {
  const csv = generateCSV(data);
  const filename = `${data.meetingName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

/**
 * Open meeting data in new window for printing as PDF
 */
export function downloadAsPDF(data: ExportData) {
  const html = generateHTMLForPDF(data);
  const filename = `${data.meetingName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.html`;
  
  // Open in new window for printing/saving as PDF
  const w = window.open();
  if (w) {
    w.document.write(html);
    w.document.close();
    // Optionally auto-trigger print dialog
    // w.print();
  }
}
