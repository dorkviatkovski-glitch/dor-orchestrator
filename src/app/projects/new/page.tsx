'use client'

import { useState } from 'react'
import { createProject } from '@/lib/actions/projects'
import { useRouter } from 'next/navigation'

export default function NewProjectPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget as HTMLFormElement)
    
    try {
      await createProject({
        name: formData.get('name') as string,
        repoUrl: formData.get('repoUrl') as string,
        cloneUrl: formData.get('cloneUrl') as string,
        branch: (formData.get('branch') as string) || undefined,
        description: (formData.get('description') as string) || undefined,
      })
      router.push('/projects')
    } catch (error) {
      alert('Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-black text-white mb-8">Add Project</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6 bg-slate-800 rounded-2xl border border-slate-700 p-8">
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">Project Name</label>
          <input name="name" required className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none" placeholder="my-awesome-app" />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">GitHub Repo URL</label>
          <input name="repoUrl" required className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none" placeholder="https://github.com/user/repo" />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">Clone URL (SSH or HTTPS)</label>
          <input name="cloneUrl" required className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none" placeholder="git@github.com:user/repo.git" />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">Default Branch</label>
          <input name="branch" defaultValue="main" className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none" />
        </div>
        
        <div>
          <label className="block text-sm font-bold text-slate-300 mb-2">Description</label>
          <textarea name="description" rows={3} className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none" placeholder="What does this project do?" />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Project'}
        </button>
      </form>
    </div>
  )
}
