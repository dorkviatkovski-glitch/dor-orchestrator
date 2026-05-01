import { prisma } from '@/lib/db'
import { TaskStatus, RunStatus } from '@prisma/client'
import Link from 'next/link'

export default async function DashboardPage() {
  const stats = await prisma.task.groupBy({
    by: ['status'],
    _count: { status: true },
  })

  const runs = await prisma.agentRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { task: { include: { project: true } } },
  })

  const projects = await prisma.project.count()
  const totalTasks = await prisma.task.count()
  const activeRuns = await prisma.agentRun.count({ where: { status: RunStatus.running } })

  const statusMap = new Map<string, number>(stats.map(s => [s.status, s._count.status as number]))

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-black text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Orchestrator overview and metrics</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Projects" value={projects} color="blue" />
        <StatCard label="Total Tasks" value={totalTasks} color="purple" />
        <StatCard label="Active Runs" value={activeRuns} color="green" />
        <StatCard label="Done" value={statusMap.get(TaskStatus.done) ?? 0} color="emerald" />
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {Object.values(TaskStatus).map(status => (
          <div key={status} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 font-bold uppercase mb-1">{status}</p>
            <p className="text-2xl font-black text-white">{statusMap.get(status) ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Recent Runs */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Recent Runs</h2>
        {runs.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No runs yet. Create a task to get started.</p>
        ) : (
          <div className="space-y-3">
            {runs.map(run => (
              <div key={run.id} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
                <div>
                  <p className="font-bold text-white">{run.task.title}</p>
                  <p className="text-xs text-slate-400">{run.task.project?.name ?? 'No project'}</p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={run.status} />
                  <span className="text-xs text-slate-500">{run.iteration}/{run.maxIterations}</span>
                  <Link href={`/agents/${run.id}`} className="text-sm text-blue-400 hover:text-blue-300 font-bold">
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Link href="/projects" className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold text-center hover:bg-blue-700 transition-colors">
          📁 Manage Projects
        </Link>
        <Link href="/tasks" className="flex-1 bg-purple-600 text-white py-4 rounded-2xl font-bold text-center hover:bg-purple-700 transition-colors">
          📝 Task Queue
        </Link>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const bgColors: Record<string, string> = {
    blue: 'bg-blue-600',
    purple: 'bg-purple-600',
    green: 'bg-green-600',
    emerald: 'bg-emerald-600',
  }
  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
      <p className="text-sm text-slate-400 font-bold mb-1">{label}</p>
      <p className="text-4xl font-black text-white">{value}</p>
      <div className={`mt-3 h-2 rounded-full ${bgColors[color]} opacity-50`} />
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
