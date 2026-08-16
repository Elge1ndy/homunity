import { useState } from 'react'
import api from '../api'
import Modal from './Modal.jsx'
import Spinner from './Spinner.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { errMsg } from '../hooks/useApi.js'
import { FileSpreadsheet, Download } from 'lucide-react'
import { downloadBlob } from '../utils/format.js'

export default function ImportModal({ open, onClose, onDone }) {
  const { toast } = useToast()
  const [report, setReport] = useState(null)
  const [importing, setImporting] = useState(false)

  const onFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setReport(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post('/students/import', fd)
      setReport(data.report)
      toast(`${data.report.added} students added`)
      onDone()
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = async () => {
    await downloadBlob('/template-students.xlsx', 'student-template.xlsx')
  }

  return (
    <Modal open={open} onClose={onClose} title="Import Students from Excel">
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-primary-50 border border-primary-100 text-sm text-primary-800">
          <p className="font-bold mb-1">Required file format:</p>
          <p dir="ltr" className="font-mono text-xs text-primary-900">
            Name | Phone | University | Room | Bed | Rent | Check-in Date | Check-out Date
          </p>
          <p className="text-xs mt-2">Automatic validation checks: duplicate phone, non-existent room, occupied bed, missing data.</p>
        </div>

        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-8 cursor-pointer hover:bg-slate-50 transition-colors">
          <FileSpreadsheet size={24} className="text-primary-600" />
          <span className="text-sm font-semibold text-slate-600">{importing ? 'Importing...' : 'Click to choose Excel file'}</span>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} disabled={importing} className="hidden" />
        </label>

        {report && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm">
              <span className="font-bold text-emerald-600">{report.added} / {report.total} students added</span>
            </div>
            {report.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto">
                {report.errors.map((e, i) => (
                  <div key={i} className="px-4 py-2 text-xs text-red-600 border-b border-slate-100">
                    Line {e.line}: {e.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-between items-center mt-6">
        <button className="btn-outline" onClick={downloadTemplate}>
          <Download size={16} />
          Blank Template
        </button>
        <button className="btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  )
}
