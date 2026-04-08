'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Download, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';

type InsightRow = {
  id: string;
  meeting_id: string;
  type: string;
  content: string;
  assignee?: string | null;
  due_date?: string | null;
};

type Props = {
  meetingId: string;
  meetingName: string;
};

const asCsvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

export default function MeetingInsightsPanel({ meetingId, meetingName }: Props) {
  const [rows, setRows] = useState<InsightRow[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('insights')
        .select('id, meeting_id, type, content, assignee, due_date')
        .eq('meeting_id', meetingId)
        .order('id', { ascending: true });

      if (error) {
        console.error('Failed to fetch insights', error);
        setRows([]);
      } else {
        setRows((data || []) as InsightRow[]);
      }

      // Fetch meeting summary
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('summary')
        .eq('id', meetingId)
        .single();

      if (!meetingError && meetingData) {
        setSummary(meetingData.summary || '');
      }

      setLoading(false);
    };

    fetchInsights();
  }, [meetingId]);

  const decisions = useMemo(
    () => rows.filter((row) => row.type === 'decision'),
    [rows]
  );

  const actionItems = useMemo(
    () => rows.filter((row) => row.type === 'action_item'),
    [rows]
  );

  const exportCsv = () => {
    const lines = [];

    // Add header with meeting info
    lines.push(asCsvCell(`Meeting: ${meetingName}`));
    lines.push(asCsvCell(`Generated: ${new Date().toLocaleString()}`));
    lines.push('');

    // Add summary section
    lines.push(asCsvCell('SUMMARY'));
    lines.push(asCsvCell(summary || 'No summary available'));
    lines.push('');

    // Add decisions section
    lines.push(asCsvCell('DECISIONS'));
    const decisionLines = decisions.map((d) => asCsvCell(d.content || ''));
    if (decisionLines.length > 0) {
      lines.push(...decisionLines);
    } else {
      lines.push(asCsvCell('No decisions recorded'));
    }
    lines.push('');

    // Add action items section with headers
    lines.push(asCsvCell('ACTION ITEMS'));
    lines.push(['Assigned To', 'Task', 'Due Date'].map(asCsvCell).join(','));
    const actionLines = actionItems.map((a) =>
      [
        asCsvCell(a.assignee || 'Unassigned'),
        asCsvCell(a.content || ''),
        asCsvCell(a.due_date || 'TBD'),
      ].join(',')
    );
    if (actionLines.length > 0) {
      lines.push(...actionLines);
    } else {
      lines.push(asCsvCell('No action items recorded'));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meetingName.replace(/\s+/g, '_')}_meeting_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    const lineHeight = 18;
    let y = margin;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const addHeading = (text: string) => {
      ensureSpace(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(text, margin, y);
      y += 22;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
    };

    const addParagraph = (text: string) => {
      const lines = doc.splitTextToSize(text, contentWidth);
      ensureSpace(lines.length * lineHeight + 6);
      doc.text(lines, margin, y);
      y += lines.length * lineHeight + 6;
    };

    const addBullet = (text: string) => {
      const wrapped = doc.splitTextToSize(`- ${text}`, contentWidth);
      ensureSpace(wrapped.length * lineHeight + 4);
      doc.text(wrapped, margin, y);
      y += wrapped.length * lineHeight + 4;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(meetingName, margin, y);
    y += 26;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()} | Meeting Intelligence Hub`, margin, y);
    y += 24;

    addHeading('Summary');
    addParagraph(summary || 'No summary available.');

    addHeading('Decisions');
    if (decisions.length) {
      decisions.forEach((row) => addBullet(row.content || ''));
    } else {
      addParagraph('No decisions found.');
    }

    addHeading('Action Items');
    if (actionItems.length) {
      actionItems.forEach((row) => {
        addBullet(`Task: ${row.content || ''}`);
        addParagraph(`Owner: ${row.assignee || 'Unassigned'} | Due: ${row.due_date || 'TBD'}`);
      });
    } else {
      addParagraph('No action items found.');
    }

    const fileBase = meetingName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `${fileBase || 'meeting'}_meeting_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Meeting Report</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-black transition"
            title="Export meeting report with summary, decisions and action items as CSV"
            aria-label="Export report as CSV"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={exportPdf}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
            title="Export meeting report with summary, decisions and action items as PDF"
            aria-label="Export report as PDF"
          >
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading insights...</p>
      ) : (
        <div className="space-y-5">
          {summary && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="text-sm font-bold uppercase tracking-wide text-blue-900 mb-2">Summary</h4>
              <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">{summary}</p>
            </div>
          )}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">Decisions</h4>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.length ? (
                    decisions.map((row) => (
                      <tr key={row.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">{row.content}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-2 text-gray-500">No decisions extracted yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-2">Action Items</h4>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">What</th>
                    <th className="px-3 py-2 font-semibold">Who</th>
                    <th className="px-3 py-2 font-semibold">By When</th>
                  </tr>
                </thead>
                <tbody>
                  {actionItems.length ? (
                    actionItems.map((row) => (
                      <tr key={row.id} className="border-t border-gray-100">
                        <td className="px-3 py-2">{row.content}</td>
                        <td className="px-3 py-2">{row.assignee || 'Unassigned'}</td>
                        <td className="px-3 py-2">{row.due_date || 'TBD'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-2 text-gray-500" colSpan={3}>
                        No action items extracted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
