import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const run = await prisma.agentRun.findUnique({
    where: { id },
    include: {
      task: { include: { project: true } },
      logs_line: { orderBy: { timestamp: 'asc' } },
    },
  })

  if (!run) return notFound()

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-4 mb-2">
          <h1 className="text-3xl font-black text-white">Agent Run</h1>
          <StatusBadge status={run.status} />
        </div>
        <p className="text-slate-400">{run.task.title} — {run.task.project?.name ?? 'No project'}</p>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Iteration" value={`${run.iteration}/${run.maxIterations}`} />
        <MetricCard label="Model" value={run.model} />
        <MetricCard label="Started" value={run.startedAt ? formatDate(run.startedAt) : '—'} />
        <MetricCard label="Duration" value={run.completedAt && run.startedAt ? formatDuration(run.completedAt, run.startedAt) : '—'} />
      </div>

      {/* Summary */}
      {run.summary && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <h2 className="text-lg font-bold text-white mb-2">Summary</h2>
          <p className="text-slate-300">{run.summary}</p>
        </div>
      )}

      {/* Error */}
      {run.error && (
        <div className="bg-slate-800 rounded-2xl border border-red-800 p-6">
          <h2 className="text-lg font-bold text-red-400 mb-2">Error</h2>
          <p className="text-red-300 font-mono text-sm">{run.error}</p>
        </div>
      )}

      {/* Logs */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
        <h2 className="text-lg font-bold text-white mb-4">Logs</h2>
        {run.logs_line.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No logs yet.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {run.logs_line.map((log: typeof run.logs_line[0]) => (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${logLevelColor(log.level)}`}>
                  {log.level}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300">{log.message}</p>
                  {log.metadata && (
                    <pre className="text-xs text-slate-500 mt-1 font-mono">{log.metadata}</pre>
                  )}
                </div>
                <span className="text-xs text-slate-600 shrink-0">{formatDate(log.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <p className="text-xs text-slate-400 font-bold uppercase">{label}</p>
      <p className="text-lg font-bold text-white mt-1">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-slate-600 text-slate-200',
    running: 'bg-green-600 text-white animate-pulse',
    succeeded: 'bg-emerald-600 text-white',
    failed: 'bg-red-600 text-white',
    cancelled: 'bg-gray-600 text-gray-200',
  }
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-bold ${colors[status] ?? 'bg-slate-600'}`}>
      {status}
    </span>
  )
}

function logLevelColor(level: string): string {
  const map: Record<string, string> = {
    debug: 'bg-slate-700 text-slate-400',
    info: 'bg-blue-900 text-blue-300',
    warn: 'bg-yellow-900 text-yellow-300',
    error: 'bg-red-900 text-red-300',
  }
  return map[level] ?? 'bg-slate-700 text-slate-400'
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDuration(end: Date, start: Date): string {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}
