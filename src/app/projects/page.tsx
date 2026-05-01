import { getProjects, createProject } from '@/lib/actions/projects'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export default async function ProjectsPage() {
  const projects = await getProjects()

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white">Projects</h1>
          <p className="text-slate-400">Configure GitHub repos to orchestrate</p>
        </div>
        <Link href="/projects/new" className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-colors">
          + Add Project
        </Link>
      </header>

      {projects.length === 0 ? (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-12 text-center">
          <p className="text-slate-400 text-lg mb-4">No projects yet</p>
          <Link href="/projects/new" className="text-blue-400 font-bold hover:text-blue-300">
            Add your first project →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map(project => (
            <div key={project.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">{project.name}</h3>
                <p className="text-sm text-slate-400 mt-1">{project.repoUrl}</p>
                <p className="text-xs text-slate-500 mt-1">Tasks: {project._count.tasks}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${project.isActive ? 'bg-green-600 text-white' : 'bg-slate-600 text-slate-300'}`}>
                  {project.isActive ? 'Active' : 'Inactive'}
                </span>
                <Link href={`/projects/${project.id}`} className="text-blue-400 font-bold hover:text-blue-300">
                  View →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
