import { LinearSyncService } from './linear-sync'
import { prisma } from '@/lib/db'
import { TaskStatus, RunStatus, AgentType } from '@prisma/client'

export class OrchestratorEngine {
  private intervalId: NodeJS.Timeout | null = null
  private activeRuns = new Set<string>()

  async start(): Promise<void> {
    console.log('[Orchestrator] Starting...')
    await this.tick()
    this.intervalId = setInterval(() => this.tick(), 30_000)
  }

  stop(): void {
    console.log('[Orchestrator] Stopping...')
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null }
  }

  async tick(): Promise<void> {
    try {
      if (process.env.LINEAR_API_KEY) {
        try {
          const svc = new LinearSyncService()
          const res = await svc.syncIncomingIssues()
          if (res.created > 0 || res.updated > 0) console.log(`[Linear] sync +${res.created} ~${res.updated}`)
        } catch (e: any) { console.error('[Linear] sync error:', e.message) }
      }
      await this.reconcile()
      await this.claim()
    } catch (e) { console.error('[Orchestrator] tick error:', e) }
  }

  async reconcile(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000)
    const stuck = await prisma.agentRun.findMany({ where: { status: RunStatus.running, updatedAt: { lt: cutoff } } })
    for (const r of stuck) {
      await prisma.agentRun.update({ where: { id: r.id }, data: { status: RunStatus.failed, error: 'Timed out' } })
      await prisma.task.update({ where: { id: r.taskId }, data: { status: TaskStatus.failed } })
      this.activeRuns.delete(r.id)
    }
  }

  async claim(): Promise<void> {
    const tasks = await prisma.task.findMany({
      where: { status: TaskStatus.todo },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 2,
      include: { project: true },
    })
    for (const t of tasks) {
      if (this.activeRuns.size >= 2) break
      const run = await prisma.agentRun.create({
        data: { taskId: t.id, status: RunStatus.pending, model: 'claude', maxIterations: 20 },
      })
      await prisma.task.update({ where: { id: t.id }, data: { status: TaskStatus.claimed } })
      this.execRun(run.id, t).catch(console.error)
    }
  }

  private async execRun(runId: string, task: any): Promise<void> {
    this.activeRuns.add(runId)
    try {
      await prisma.agentRun.update({ where: { id: runId }, data: { status: RunStatus.running, startedAt: new Date() } })
      await prisma.task.update({ where: { id: task.id }, data: { status: TaskStatus.running } })

      const os = await import('os')
      const path = await import('path')
      const fs = await import('fs/promises')
      const ws = path.join(os.tmpdir(), 'dor-orch', task.id)
      await fs.mkdir(ws, { recursive: true })

      if (task.project?.cloneUrl) {
        try {
          const { execSync } = await import('child_process')
          execSync(`git clone --depth 1 --branch ${task.project.branch || 'main'} ${task.project.cloneUrl} .`, { cwd: ws, timeout: 120000 })
        } catch (e: any) { console.error('clone fail:', e.message) }
      }

      if (task.prdJson) await fs.writeFile(path.join(ws, 'prd.json'), task.prdJson, 'utf-8')
      await fs.writeFile(path.join(ws, 'progress.txt'), `Started: ${new Date().toISOString()}\n`, 'utf-8')

      let result: { success: boolean; summary: string; error?: string }

      if (task.agentType === AgentType.codex) {
        const { CodexRunner } = await import('./codex-runner')
        result = await new CodexRunner({ workspaceDir: ws, taskTitle: task.title, taskDescription: task.description, prdJson: task.prdJson, runId }).run()
      } else {
        const { AgentRunner } = await import('./agent-runner')
        result = await new AgentRunner({ workspaceDir: ws, taskTitle: task.title, taskDescription: task.description, prdJson: task.prdJson, model: 'claude', maxIterations: 20, runId }).run()
      }

      if (result.success) {
        await prisma.agentRun.update({ where: { id: runId }, data: { status: RunStatus.succeeded, completedAt: new Date(), summary: result.summary } })
        await prisma.task.update({ where: { id: task.id }, data: { status: TaskStatus.human_review, completedAt: new Date() } })
      } else { throw new Error(result.error || 'run failed') }
    } catch (e: any) {
      const msg = e.message || String(e)
      await prisma.agentRun.update({ where: { id: runId }, data: { status: RunStatus.failed, error: msg } })
      await prisma.task.update({ where: { id: task.id }, data: { status: TaskStatus.failed, error: msg } })
    } finally { this.activeRuns.delete(runId) }
  }

  getStatus() {
    return { activeRuns: this.activeRuns.size, isRunning: !!this.intervalId, maxConcurrent: 2 }
  }
}

let eng: OrchestratorEngine | null = null
export function getOrchestrator() { return eng ?? (eng = new OrchestratorEngine()) }
