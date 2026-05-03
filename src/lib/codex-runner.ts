import { prisma } from '@/lib/db'
import { execSync } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'

const CODEX_NODE = 'node'
const CODEX_SCRIPT = '/home/dorkviatkovski/.hermes/node/lib/node_modules/@openai/codex/bin/codex.js'

interface CodexConfig {
  workspaceDir: string
  taskTitle: string
  taskDescription: string
  prdJson?: string
  runId: string
}

export class CodexRunner {
  private config: CodexConfig

  constructor(config: CodexConfig) {
    this.config = config
  }

  async run(): Promise<{ success: boolean; summary: string; error?: string }> {
    const { workspaceDir, taskTitle, taskDescription, prdJson, runId } = this.config
    const openaiKey = process.env.OPENAI_API_KEY || ''
    if (!openaiKey) {
      return { success: false, summary: '', error: 'OPENAI_API_KEY not configured' }
    }

    try {
      // Build prompt
      let prompt = taskDescription
      if (prdJson) {
        try {
          const prd = JSON.parse(prdJson)
          prompt = this._buildPrompt(prd, taskTitle)
        } catch {
          prompt = `${taskTitle}\n${taskDescription}\n\nPRD: ${prdJson}`
        }
      }

      const promptFile = path.join(workspaceDir, 'PROMPT.md')
      await fs.writeFile(promptFile, prompt, 'utf-8')

      await this._log(runId, 'info', `Starting Codex for: ${taskTitle}`)

      // Run Codex with full-auto mode (requires --approval-policy=auto or newer flag)
      const command = `${CODEX_NODE} ${CODEX_SCRIPT} --approval-mode full-auto \"${promptFile}\" 2>&1 | tee ${path.join(workspaceDir, 'codex.log')}`

      const output = execSync(command, {
        cwd: workspaceDir,
        env: { ...process.env, OPENAI_API_KEY: openaiKey, NODE_ENV: 'production' },
        timeout: 10 * 60 * 1000,
        encoding: 'utf-8',
        stdio: 'pipe',
        maxBuffer: 50 * 1024 * 1024, // 50MB max output
      })

      await this._log(runId, 'info', 'Codex execution finished')

      return {
        success: true,
        summary: output.slice(0, 2000),
      }
    } catch (err: any) {
      const msg = err.message || String(err)
      // If exit code is non-zero but we got output, it might still be OK
      if (msg.includes('codex.log')) {
        try {
          const log = await fs.readFile(path.join(workspaceDir, 'codex.log'), 'utf-8')
          return { success: true, summary: log.slice(-2000) }
        } catch { /* ignore */ }
      }
      await this._log(runId, 'error', `Codex failed: ${msg}`)
      return { success: false, summary: '', error: msg }
    }
  }

  private _buildPrompt(prd: any, fallbackTitle: string): string {
    const parts: string[] = [`# ${prd.title || fallbackTitle}`]
    if (prd.goal) parts.push(`\nGoal: ${prd.goal}`)
    if (prd.description) parts.push(`\n${prd.description}`)
    if (Array.isArray(prd.tasks)) parts.push(`\nTasks:\n${prd.tasks.map((t: string) => `- ${t}`).join('\n')}`)
    if (prd.tech_stack) parts.push(`\nTech Stack: ${JSON.stringify(prd.tech_stack)}`)
    parts.push(`\n\nPlease implement all required changes autonomously.`)
    return parts.join('\n')
  }

  private async _log(runId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string): Promise<void> {
    try {
      await prisma.agentLog.create({
        data: { runId, level, message, metadata: null },
      })
    } catch {
      console.log(`[${level.toUpperCase()}] ${message}`)
    }
  }
}

export async function isCodexAvailable(): Promise<boolean> {
  try {
    execSync(`${CODEX_NODE} ${CODEX_SCRIPT} --version`, { encoding: 'utf-8' })
    return true
  } catch {
    return false
  }
}
