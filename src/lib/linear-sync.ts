import { prisma } from '@/lib/db'
import { TaskStatus, AgentType } from '@prisma/client'

const LINEAR_API_KEY = process.env.LINEAR_API_KEY ?? ''
const LINEAR_ENDPOINT = 'https://api.linear.app/graphql'

interface LinearIssue {
  id: string
  identifier: string
  title: string
  description: string | null
  priority: number
  state: { name: string; type: string }
  url: string
  project?: { name: string; id: string } | null
  team?: { key: string; id: string } | null
}

const STATE_MAP: Record<string, TaskStatus> = {
  triage: TaskStatus.todo,
  backlog: TaskStatus.todo,
  unstarted: TaskStatus.todo,
  started: TaskStatus.claimed,
  completed: TaskStatus.done,
  canceled: TaskStatus.cancelled,
}

function priorityFromLinear(p: number | null): number {
  if (p === 1) return 5
  if (p === 2) return 4
  if (p === 3) return 3
  if (p === 4) return 2
  return 1
}

export class LinearSyncService {
  private apiKey: string

  constructor(apiKey: string = LINEAR_API_KEY) {
    this.apiKey = apiKey
  }

  async callLinear(query: string, variables?: Record<string, any>): Promise<any> {
    const res = await fetch(LINEAR_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Linear API ${res.status}: ${err}`)
    }
    const json = await res.json()
    if (json.errors) {
      throw new Error(`Linear GraphQL errors: ${JSON.stringify(json.errors)}`)
    }
    return json.data
  }

  async fetchIssues(filter?: { stateType?: string; teamKey?: string }): Promise<LinearIssue[]> {
    let filterStr = ''
    if (filter?.stateType) {
      filterStr = `, filter: { state: { type: { in: [\`${filter.stateType}\`] } } }`
    }
    if (filter?.teamKey) {
      filterStr = `, filter: { team: { key: { eq: \`${filter.teamKey}\` } } }`
    }

    const query = `{
      issues(first: 50${filterStr}) {
        nodes {
          id
          identifier
          title
          description
          priority
          state { name type }
          url
          project { name id }
          team { key id }
        }
      }
    }`

    const data = await this.callLinear(query)
    return data.issues?.nodes ?? []
  }

  async fetchTeams(): Promise<Array<{ id: string; key: string; name: string }>> {
    const data = await this.callLinear(`{ teams { nodes { id key name } } }`)
    return data.teams?.nodes ?? []
  }

  async syncIncomingIssues(): Promise<{ created: number; updated: number; skipped: number }> {
    const issues = await this.fetchIssues()
    let created = 0, updated = 0, skipped = 0

    for (const issue of issues) {
      const existing = await prisma.task.findFirst({
        where: { linearIssueId: issue.id },
      })

      const status = STATE_MAP[issue.state?.type] ?? TaskStatus.todo
      const priority = priorityFromLinear(issue.priority ?? 3)

      if (existing) {
        if (existing.status !== status || existing.title !== `[${issue.identifier}] ${issue.title}`) {
          await prisma.task.update({
            where: { id: existing.id },
            data: { status, title: `[${issue.identifier}] ${issue.title}`, priority },
          })
          updated++
        } else {
          skipped++
        }
      } else {
        const project = await this._ensureProject(issue)

        await prisma.task.create({
          data: {
            projectId: project.id,
            linearIssueId: issue.id,
            title: `[${issue.identifier}] ${issue.title}`,
            description: issue.description ?? issue.url,
            type: this._guessType(issue) as any,
            status,
            priority,
            agentType: AgentType.codex,
          },
        })
        created++
      }
    }

    return { created, updated, skipped }
  }

  private async _ensureProject(issue: LinearIssue) {
    const name = issue.project?.name ?? `Linear ${issue.team?.key ?? 'Team'}`
    const existing = await prisma.project.findFirst({ where: { name } })
    if (existing) return existing

    return prisma.project.create({
      data: {
        name,
        repoUrl: issue.project?.id ? `https://linear.app/project/${issue.project.id}` : 'https://linear.app',
        cloneUrl: '',
        description: `Synced from Linear team ${issue.team?.key ?? 'unknown'}`,
      },
    })
  }

  private _guessType(issue: LinearIssue): string {
    const t = issue.title.toLowerCase()
    if (t.includes('bug') || t.includes('fix') || t.includes('crash')) return 'bugfix'
    if (t.includes('refactor') || t.includes('cleanup')) return 'refactor'
    if (t.includes('doc') || t.includes('readme')) return 'docs'
    if (t.includes('test') || t.includes('spec')) return 'test'
    return 'enhancement'
  }
}

export async function syncLinearIssues(): Promise<{ created: number; updated: number; skipped: number }> {
  const sync = new LinearSyncService()
  return sync.syncIncomingIssues()
}
