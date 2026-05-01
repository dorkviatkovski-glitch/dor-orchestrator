// Core Orchestrator Engine (Reconciliation Loop)
// Based on Symphony SPEC: polls task queue, manages agent lifecycle

import { prisma } from '@/lib/db'
import { TaskStatus, RunStatus } from '@prisma/client'

export interface OrchestratorConfig {
  pollIntervalMs: number
  maxConcurrentRuns: number
  defaultModel: string
  maxIterations: number
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  pollIntervalMs: 30_000, // 30 seconds
  maxConcurrentRuns: 2,
  defaultModel: 'anthropic/claude-sonnet-4',
  maxIterations: 20,
}

class OrchestratorEngine {
  private config: OrchestratorConfig
  private intervalId: NodeJS.Timeout | null = null
  private activeRuns = new Set<string>()

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async start(): Promise<void> {
    console.log('[Orchestrator] Starting reconciliation loop...')
    await this.tick() // Run immediately
    this.intervalId = setInterval(() => this.tick(), this.config.pollIntervalMs)
  }

  stop(): void {
    console.log('[Orchestrator] Stopping...')
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private async tick(): Promise<void> {
    try {
      // 1. Reconcile stuck runs
      await this.reconcileStuckRuns()

      // 2. Claim ready tasks
      if (this.activeRuns.size < this.config.maxConcurrentRuns) {
        await this.claimTasks()
      }
    } catch (error) {
      console.error('[Orchestrator] Tick error:', error)
    }
  }

  private async reconcileStuckRuns(): Promise<void> {
    // Find runs stuck in 'running' for too long (>30 min)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    
    const stuckRuns = await prisma.agentRun.findMany({
      where: {
        status: RunStatus.running,
        updatedAt: { lt: thirtyMinutesAgo },
      },
    })

    for (const run of stuckRuns) {
      console.log(`[Orchestrator] Marking stuck run ${run.id} as failed`)
      await prisma.agentRun.update({
        where: { id: run.id },
        data: { status: RunStatus.failed, error: 'Run timed out after 30 minutes' },
      })
      await prisma.task.update({
        where: { id: run.taskId },
        data: { status: TaskStatus.failed },
      })
      this.activeRuns.delete(run.id)
    }
  }

  private async claimTasks(): Promise<void> {
    // Find highest priority task that is 'todo'
    const tasks = await prisma.task.findMany({
      where: { status: TaskStatus.todo },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      take: this.config.maxConcurrentRuns - this.activeRuns.size,
      include: { project: true },
    })

    for (const task of tasks) {
      console.log(`[Orchestrator] Claiming task: ${task.title}`)
      
      // Create a run
      const run = await prisma.agentRun.create({
        data: {
          taskId: task.id,
          status: RunStatus.pending,
          model: this.config.defaultModel,
          maxIterations: this.config.maxIterations,
        },
      })

      // Update task
      await prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.claimed },
      })

      // Start the agent (async)
      this.runAgent(run.id, task).catch(console.error)
    }
  }

  private async runAgent(runId: string, task: any): Promise<void> {
    this.activeRuns.add(runId)
    
    try {
      await prisma.agentRun.update({
        where: { id: runId },
        data: { status: RunStatus.running, startedAt: new Date() },
      })

      await prisma.task.update({
        where: { id: task.id },
        data: { status: TaskStatus.running, startedAt: new Date() },
      })

      // Initialize workspace for this task
      const workspaceDir = await this.prepareWorkspace(task)
      
      // Write PRD and progress files
      if (task.prdJson) {
        const fs = await import('fs/promises')
        const path = await import('path')
        await fs.writeFile(
          path.join(workspaceDir, 'prd.json'),
          task.prdJson,
          'utf-8'
        )
        await fs.writeFile(
          path.join(workspaceDir, 'progress.txt'),
          '# Ralph Progress Log\nStarted: ' + new Date().toISOString() + '\n---\n',
          'utf-8'
        )
      }

      // LOG: Agent started
      await this.log(runId, 'info', `Agent started for task: ${task.title}`, {
        workspace: workspaceDir,
        model: this.config.defaultModel,
      })

      // TODO: Here we would delegate to subagent via delegate_task
      // For now, mark as succeeded for demo
      console.log(`[Orchestrator] Agent ${runId} would run in ${workspaceDir}`)
      
      // Simulate running for demo
      await new Promise(resolve => setTimeout(resolve, 5000))

      await prisma.agentRun.update({
        where: { id: runId },
        data: { 
          status: RunStatus.succeeded, 
          completedAt: new Date(),
          summary: 'Task completed successfully (demo mode)',
        },
      })

      await prisma.task.update({
        where: { id: task.id },
        data: { 
          status: TaskStatus.human_review,
          completedAt: new Date(),
        },
      })

      await this.log(runId, 'info', 'Task completed - awaiting human review')

    } catch (error) {
      const err = error instanceof Error ? error.message : String(error)
      console.error(`[Orchestrator] Run ${runId} failed:`, err)
      
      await prisma.agentRun.update({
        where: { id: runId },
        data: { status: RunStatus.failed, error: err },
      })

      await prisma.task.update({
        where: { id: runId },
        data: { status: TaskStatus.failed, error: err },
      })

      await this.log(runId, 'error', `Agent failed: ${err}`)
    } finally {
      this.activeRuns.delete(runId)
    }
  }

  private async prepareWorkspace(task: any): Promise<string> {
    // Create isolated workspace directory
    const os = await import('os')
    const path = await import('path')
    const fs = await import('fs/promises')
    
    const workspaceRoot = path.join(os.tmpdir(), 'dor-orchestrator', 'workspaces')
    const workspaceDir = path.join(workspaceRoot, task.id)
    
    await fs.mkdir(workspaceDir, { recursive: true })
    
    // If project exists, clone it
    if (task.project?.cloneUrl) {
      // TODO: git clone into workspaceDir
      console.log(`[Orchestrator] Would clone ${task.project.cloneUrl} into ${workspaceDir}`)
    }
    
    return workspaceDir
  }

  private async log(runId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: any): Promise<void> {
    await prisma.agentLog.create({
      data: {
        runId,
        level,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })
  }

  getStatus(): { activeRuns: number; maxConcurrent: number; isRunning: boolean } {
    return {
      activeRuns: this.activeRuns.size,
      maxConcurrent: this.config.maxConcurrentRuns,
      isRunning: this.intervalId !== null,
    }
  }
}

// Singleton
let engine: OrchestratorEngine | null = null

export function getOrchestrator(config?: Partial<OrchestratorConfig>): OrchestratorEngine {
  if (!engine) {
    engine = new OrchestratorEngine(config)
  }
  return engine
}

export { OrchestratorEngine }
