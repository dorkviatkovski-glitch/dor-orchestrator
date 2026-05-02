import { getProjects } from '@/lib/actions/projects'
import NewTaskForm from './NewTaskForm'

export default async function NewTaskPage() {
  const projects = await getProjects()

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-black text-white mb-8">New Task</h1>
      <NewTaskForm projects={projects} />
    </div>
  )
}
