'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { TaskStatus, TaskType } from '@prisma/client'

export interface CreateTaskInput {
  projectId: string
  title: string
  description: string
  type: TaskType
  priority?: number
  prdJson?: string
}

export async function createTask(input: CreateTaskInput) {
  const task = await prisma.task.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      type: input.type,
      priority: input.priority ?? 1,
      prdJson: input.prdJson ?? null,
      status: TaskStatus.todo,
    },
  })
  revalidatePath('/dashboard')
  revalidatePath('/tasks')
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
  return task
}

export async function deleteTask(taskId: string) {
  await prisma.task.delete({ where: { id: taskId } })
  revalidatePath('/dashboard')
  revalidatePath('/tasks')
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
