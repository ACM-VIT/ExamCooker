'use server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function getTags() {
    try {
        const tags = await prisma.tag.findMany()
        console.log(tags)
        return tags.map(tag => tag.name)
    } catch (error) {
        console.error('Failed to fetch tags:', error)
        throw new Error('Failed to fetch tags')
    }
}
