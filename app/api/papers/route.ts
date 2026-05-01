import { unstable_rethrow } from 'next/navigation'
import { NextRequest, NextResponse } from 'next/server'
import { and, count, desc, eq, exists, ilike, inArray, or } from 'drizzle-orm'
import { normalizeGcsUrl } from '@/lib/normalize-gcs-url'
import { getPastPaperDetailPath } from '@/lib/seo'
import { examTypeLabel } from '@/lib/exam-slug'
import { course, db, pastPaper, pastPaperToTag, tag } from '@/db'

const DEFAULT_LIMIT = 40
const MAX_LIMIT = 200
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://examcooker.acmvit.in').replace(/\/$/, '')
const SOURCE_HOST = safeHostname(BASE_URL)
const API_KEYS = loadApiKeys()

type PastPaperWithTags = {
  id: string
  title: string
  thumbNailUrl: string | null
  examType: typeof pastPaper.$inferSelect.examType
  slot: string | null
  year: number | null
  createdAt: Date
  updatedAt: Date
  tags: { name: string }[]
  course: { code: string; title: string } | null
}

interface ApiPaper {
  _id: string
  id: string
  title: string
  name: string | null
  paperName: string | null
  subject: string | null
  courseName: string | null
  courseCode: string | null
  url: string
  paperUrl: string
  link: string
  paper_link: string
  downloadUrl: string
  finalUrl: string
  final_url: string
  file_url: string
  metadata: string | null
  description: string | null
  examType: string | null
  exam: string | null
  paperType: string | null
  slot: string | null
  year: string | null
  academicYear: string | null
  subjectCode: string | null
  tags: string[]
  thumbnailUrl: string | null
  thumbNailUrl: string | null
  createdAt: string
  updatedAt: string
  paperDate: string
  source: string
}

export async function GET(req: NextRequest) {
  try {
    const unauthorizedResponse = authorizeRequest(req)
    if (unauthorizedResponse) {
      return unauthorizedResponse
    }

    const params = req.nextUrl.searchParams
    const subjectQuery = sanitizeQuery(params.get('subject'))
    const limit = clampNumber(params.get('limit'), DEFAULT_LIMIT, MAX_LIMIT)
    const page = Math.max(1, clampNumber(params.get('page'), 1, Number.MAX_SAFE_INTEGER))
    const includeDrafts = params.get('includeDrafts') === '1'

    const filters = []
    if (!includeDrafts) {
      filters.push(eq(pastPaper.isClear, true))
    }
    if (subjectQuery) {
      filters.push(
        or(
          ilike(pastPaper.title, `%${subjectQuery}%`),
          exists(
            db
              .select({ id: pastPaperToTag.a })
              .from(pastPaperToTag)
              .innerJoin(tag, eq(pastPaperToTag.b, tag.id))
              .where(
                and(
                  eq(pastPaperToTag.a, pastPaper.id),
                  ilike(tag.name, subjectQuery),
                ),
              ),
          ),
        ),
      )
    }

    const where = filters.length > 0 ? and(...filters) : undefined

    const skip = (page - 1) * limit

    const [recordRows, totalRows] = await Promise.all([
      db
        .select({
          id: pastPaper.id,
          title: pastPaper.title,
          thumbNailUrl: pastPaper.thumbNailUrl,
          examType: pastPaper.examType,
          slot: pastPaper.slot,
          year: pastPaper.year,
          createdAt: pastPaper.createdAt,
          updatedAt: pastPaper.updatedAt,
          courseCode: course.code,
          courseTitle: course.title,
        })
        .from(pastPaper)
        .leftJoin(course, eq(pastPaper.courseId, course.id))
        .where(where)
        .orderBy(desc(pastPaper.createdAt))
        .offset(skip)
        .limit(limit),
      db
        .select({ total: count() })
        .from(pastPaper)
        .where(where),
    ])

    const recordIds = recordRows.map((record) => record.id)
    const tagRows =
      recordIds.length > 0
        ? await db
            .select({
              paperId: pastPaperToTag.a,
              name: tag.name,
            })
            .from(pastPaperToTag)
            .innerJoin(tag, eq(pastPaperToTag.b, tag.id))
            .where(inArray(pastPaperToTag.a, recordIds))
        : []

    const tagsByPaperId = new Map<string, Array<{ name: string }>>()
    for (const tagRow of tagRows) {
      const existing = tagsByPaperId.get(tagRow.paperId) ?? []
      existing.push({ name: tagRow.name })
      tagsByPaperId.set(tagRow.paperId, existing)
    }

    const records = recordRows.map<PastPaperWithTags>(record => ({
      id: record.id,
      title: record.title,
      thumbNailUrl: record.thumbNailUrl,
      examType: record.examType,
      slot: record.slot,
      year: record.year,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      tags: tagsByPaperId.get(record.id) ?? [],
      course:
        record.courseCode && record.courseTitle
          ? { code: record.courseCode, title: record.courseTitle }
          : null,
    }))

    const total = totalRows[0]?.total ?? 0
    const papers = records.map<ApiPaper>(paper => normalizePaper(paper))

    return NextResponse.json({
      success: true,
      source: SOURCE_HOST,
      filters: {
        subject: subjectQuery ?? null,
        includeDrafts,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
      },
      count: papers.length,
      searchUrl: req.nextUrl.href,
      papers,
    })
  } catch (error) {
    unstable_rethrow(error)
    console.error('papers api error', error)
    const message = error instanceof Error ? error.message : 'Unexpected error while fetching papers'
    return NextResponse.json(
      {
        success: false,
        source: SOURCE_HOST,
        error: message,
      },
      { status: 500 }
    )
  }
}

