'use client'

import { useState } from 'react'
import { createTask } from '@/lib/actions/tasks'
import { useRouter } from 'next/navigation'

export default function NewTaskPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget as HTMLFormElement)
    
    try {
      await createTask({
        projectId: formData.get('projectId') as string,
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        type: (formData.get('type') as string) as any,
        priority: parseInt(formData.get('priority') as string),
        prdJson: (formData.get('prdJson') as string) || undefined,
      })
      router.push('/tasks')
    } catch (error) {
      alert('Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-black text-white mb-8">New Task</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6 bg-slate-800 rounded-2xl border border-slate-700 p-8">
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">Project</label>
          <select name="projectId" required className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none">
            <option value="">Select a project...</option>
            {/* This would need to fetch projects - for now we'll redirect if none */}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">Title</label>
          <input name="title" required className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none" placeholder="Implement user authentication" />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">Description</label>
          <textarea name="description" required rows={4} className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none" placeholder="Detailed description of what needs to be done..." />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Type</label>
            <select name="type" className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none">
              <option value="enhancement">Enhancement</option>
              <option value="bugfix">Bugfix</option>
              <option value="refactor">Refactor</option>
              <option value="docs">Docs</option>
              <option value="test">Test</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Priority (1-5)</label>
            <input name="priority" type="number" min={1} max={5} defaultValue={1} className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none" />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">PRD JSON (optional)</label>
          <textarea name="prdJson" rows={6} className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:outline-none font-mono text-xs" placeholder='{"title": "...", "tasks": [...]}' />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  )
}
