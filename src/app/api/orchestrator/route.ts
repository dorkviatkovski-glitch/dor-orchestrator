// API route to control the orchestrator engine
import { getOrchestrator } from '@/lib/orchestrator'

export async function POST() {
  try {
    const orch = getOrchestrator()
    await orch.start()
    return Response.json({ status: 'started', ...orch.getStatus() })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const orch = getOrchestrator()
    return Response.json(orch.getStatus())
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
