import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function AgentRunPage({ params }: { params: { id: string } }) {
  const run = await prisma.agentRun.findUnique({
    where: { id: params.id },
    include: {
      task: { include: { project: true } },
      logs_line: {
        orderBy: { timestamp: 'asc' },
      },
    },
  })

  if (!run) return notFound()

  const colors: Record<string, string> = {
    pending: 'bg-slate-600 text-slate-200',
    running: 'bg-green-600 text-white animate-pulse',
    succeeded: 'bg-emerald-600 text-white',
    failed: 'bg-red-600 text-white',
    cancelled: 'bg-gray-600 text-gray-200',
  }

  const logColors: Record<string, string> = {
    debug: 'text-slate-500',
    info: 'text-blue-400',
    warn: 'text-yellow-400',
    error: 'text-red-400',
  }

  const duration = run.startedAt && run.completedAt
    ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-4xl font-black text-white">Run Details</h1>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors[run.status]}`}>
            {run.status}
          </span>
        </div>
        <p className="text-slate-400">
          Task: <span className="text-white font-bold">{run.task.title}</span>
          {' · '}
          Project: <span className="text-white font-bold">{run.task.project?.name ?? '—'}</span>
        </p>
      </header>

      {/* Run Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatBox label="Iteration" value={`${run.iteration}/${run.maxIterations}`} />
        <StatBox label="Model" value={run.model.split('/').pop() || run.model} />
        <StatBox label="Created" value={formatDate(run.createdAt)} />
        <StatBox label="Started" value={run.startedAt ? formatDate(run.startedAt) : '—'} />
        <StatBox label="Duration" value={duration !== null ? `${duration}s` : run.startedAt ? 'Running...' : '—'} />
      </div>

      {/* Summary */}
      {run.summary && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-3">Summary</h2>
          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">{run.summary}</pre>
        </div>
      )}

      {/* Error */}
      {run.error && (
        <div className="bg-red-900/30 rounded-2xl border border-red-700/50 p-6">
          <h2 className="text-xl font-bold text-red-400 mb-3">Error</h2>
          <pre className="text-sm text-red-300 whitespace-pre-wrap font-mono">{run.error}</pre>
        </div>
      )}

      {/* Progress Bar */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
        <div className="flex justify-between mb-2">
          <h2 className="text-xl font-bold text-white">Progress</h2>
          <span className="text-sm text-slate-400">{Math.min((run.iteration / run.maxIterations) * 100, 100).toFixed(0)}%</span>
        </div>
        <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${run.status === 'failed' ? 'bg-red-500' : run.status === 'succeeded' ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.min((run.iteration / run.maxIterations) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Logs */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Logs ({run.logs_line.length})</h2>
        {run.logs_line.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No logs available</p>
        ) : (
          <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
            {run.logs_line.map(log => (
              <div key={log.id} className="flex gap-3 py-1 border-b border-slate-700/50">
                <span className="text-slate-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`uppercase font-bold shrink-0 w-12 ${logColors[log.level]}`}>{log.level}</span>
                <span className="text-slate-300">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-6">
        <Link href="/agents" className="text-slate-400 hover:text-white font-bold transition-colors">
          ← Back to Agents
        </Link>
        <Link href="/tasks" className="text-slate-400 hover:text-white font-bold transition-colors">
          Task Board
        </Link>
      </div>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-center">
      <p className="text-xs text-slate-500 font-bold uppercase mb-1">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  )
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
