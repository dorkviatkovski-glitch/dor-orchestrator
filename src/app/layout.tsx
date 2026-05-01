import Link from 'next/link'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="border-b border-slate-700 bg-slate-800/80 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Link href="/dashboard" className="text-2xl font-black text-green-400">
            DOR-ORCHESTRATOR 🤖
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-bold hover:text-green-400 transition-colors">Dashboard</Link>
            <Link href="/projects" className="text-sm font-bold hover:text-green-400 transition-colors">Projects</Link>
            <Link href="/tasks" className="text-sm font-bold hover:text-green-400 transition-colors">Tasks</Link>
            <Link href="/agents" className="text-sm font-bold hover:text-green-400 transition-colors">Agents</Link>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
