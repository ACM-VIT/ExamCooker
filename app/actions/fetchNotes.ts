// app/actions/fetchNotes.ts
"use server";

import { PrismaClient } from "@prisma/client";

async function fetchNotes() {
  const prisma = new PrismaClient();
  const notes = await prisma.note.findMany({
    include : {
      author : true,
    }
  });
  return notes;
}

export default fetchNotes;
