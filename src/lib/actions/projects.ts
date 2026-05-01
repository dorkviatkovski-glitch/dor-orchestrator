'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'

export interface CreateProjectInput {
  name: string
  repoUrl: string
  cloneUrl: string
  branch?: string
  description?: string
}

export async function createProject(input: CreateProjectInput) {
  const project = await prisma.project.create({
    data: {
      name: input.name,
      repoUrl: input.repoUrl,
      cloneUrl: input.cloneUrl,
      branch: input.branch ?? 'main',
      description: input.description ?? null,
    },
  })
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  return project
}

export async function getProjects() {
  return prisma.project.findMany({
    include: {
      _count: {
        select: { tasks: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getProjectById(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      tasks: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })
}

export async function toggleProjectActive(id: string, isActive: boolean) {
  const project = await prisma.project.update({
    where: { id },
    data: { isActive },
  })
  revalidatePath('/projects')
  return project
}

export async function deleteProject(id: string) {
  await prisma.project.delete({ where: { id } })
  revalidatePath('/projects')
}
