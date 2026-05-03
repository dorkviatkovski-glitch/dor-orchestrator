'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { TaskStatus, TaskType, RunStatus, AgentType } from '@prisma/client'

export interface CreateTaskInput {
  projectId: string
  title: string
  description: string
  type: TaskType
  priority?: number
  prdJson?: string
  linearIssueId?: string
  agentType?: AgentType
}

export async function createTask(input: CreateTaskInput) {
  const task = await prisma.task.create({
    data: {
      projectId: input.projectId,
      linearIssueId: input.linearIssueId ?? null,
      title: input.title,
      description: input.description,
      type: input.type,
      agentType: input.agentType ?? AgentType.generic,
      priority: input.priority ?? 1,
      prdJson: input.prdJson ?? null,
      status: TaskStatus.todo,
    },
  })
  revalidatePath('/dashboard')
  revalidatePath('/tasks')
  revalidatePath(`/projects/${input.projectId}`)
  return task
}

export async function getTasks(projectId?: string) {
  return prisma.task.findMany({
    where: projectId ? { projectId } : undefined,
    include: {
      project: true,
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [
      { status: 'asc' },
      { priority: 'desc' },
      { createdAt: 'asc' },
    ],
  })
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status },
  })
  revalidatePath('/dashboard')
  revalidatePath('/tasks')
  revalidatePath(`/projects/${task.projectId}`)
  return task
}

export async function deleteTask(taskId: string) {
  const task = await prisma.task.delete({ where: { id: taskId } })
  revalidatePath('/dashboard')
  revalidatePath('/tasks')
  revalidatePath(`/projects/${task.projectId}`)
  return task
}

export async function getTaskById(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: true,
      runs: {
        include: {
          logs_line: {
            orderBy: { timestamp: 'desc' },
            take: 50,
          },
        },
      },
    },
  })
}

export async function rerunTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw new Error('Task not found')

  // Reset task to todo
  await prisma.task.update({
    where: { id: taskId },
    data: { status: TaskStatus.todo },
  })

  revalidatePath('/dashboard')
  revalidatePath('/tasks')
  revalidatePath('/agents')
  revalidatePath(`/projects/${task.projectId}`)
  return task
}

export async function syncLinearAndRefresh() {
  const { syncLinearIssues } = await import('@/lib/linear-sync')
  const result = await syncLinearIssues()
  return result
}
