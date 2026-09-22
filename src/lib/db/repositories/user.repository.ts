import type { Role } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'

/** The only fields the session and guards need. Keeps the query narrow. */
const SESSION_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  onboardedAt: true,
} as const

export function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: SESSION_SELECT })
}

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email }, select: SESSION_SELECT })
}

export function createUserWithRole(input: {
  id: string
  email: string
  name: string
  role: Role
}) {
  return prisma.user.create({ data: input, select: SESSION_SELECT })
}

export function markOnboarded(id: string) {
  return prisma.user.update({
    where: { id },
    data: { onboardedAt: new Date() },
    select: SESSION_SELECT,
  })
}