function normalizePaper(paper: PastPaperWithTags): ApiPaper {
  const tagNames = paper.tags.map(tag => tag.name)
  const courseCode = paper.course?.code ?? null
  const courseName = paper.course?.title ?? null
  const examTypeStr = paper.examType ? examTypeLabel(paper.examType) : null
  const yearStr = paper.year?.toString() ?? null
  const metadataParts = [examTypeStr, paper.slot ? `Slot ${paper.slot}` : undefined, yearStr, courseCode].filter(Boolean)
  const metadata = metadataParts.length > 0 ? metadataParts.join(' · ') : null
  const paperTitle = paper.title.replace(/\.pdf$/i, '')
  const paperUrl = buildPaperUrl(paper.id, courseCode)
  const description = [paperTitle, courseName, metadata].filter(Boolean).join(' — ') || null

  return {
    _id: paper.id,
    id: paper.id,
    title: paperTitle,
    name: courseName,
    paperName: paperTitle,
    subject: courseName,
    courseName,
    courseCode,
    url: paperUrl,
    paperUrl,
    link: paperUrl,
    paper_link: paperUrl,
    downloadUrl: paperUrl,
    finalUrl: paperUrl,
    final_url: paperUrl,
    file_url: paperUrl,
    metadata,
    description,
    examType: examTypeStr,
    exam: examTypeStr,
    paperType: examTypeStr,
    slot: paper.slot ?? null,
    year: yearStr,
    academicYear: null,
    subjectCode: courseCode,
    tags: tagNames,
    thumbnailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? null,
    thumbNailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? null,
    createdAt: paper.createdAt.toISOString(),
    updatedAt: paper.updatedAt.toISOString(),
    paperDate: paper.createdAt.toISOString(),
    source: SOURCE_HOST,
  }
}

function sanitizeQuery(value: string | null): string | undefined {
  if (!value) return undefined
  const cleaned = value.trim()
  return cleaned.length > 0 ? cleaned : undefined
}

function clampNumber(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), max)
}

function buildPaperUrl(id: string, courseCode?: string | null): string {
  return `${BASE_URL}${getPastPaperDetailPath(id, courseCode)}`
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch (_) {
    return 'examcooker'
  }
}

function authorizeRequest(req: NextRequest): NextResponse | null {
  if (API_KEYS.length === 0) {
    return NextResponse.json(
      {
        success: false,
        source: SOURCE_HOST,
        error: 'EXAMCOOKER_API_KEY is not configured on the server',
      },
      { status: 500 }
    )
  }

  const providedKey = extractApiKey(req)
  if (!providedKey) {
    return NextResponse.json(
      {
        success: false,
        source: SOURCE_HOST,
        error: 'Missing API key',
      },
      { status: 401 }
    )
  }

  if (!API_KEYS.includes(providedKey)) {
    return NextResponse.json(
      {
        success: false,
        source: SOURCE_HOST,
        error: 'Invalid API key',
      },
      { status: 401 }
    )
  }

  return null
}

function extractApiKey(req: NextRequest): string | null {
  const authHeader =
    req.headers.get('authorization') ||
    req.headers.get('authentication') ||
    req.headers.get('Authentication')
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (token) return token
  }

  const headerKeys = ['x-api-key', 'api-key']
  for (const header of headerKeys) {
    const value = req.headers.get(header)
    if (value) return value.trim()
  }

  return null
}

function loadApiKeys(): string[] {
  const key = (process.env.EXAMCOOKER_API_KEY || '').trim()
  return key ? [key] : []
}
