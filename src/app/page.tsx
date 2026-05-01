import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center space-y-8 bg-slate-900">
      <div>
        <h1 className="text-6xl font-black text-white mb-4">
          <span className="text-green-400">DOR</span>-ORCHESTRATOR
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl">
          AI Agent Orchestrator. Schedule tasks, monitor agents, deploy to any project.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full px-6">
        <FeatureCard 
          title="Projects" 
          description="Connect GitHub repos" 
          href="/projects" 
          icon="📁"
          color="bg-blue-600"
        />
        <FeatureCard 
          title="Tasks" 
          description="Queue work items" 
          href="/tasks" 
          icon="📝"
          color="bg-purple-600"
        />
        <FeatureCard 
          title="Agents" 
          description="Monitor agent runs" 
          href="/agents" 
          icon="🤖"
          color="bg-green-600"
        />
      </div>

      <Link 
        href="/dashboard" 
        className="bg-green-500 text-slate-900 px-8 py-4 rounded-2xl font-black text-lg hover:bg-green-400 transition-colors"
      >
        Launch Dashboard →
      </Link>
    </div>
  )
}

function FeatureCard({ title, description, href, icon, color }: { title: string; description: string; href: string; icon: string; color: string }) {
  return (
    <Link href={href} className="bg-slate-800 rounded-2xl border border-slate-700 p-6 hover:border-slate-600 transition-colors group">
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </Link>
  )
}
