import { prisma } from '@/lib/db'
import { RunStatus } from '@prisma/client'
import Link from 'next/link'

export default async function AgentsPage() {
  const runs = await prisma.agentRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      task: { include: { project: true } },
    },
  })

  const runningCount = runs.filter((r: typeof runs[0]) => r.status === RunStatus.running).length
  const succeededCount = runs.filter((r: typeof runs[0]) => r.status === RunStatus.succeeded).length
  const failedCount = runs.filter((r: typeof runs[0]) => r.status === RunStatus.failed).length

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black text-white">Agent Runs</h1>
        <p className="text-slate-400">Monitor orchestrated agent execution</p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 text-center">
          <p className="text-3xl font-black text-green-400">{runningCount}</p>
          <p className="text-sm text-slate-400 font-bold">Running</p>
        </div>
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 text-center">
          <p className="text-3xl font-black text-emerald-400">{succeededCount}</p>
          <p className="text-sm text-slate-400 font-bold">Succeeded</p>
        </div>
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 text-center">
          <p className="text-3xl font-black text-red-400">{failedCount}</p>
          <p className="text-sm text-slate-400 font-bold">Failed</p>
        </div>
      </div>

      {/* Runs Table */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Recent Runs</h2>
        {runs.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-slate-400 font-bold uppercase">
                  <th className="pb-3">Task</th>
                  <th className="pb-3">Project</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Progress</th>
                  <th className="pb-3">Started</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id} className="border-t border-slate-700">
                    <td className="py-4 font-bold text-white">{run.task.title}</td>
                    <td className="py-4 text-sm text-slate-400">{run.task.project?.name ?? '—'}</td>
                    <td className="py-4">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="py-4">
                      <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 transition-all" 
                          style={{ width: `${Math.min((run.iteration / run.maxIterations) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{run.iteration}/{run.maxIterations}</span>
                    </td>
                    <td className="py-4 text-sm text-slate-400">{run.startedAt ? formatDate(run.startedAt) : 'Pending'}</td>
                    <td className="py-4">
                      <Link href={`/agents/${run.id}`} className="text-blue-400 text-sm font-bold hover:text-blue-300">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors[status] ?? 'bg-slate-600'}`}>
      {status}
    </span>
  )
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
