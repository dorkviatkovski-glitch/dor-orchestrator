import { getProjects } from '@/lib/actions/projects'
import { getTasks } from '@/lib/actions/tasks'
import { TaskStatus } from '@prisma/client'
import Link from 'next/link'

function statusColor(status: TaskStatus): string {
  const map: Record<string, string> = {
    todo: 'bg-slate-600',
    claimed: 'bg-blue-600',
    running: 'bg-green-600 animate-pulse',
    human_review: 'bg-yellow-600',
    merging: 'bg-purple-600',
    done: 'bg-emerald-600',
    failed: 'bg-red-600',
    cancelled: 'bg-gray-600',
  }
  return map[status] ?? 'bg-slate-600'
}

export default async function TasksPage() {
  const tasks = await getTasks()
  const projects = await getProjects()

  // Group by status for Kanban
  const columns = [
    { status: TaskStatus.todo, label: 'To Do' },
    { status: TaskStatus.claimed, label: 'Claimed' },
    { status: TaskStatus.running, label: 'Running' },
    { status: TaskStatus.human_review, label: 'Human Review' },
    { status: TaskStatus.merging, label: 'Merging' },
    { status: TaskStatus.done, label: 'Done' },
    { status: TaskStatus.failed, label: 'Failed' },
  ]

  const taskMap = new Map<string, typeof tasks[0][]>()
  columns.forEach(col => taskMap.set(col.status, tasks.filter(t => t.status === col.status)))

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white">Task Queue</h1>
          <p className="text-slate-400">Kanban board for orchestrated tasks</p>
        </div>
        <Link href="/tasks/new" className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-purple-700 transition-colors">
          + New Task
        </Link>
      </header>

      {/* Kanban Board */}
      <div className="grid grid-cols-7 gap-3 overflow-x-auto">
        {columns.map(col => (
          <div key={col.status} className="min-w-[200px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-300">{col.label}</h3>
              <span className="text-xs text-slate-500 font-bold bg-slate-800 px-2 py-1 rounded-lg">
                {taskMap.get(col.status)?.length ?? 0}
              </span>
            </div>
            <div className="space-y-3">
              {(taskMap.get(col.status) ?? []).map(task => (
                <div key={task.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <p className="text-sm font-bold text-white mb-1">{task.title}</p>
                  <p className="text-xs text-slate-400 mb-2">{task.project?.name ?? 'No project'}</p>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusColor(task.status)}`} />
                    <span className="text-xs text-slate-500">P{task.priority}</span>
                  </div>
                  {task.runs[0] && (
                    <Link href={`/agents/${task.runs[0].id}`} className="text-xs text-blue-400 hover:text-blue-300 mt-2 block">
                      View run →
                    </Link>
                  )}
                </div>
              ))}
              {(taskMap.get(col.status) ?? []).length === 0 && (
                <div className="h-20 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center">
                  <span className="text-xs text-slate-600">Empty</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
