"use server";
import { PrismaClient } from "@prisma/client";
import { auth } from "../auth";

const prisma = new PrismaClient();

export async function updateBookmarkedPastPapers( pastPaperId: string, isFavorite: boolean) {
  try {
    const session = await auth();
    if (isFavorite) {
      // Add the past paper to bookmarkedPastPapers
      await prisma.user.update({
        where: { email: session.user.email! },
        data: {
          bookmarkedPastPapers: {
            connect: { id: pastPaperId }
          }
        }
      });
    } else {
      // Remove the past paper from bookmarkedPastPapers
      await prisma.user.update({
        where: { email: session?.user?.email },
        data: {
          bookmarkedPastPapers: {
            disconnect: { id: pastPaperId }
          }
        }
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error updating bookmarked past papers:', error);
    return { success: false, error: 'Failed to update bookmarked past papers' };
  }
}