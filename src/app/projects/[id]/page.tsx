import { getProjectById } from '@/lib/actions/projects'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await getProjectById(params.id)
  if (!project) return notFound()

  const statusColors: Record<string, string> = {
    todo: 'bg-slate-600',
    claimed: 'bg-blue-600',
    running: 'bg-green-600 animate-pulse',
    human_review: 'bg-yellow-600',
    merging: 'bg-purple-600',
    done: 'bg-emerald-600',
    failed: 'bg-red-600',
    cancelled: 'bg-gray-600',
  }

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-black text-white">{project.name}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${project.isActive ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-300'}`}>
              {project.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-slate-400">{project.repoUrl}</p>
          {project.description && <p className="text-slate-500 mt-1">{project.description}</p>}
        </div>
        <Link href={`/tasks/new?projectId=${project.id}`} className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-purple-700 transition-colors">
          + New Task
        </Link>
      </header>

      {/* Project Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoCard label="Branch" value={project.branch} />
        <InfoCard label="Default Branch" value={project.defaultBranch} />
        <InfoCard label="Tasks" value={String(project.tasks.length)} />
        <InfoCard label="Created" value={new Date(project.createdAt).toLocaleDateString()} />
      </div>

      {/* Tasks List */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Tasks ({project.tasks.length})</h2>
        {project.tasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 mb-4">No tasks yet for this project</p>
            <Link href={`/tasks/new?projectId=${project.id}`} className="text-purple-400 font-bold hover:text-purple-300">
              Create first task →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {project.tasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl hover:bg-slate-700 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white truncate">{task.title}</p>
                  <p className="text-sm text-slate-400 truncate">{task.description.slice(0, 80)}...</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`w-2 h-2 rounded-full ${statusColors[task.status] || 'bg-slate-600'}`} />
                    <span className="text-xs text-slate-500 uppercase font-bold">{task.status}</span>
                    <span className="text-xs text-slate-500">P{task.priority}</span>
                    <span className="text-xs text-slate-500">{task.type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {task.runs.length > 0 && (
                    <Link href={`/agents/${task.runs[0].id}`} className="text-sm text-blue-400 hover:text-blue-300 font-bold">
                      Latest run →
                    </Link>
                  )}
                  <Link href={`/tasks`} className="text-xs text-slate-500 hover:text-white">
                    Board
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <Link href="/projects" className="text-slate-400 hover:text-white font-bold transition-colors">
          ← Back to Projects
        </Link>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <p className="text-xs text-slate-500 font-bold uppercase mb-1">{label}</p>
      <p className="text-lg font-bold text-white truncate">{value}</p>
    </div>
  )
}
