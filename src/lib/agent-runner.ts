// Standalone Agent Runner
// Executed via child_process by the orchestrator
// Runs an AI agent loop with tool-like execution on a workspace

import * as fs from 'fs/promises'
import * as path from 'path'
import { execSync, spawn } from 'child_process'

interface AgentConfig {
  workspaceDir: string
  taskTitle: string
  taskDescription: string
  prdJson?: string
  model: string
  maxIterations: number
  runId: string
}

interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  metadata?: any
}

class AgentRunner {
  private config: AgentConfig
  private logs: LogEntry[] = []
  private iteration = 0
  private apiKey: string
  private baseUrl: string

  constructor(config: AgentConfig) {
    this.config = config
    this.apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || ''
    this.baseUrl = process.env.OPENROUTER_API_KEY
      ? 'https://openrouter.ai/api/v1'
      : process.env.OPENAI_API_KEY
        ? 'https://api.openai.com/v1'
        : 'https://api.anthropic.com/v1'
  }

  async run(): Promise<{ success: boolean; summary: string; error?: string }> {
    try {
      await this.log('info', `Agent runner started for: ${this.config.taskTitle}`)
      await this.log('info', `Workspace: ${this.config.workspaceDir}`)
      await this.log('info', `Model: ${this.config.model}`)

      // Write initial progress
      await this.writeProgress(`# Agent Run: ${this.config.taskTitle}\nStarted: ${new Date().toISOString()}\nModel: ${this.config.model}\n---\n`)

      // Main agent loop
      for (this.iteration = 0; this.iteration < this.config.maxIterations; this.iteration++) {
        await this.log('info', `Iteration ${this.iteration + 1}/${this.config.maxIterations}`)

        // Gather context
        const context = await this.gatherContext()

        // Call AI
        const response = await this.callAI(context)
        if (!response) {
          await this.log('error', 'AI API returned no response')
          break
        }

        // Parse and execute actions
        const actions = this.parseActions(response)
        if (actions.length === 0) {
          await this.log('info', 'No actions to execute - task may be complete')
          await this.writeProgress(`\n## Iteration ${this.iteration + 1}\nAI response: ${response}\n`)
          continue
        }

        let anyActionExecuted = false
        for (const action of actions) {
          const result = await this.executeAction(action)
          await this.writeProgress(`\n## Iteration ${this.iteration + 1}\nAction: ${action.type}\nResult: ${result}\n`)
          if (result !== 'skipped') anyActionExecuted = true
        }

        if (!anyActionExecuted) {
          await this.log('info', 'No actionable items - marking complete')
          break
        }

        // Check for termination signal
        if (response.includes('[TASK_COMPLETE]') || response.includes('## Done')) {
          await this.log('info', 'Task completion signal received')
          break
        }
      }

      const summary = await this.generateSummary()
      await this.log('info', 'Agent run completed', { iterations: this.iteration })
      return { success: true, summary }
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error)
      await this.log('error', `Agent run failed: ${err}`)
      return { success: false, summary: '', error: err }
    }
  }

  private async gatherContext(): Promise<string> {
    const files: string[] = []
    
    // Read workspace file listing
    try {
      const entries = await fs.readdir(this.config.workspaceDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile() && !entry.name.startsWith('.')) {
          files.push(entry.name)
        }
      }
    } catch { /* ignore */ }

    // Read PRD if exists
    let prd = ''
    try {
      prd = await fs.readFile(path.join(this.config.workspaceDir, 'prd.json'), 'utf-8')
    } catch { /* ignore */ }

    // Read progress so far
    let progress = ''
    try {
      progress = await fs.readFile(path.join(this.config.workspaceDir, 'progress.txt'), 'utf-8')
    } catch { /* ignore */ }

    return `Task: ${this.config.taskTitle}
Description: ${this.config.taskDescription}

Workspace files: ${files.join(', ') || '(empty)'}

PRD: ${prd || '(none)'}

Progress so far:
${progress || '(none)'}

Current iteration: ${this.iteration + 1}/${this.config.maxIterations}

You are an AI coding agent. You can use these actions:
- WRITE_FILE <path> <content> - Write content to a file
- APPEND_FILE <path> <content> - Append content to a file
- READ_FILE <path> - Read a file (will be returned in next turn)
- EXECUTE <command> - Execute a shell command in the workspace
- TASK_COMPLETE <summary> - Mark task as complete

Respond with one or more actions, each on its own line.
`
  }

  private async callAI(context: string): Promise<string | null> {
    if (!this.apiKey) {
      await this.log('error', 'No API key available')
      return null
    }

    try {
      const isAnthropic = this.baseUrl.includes('anthropic')
      
      if (isAnthropic) {
        // Anthropic API
        const res = await fetch(`${this.baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: this.config.model.includes('claude') ? this.config.model : 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            messages: [{ role: 'user', content: context }],
          }),
        })
        const data = await res.json()
        return data.content?.[0]?.text || data.completion || null
      }

      // OpenAI-compatible API (OpenRouter, OpenAI)
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          ...(this.baseUrl.includes('openrouter') ? { 'HTTP-Referer': 'https://dor-orchestrator.local', 'X-Title': 'DOR-Orchestrator' } : {}),
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: context }],
          max_tokens: 4096,
          temperature: 0.2,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        await this.log('error', `API error: ${res.status} ${err}`)
        return null
      }

      const data = await res.json()
      return data.choices?.[0]?.message?.content || null
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error)
      await this.log('error', `AI call failed: ${err}`)
      return null
    }
  }

  private parseActions(response: string): Array<{ type: string; args: string[] }> {
    const actions: Array<{ type: string; args: string[] }> = []
    const lines = response.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('WRITE_FILE ')) {
        const rest = trimmed.slice('WRITE_FILE '.length)
        const spaceIdx = rest.indexOf(' ')
        if (spaceIdx > 0) {
          actions.push({ type: 'WRITE_FILE', args: [rest.slice(0, spaceIdx), rest.slice(spaceIdx + 1)] })
        }
      } else if (trimmed.startsWith('APPEND_FILE ')) {
        const rest = trimmed.slice('APPEND_FILE '.length)
        const spaceIdx = rest.indexOf(' ')
        if (spaceIdx > 0) {
          actions.push({ type: 'APPEND_FILE', args: [rest.slice(0, spaceIdx), rest.slice(spaceIdx + 1)] })
        }
      } else if (trimmed.startsWith('READ_FILE ')) {
        actions.push({ type: 'READ_FILE', args: [trimmed.slice('READ_FILE '.length)] })
      } else if (trimmed.startsWith('EXECUTE ')) {
        actions.push({ type: 'EXECUTE', args: [trimmed.slice('EXECUTE '.length)] })
      } else if (trimmed.startsWith('TASK_COMPLETE ')) {
        actions.push({ type: 'TASK_COMPLETE', args: [trimmed.slice('TASK_COMPLETE '.length)] })
      }
    }

    return actions
  }

  private async executeAction(action: { type: string; args: string[] }): Promise<string> {
    const filepath = action.args[0]
    const fullPath = path.join(this.config.workspaceDir, filepath)

    // Safety: prevent escaping workspace
    if (!fullPath.startsWith(this.config.workspaceDir)) {
      return 'blocked: path escapes workspace'
    }

    switch (action.type) {
      case 'WRITE_FILE': {
        try {
          await fs.mkdir(path.dirname(fullPath), { recursive: true })
          await fs.writeFile(fullPath, action.args[1], 'utf-8')
          await this.log('info', `Wrote file: ${filepath}`)
          return `Wrote ${filepath} (${action.args[1].length} chars)`
        } catch (error: any) {
          return `Error: ${error.message}`
        }
      }
      case 'APPEND_FILE': {
        try {
          await fs.mkdir(path.dirname(fullPath), { recursive: true })
          await fs.appendFile(fullPath, action.args[1], 'utf-8')
          await this.log('info', `Appended to file: ${filepath}`)
          return `Appended to ${filepath}`
        } catch (error: any) {
          return `Error: ${error.message}`
        }
      }
      case 'READ_FILE': {
        try {
          const content = await fs.readFile(fullPath, 'utf-8')
          return `Content of ${filepath}:\n${content.slice(0, 2000)}${content.length > 2000 ? '...' : ''}`
        } catch (error: any) {
          return `Error reading ${filepath}: ${error.message}`
        }
      }
      case 'EXECUTE': {
        try {
          const cmd = action.args[0]
          await this.log('info', `Executing: ${cmd}`)
          const result = execSync(cmd, {
            cwd: this.config.workspaceDir,
            timeout: 30000,
            encoding: 'utf-8',
          })
          return `Output:\n${result}`
        } catch (error: any) {
          return `Error: ${error.message}\n${error.stderr || ''}`
        }
      }
      case 'TASK_COMPLETE': {
        return 'task_complete'
      }
      default:
        return 'skipped'
    }
  }

  private async generateSummary(): Promise<string> {
    // Read progress file as summary
    try {
      const progress = await fs.readFile(path.join(this.config.workspaceDir, 'progress.txt'), 'utf-8')
      return progress.slice(0, 2000)
    } catch {
      return 'Agent completed the task.'
    }
  }

  private async writeProgress(text: string): Promise<void> {
    const progressPath = path.join(this.config.workspaceDir, 'progress.txt')
    try {
      await fs.appendFile(progressPath, text + '\n', 'utf-8')
    } catch {
      // ignore
    }
  }

  async log(level: LogEntry['level'], message: string, metadata?: any): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
    }
    this.logs.push(entry)
    console.log(`[${level.toUpperCase()}] ${message}`)
  }

  getLogs(): LogEntry[] {
    return this.logs
  }
}

// Main entry point when run via CLI
async function main() {
  const configArg = process.argv.find(arg => arg.startsWith('--config='))
  if (!configArg) {
    console.error('Usage: tsx agent-runner.ts --config=<json>')
    process.exit(1)
  }

  const config: AgentConfig = JSON.parse(configArg.slice('--config='.length))
  const runner = new AgentRunner(config)
  const result = await runner.run()

  // Output result as JSON for parent process
  console.log('\n__RESULT__' + JSON.stringify(result))
}

if (require.main === module) {
  main().catch(console.error)
}

export { AgentRunner }
export type { AgentConfig }
