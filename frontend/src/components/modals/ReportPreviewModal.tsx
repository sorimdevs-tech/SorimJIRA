import { X, Printer, Download, Eye, FileText } from 'lucide-react'

interface ReportPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  reportTitle: string
  reportType: string
  data?: any
}

export default function ReportPreviewModal({
  isOpen,
  onClose,
  reportTitle,
  reportType,
  data = {},
}: ReportPreviewModalProps) {
  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  // Generate mock / actual data based on report type
  const todayStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const getReportContent = () => {
    switch (reportType) {
      case 'Sprint Report':
      case 'sprint':
        return {
          subtitle: 'Detailed Sprint Velocity & Task Completion Audit',
          summary: [
            { label: 'Sprint Name', value: data.sprintName || 'Sprint 3 (Active)' },
            { label: 'Completed Points', value: data.completedPoints || '34' },
            { label: 'Planned Capacity', value: data.capacity || '42' },
            { label: 'Completion Rate', value: data.completionRate || '81%' },
          ],
          tableHeaders: ['Ticket', 'Title', 'Priority', 'Status', 'Assignee'],
          tableRows: data.tickets || [
            ['FS-101', 'Implement authentication flow', 'HIGH', 'CLOSED', 'Sarah Chen'],
            ['FS-102', 'Create kanban board component', 'CRITICAL', 'IN_PROGRESS', 'James Doe'],
            ['FS-103', 'Setup Spring Security configuration', 'HIGH', 'CLOSED', 'Alex Mercer'],
            ['FS-104', 'Write API testing scripts', 'MEDIUM', 'TESTING', 'Priya Rao'],
            ['FS-105', 'Design dashboard layout', 'LOW', 'IN_REVIEW', 'Rita Patel'],
          ],
          hasChart: true,
          chartType: 'sprint',
        }
      case 'Velocity Report':
      case 'velocity':
        return {
          subtitle: 'Historical Performance & Commitment Realization',
          summary: [
            { label: 'Average Velocity', value: '38 pts' },
            { label: 'Sprints Measured', value: data.sprintsCount || '3' },
            { label: 'Max Commitment', value: '45 pts' },
            { label: 'Avg Delivery Rate', value: '88%' },
          ],
          tableHeaders: ['Sprint Name', 'Target Capacity', 'Delivered Points', 'Success Rate'],
          tableRows: data.sprints || [
            ['Sprint 1', '40 pts', '38 pts', '95%'],
            ['Sprint 2', '45 pts', '42 pts', '93%'],
            ['Sprint 3', '42 pts', '34 pts', '81%'],
          ],
          hasChart: true,
          chartType: 'velocity',
        }
      case 'Defect Report':
      case 'defect':
        return {
          subtitle: 'Quality Assurance & Issue Severity Breakdown',
          summary: [
            { label: 'Total Bugs', value: data.totalBugs || '12' },
            { label: 'Critical / High', value: data.criticalBugs || '5' },
            { label: 'Medium / Low', value: data.lowBugs || '7' },
            { label: 'Resolution Rate', value: '75%' },
          ],
          tableHeaders: ['Bug ID', 'Description', 'Priority', 'Logged Date', 'Status'],
          tableRows: data.defects || [
            ['BUG-041', 'JWT token expiration triggers loop', 'CRITICAL', 'July 20, 2026', 'IN_PROGRESS'],
            ['BUG-042', 'Kanban columns spill on mobile viewports', 'HIGH', 'July 21, 2026', 'CLOSED'],
            ['BUG-043', 'Unread count doesn\'t auto-increment', 'MEDIUM', 'July 21, 2026', 'TESTING'],
            ['BUG-044', 'Broken external redirection link', 'LOW', 'July 22, 2026', 'TODO'],
          ],
          hasChart: true,
          chartType: 'defect',
        }
      case 'Utilization Report':
      case 'utilization':
      case 'Team Utilization Report':
      case 'team-utilization':
        return {
          subtitle: 'Resource Load Distribution & Staffing Allocation',
          summary: [
            { label: 'Active Personnel', value: data.usersCount || '7' },
            { label: 'Avg Workload', value: '64%' },
            { label: 'Overloaded (>80%)', value: '2 members' },
            { label: 'Target Allocation', value: '85%' },
          ],
          tableHeaders: ['Team Member', 'Role', 'Assigned Tickets', 'Utilization Rate'],
          tableRows: data.utilization || [
            ['Sarah Chen', 'Scrum Master', '3 tickets', '45%'],
            ['James Doe', 'Developer', '6 tickets', '85%'],
            ['Priya Rao', 'Tester', '4 tickets', '60%'],
            ['Alex Mercer', 'Developer', '5 tickets', '75%'],
            ['Rita Patel', 'Manager', '2 tickets', '30%'],
          ],
          hasChart: true,
          chartType: 'utilization',
        }
      case 'Productivity Report':
      case 'productivity':
        return {
          subtitle: 'Core Deliverables, Output Metrics & Cycle Times',
          summary: [
            { label: 'Sprint Duration', value: '14 Days' },
            { label: 'Completed Tickets', value: data.completedTickets || '18' },
            { label: 'Avg Cycle Time', value: '3.4 days' },
            { label: 'Efficiency Rating', value: 'Optimal (A)' },
          ],
          tableHeaders: ['Metrics Analyzed', 'Current Value', 'Previous Period', 'Deviation'],
          tableRows: [
            ['Mean Time to Resolve', '3.4 Days', '4.1 Days', '-17.0% (Better)'],
            ['Tickets Done per Dev', '4.5', '3.8', '+18.4% (Better)'],
            ['Code Review Turnaround', '6.2 hrs', '8.5 hrs', '-27.0% (Better)'],
            ['Build Success Rate', '94.2%', '91.0%', '+3.2% (Better)'],
          ],
          hasChart: false,
        }
      case 'Security Report':
      case 'security':
        return {
          subtitle: 'System Access Auditing, IAM Policy Matrix & Alerts',
          summary: [
            { label: 'Active Sessions', value: '4' },
            { label: 'MFA Adoption', value: '100%' },
            { label: 'Blocked Attacks', value: '1 (IP: 185.22.8.4)' },
            { label: 'System Health', value: '99.9%' },
          ],
          tableHeaders: ['Timestamp', 'Event Type', 'Entity Involved', 'Network IP', 'Status'],
          tableRows: data.logs || [
            ['Today 09:44', 'TICKET_STATUS_CHANGED', 'EHR-105 → TESTING by priya.rao', '10.0.4.19', 'SUCCESS'],
            ['Today 09:12', 'USER_LOGIN', 'sarah.chen authenticated with MFA', '10.0.4.21', 'SUCCESS'],
            ['Today 03:41', 'FAILED_LOGIN', '3 attempts from 185.22.8.4', '185.22.8.4', 'BLOCKED'],
            ['Yesterday 17:22', 'USER_LOGIN', 'rita.patel logged in', '10.0.4.52', 'SUCCESS'],
          ],
          hasChart: false,
        }
      default:
        return {
          subtitle: 'Standard Automated System Classification',
          summary: [
            { label: 'Report Name', value: reportTitle },
            { label: 'Generated At', value: todayStr },
            { label: 'Classification', value: 'INTERNAL ONLY' },
          ],
          tableHeaders: ['Key', 'Detail/Value'],
          tableRows: Object.entries(data).map(([k, v]) => [k, String(v)]),
          hasChart: false,
        }
    }
  }

  const content = getReportContent()

  return (
    <div className="fixed inset-0 bg-slate-900/80 flex flex-col z-50 overflow-hidden no-print">
      {/* Top Header Bar */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between text-white select-none">
        <div className="flex items-center gap-2">
          <FileText className="text-red-400 w-5 h-5" />
          <span className="font-semibold text-sm tracking-wide">{reportTitle.replace('.pdf', '')}.pdf</span>
          <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-medium">PDF View</span>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border-r border-slate-700 pr-4">
            <button
              onClick={handlePrint}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Print or Save PDF"
            >
              <Printer size={15} />
              Print / Save PDF
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white"
              title="Download PDF"
            >
              <Download size={15} />
              Download
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex-1 bg-slate-600 overflow-y-auto p-8 flex justify-center">
        <div className="pdf-print-area w-full max-w-[800px] bg-white text-slate-800 shadow-2xl p-12 border border-slate-300 min-h-[1050px] flex flex-col justify-between font-sans">
          
          {/* Document Header */}
          <div>
            <div className="flex justify-between items-start border-b-2 border-blue-600 pb-5 mb-6">
              <div>
                <h2 className="text-xl font-black tracking-tight text-blue-900">SORIM TECHNOLOGIES</h2>
                <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">System Automation & Analytics Platform</p>
              </div>
              <div className="text-right">
                <span className="tag tag-blue text-[9px] font-bold tracking-wider mb-1">INTERNAL CONFIDENTIAL</span>
                <p className="text-[10.5px] text-slate-500 font-mono">{todayStr}</p>
              </div>
            </div>

            {/* Title */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{reportTitle}</h1>
              <p className="text-xs text-slate-500 italic mt-0.5">{content.subtitle}</p>
            </div>

            {/* Summary KPI Cards inside report */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              {content.summary.map((s, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded p-3 text-center">
                  <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</div>
                  <div className="text-base font-black text-slate-800 mt-1">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Charts visualization inside report */}
            {content.hasChart && (
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 mb-8">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Visualization Chart</h3>
                
                {/* SVG/CSS Rendered High Fidelity Charts so they print perfectly and look stunning */}
                {content.chartType === 'sprint' && (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono px-2">
                      <span>Sprint S3 Goal: 42 pts</span>
                      <span>Progress: 34 pts</span>
                    </div>
                    <div className="h-6 w-full bg-slate-200 rounded overflow-hidden flex">
                      <div className="bg-blue-600 h-full flex items-center justify-end pr-2 text-white font-mono text-[10px] font-bold" style={{ width: '81%' }}>81%</div>
                    </div>
                    <div className="flex gap-4 mt-2 justify-center text-[10.5px]">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-600 rounded-sm inline-block"></span> Completed (34 pts)</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-slate-300 rounded-sm inline-block"></span> Scope Gap (8 pts)</span>
                    </div>
                  </div>
                )}

                {content.chartType === 'velocity' && (
                  <div className="flex gap-4 items-end justify-around h-28 pt-4 px-4 font-mono text-[9px]">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex gap-1 items-end h-20">
                        <div className="bg-blue-600 w-4 h-[84%]" title="Completed: 38"></div>
                        <div className="bg-slate-300 w-4 h-[90%]" title="Capacity: 40"></div>
                      </div>
                      <span>Sprint 1</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex gap-1 items-end h-20">
                        <div className="bg-blue-600 w-4 h-[93%]" title="Completed: 42"></div>
                        <div className="bg-slate-300 w-4 h-[100%]" title="Capacity: 45"></div>
                      </div>
                      <span>Sprint 2</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex gap-1 items-end h-20">
                        <div className="bg-blue-600 w-4 h-[81%]" title="Completed: 34"></div>
                        <div className="bg-slate-300 w-4 h-[100%]" title="Capacity: 42"></div>
                      </div>
                      <span>Sprint 3</span>
                    </div>
                  </div>
                )}

                {content.chartType === 'defect' && (
                  <div className="flex gap-6 items-center justify-center py-2">
                    <div className="relative w-20 h-20 rounded-full border-8 border-amber-500 flex items-center justify-center font-bold text-xs" style={{ borderLeftColor: '#DC2626', borderTopColor: '#DC2626' }}>
                      <span className="text-[10px] text-center font-bold">12 Total</span>
                    </div>
                    <div className="text-[11px] flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-red-600 rounded-sm"></span>
                        <span>Critical/High Severity (5 Issues - 41.7%)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm"></span>
                        <span>Medium/Low Severity (7 Issues - 58.3%)</span>
                      </div>
                    </div>
                  </div>
                )}

                {content.chartType === 'utilization' && (
                  <div className="flex flex-col gap-2.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="w-20 font-medium">James Doe</span>
                      <div className="flex-1 bg-slate-200 h-2.5 rounded overflow-hidden">
                        <div className="bg-purple-600 h-full" style={{ width: '85%' }}></div>
                      </div>
                      <span className="font-bold text-purple-700 w-10 text-right">85%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-20 font-medium">Alex Mercer</span>
                      <div className="flex-1 bg-slate-200 h-2.5 rounded overflow-hidden">
                        <div className="bg-purple-600 h-full" style={{ width: '75%' }}></div>
                      </div>
                      <span className="font-bold text-purple-700 w-10 text-right">75%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-20 font-medium">Priya Rao</span>
                      <div className="flex-1 bg-slate-200 h-2.5 rounded overflow-hidden">
                        <div className="bg-purple-600 h-full" style={{ width: '60%' }}></div>
                      </div>
                      <span className="font-bold text-purple-700 w-10 text-right">60%</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Document Data Table */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Report Data Table</h3>
              <table className="w-full text-left border-collapse border border-slate-200">
                <thead>
                  <tr className="bg-slate-100">
                    {content.tableHeaders.map((h, i) => (
                      <th key={i} className="border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {content.tableRows.map((row: any, rIdx: number) => (
                    <tr key={rIdx} className="hover:bg-slate-50/50">
                      {row.map((cell: any, cIdx: number) => (
                        <td key={cIdx} className="border border-slate-200 px-3 py-1.5 text-[11px] text-slate-700">
                          {cell === 'CLOSED' || cell === 'SUCCESS' ? (
                            <span className="text-emerald-600 font-bold">✓ {cell}</span>
                          ) : cell === 'CRITICAL' || cell === 'BLOCKED' ? (
                            <span className="text-red-600 font-bold">⚠ {cell}</span>
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Document Footer */}
          <div className="border-t border-slate-200 pt-6 mt-12 flex justify-between items-end text-[10px] text-slate-400 font-mono">
            <div>
              <p>Generated by IntelliSprint Reporting API</p>
              <p>Document ID: FS-REP-{(reportType.replace(/ /g, '-').slice(0,3) + '-' + new Date().getTime().toString().slice(-6)).toUpperCase()}</p>
            </div>
            <div className="text-center w-40 border-t border-slate-300 pt-2 text-slate-500">
              Authorized Signature
            </div>
            <div className="text-right">
              Page 1 of 1
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
