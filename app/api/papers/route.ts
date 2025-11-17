import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma, PastPaper } from '@/src/generated/prisma'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 40
const MAX_LIMIT = 200
const SLOT_TAG_REGEX = /^[A-G][1-2]$/i
const YEAR_TAG_REGEX = /^20\d{2}$/
const SLOT_REGEX = /\b([A-G][1-2])\b/i
const YEAR_RANGE_REGEX = /\b((?:20)?\d{2})\s*-\s*((?:20)?\d{2})\b/
const YEAR_REGEX = /\b(20\d{2})\b/
const COURSE_CODE_REGEX = /([A-Z]{2,4}\d{3}[A-Z]{0,3})/g
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://examcooker.acmvit.in').replace(/\/$/, '')
const SOURCE_HOST = safeHostname(BASE_URL)
const API_KEYS = loadApiKeys()

type PastPaperWithTags = PastPaper & { tags: { name: string }[] }

interface ParsedTitle {
  cleanTitle: string
  examType?: string
  slot?: string
  year?: string
  academicYear?: string
  courseCode?: string
  courseName?: string
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

    const where: Prisma.PastPaperWhereInput = {
      ...(includeDrafts ? {} : { isClear: true }),
      ...(subjectQuery
        ? {
            OR: [
              { title: { contains: subjectQuery, mode: 'insensitive' } },
              { tags: { some: { name: { equals: subjectQuery, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    }

    const skip = (page - 1) * limit

    const [records, total] = await Promise.all([
      prisma.pastPaper.findMany({
        where,
        include: { tags: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.pastPaper.count({ where }),
    ])

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
  const parsed = parseTitle(paper.title)
  const tagNames = paper.tags.map(tag => tag.name)
  const slotFromTags = parsed.slot ?? findFirst(tagNames, value => SLOT_TAG_REGEX.test(value))
  const yearFromTags = parsed.year ?? findFirst(tagNames, value => YEAR_TAG_REGEX.test(value))
  const metadataParts = [
    parsed.examType,
    slotFromTags ? `Slot ${slotFromTags.toUpperCase()}` : undefined,
    parsed.academicYear ?? yearFromTags,
    parsed.courseCode,
  ].filter(Boolean)

  const displayTitle = parsed.cleanTitle
  const courseName = parsed.courseName ?? null
  const courseCode = parsed.courseCode ?? null
  const paperUrl = buildPaperUrl(paper.id)
  const metadata = metadataParts.length > 0 ? metadataParts.join(' · ') : null

  return {
    _id: paper.id,
    id: paper.id,
    title: displayTitle,
    name: courseName,
    paperName: courseName,
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
    description: buildDescription(courseName, parsed, metadata),
    examType: parsed.examType ?? null,
    exam: parsed.examType ?? null,
    paperType: parsed.examType ?? null,
    slot: slotFromTags?.toUpperCase() ?? null,
    year: yearFromTags ?? parsed.year ?? null,
    academicYear: parsed.academicYear ?? null,
    subjectCode: courseCode,
    tags: tagNames,
    thumbnailUrl: paper.thumbNailUrl ?? null,
    thumbNailUrl: paper.thumbNailUrl ?? null,
    createdAt: paper.createdAt.toISOString(),
    updatedAt: paper.updatedAt.toISOString(),
    paperDate: paper.createdAt.toISOString(),
    source: SOURCE_HOST,
  }
}

function parseTitle(rawTitle: string): ParsedTitle {
  const cleanTitle = rawTitle.replace(/\.pdf$/i, '').replace(/select$/i, '').trim()
  const examType = extractExamType(cleanTitle)
  const slot = extractSlot(cleanTitle)
  const { academicYear, year } = extractYear(cleanTitle)
  const courseCode = extractCourseCode(cleanTitle)
  const courseName = extractCourseName(cleanTitle, courseCode)

  return {
    cleanTitle,
    examType,
    slot,
    year,
    academicYear,
    courseCode,
    courseName,
  }
}

function extractExamType(title: string): string | undefined {
  const patterns: { regex: RegExp; normalize: (value: string) => string }[] = [
    { regex: /\bcat[-\s]?1\b/i, normalize: () => 'CAT-1' },
    { regex: /\bcat[-\s]?2\b/i, normalize: () => 'CAT-2' },
    { regex: /\bfat\b/i, normalize: () => 'FAT' },
    { regex: /\bmid(?:term)?\b/i, normalize: () => 'MID' },
    { regex: /\bquiz\b/i, normalize: () => 'Quiz' },
    { regex: /\bcia\b/i, normalize: () => 'CIA' },
  ]

  for (const { regex, normalize } of patterns) {
    if (regex.test(title)) {
      return normalize(title.match(regex)?.[0] || '')
    }
  }
  return undefined
}

function extractSlot(title: string): string | undefined {
  const match = title.match(SLOT_REGEX)
  return match ? match[1].toUpperCase() : undefined
}

function extractYear(title: string): { academicYear?: string; year?: string } {
  const rangeMatch = title.match(YEAR_RANGE_REGEX)
  if (rangeMatch) {
    const start = normalizeYear(rangeMatch[1])
    const end = normalizeYear(rangeMatch[2])
    if (start && end) {
      return {
        academicYear: `${start}-${end}`,
        year: start,
      }
    }
  }

  const singleMatch = title.match(YEAR_REGEX)
  if (singleMatch) {
    const normalized = normalizeYear(singleMatch[1])
    return { year: normalized, academicYear: normalized }
  }

  return {}
}

function extractCourseCode(title: string): string | undefined {
  let courseCode: string | undefined
  let match: RegExpExecArray | null
  while ((match = COURSE_CODE_REGEX.exec(title.toUpperCase())) !== null) {
    courseCode = match[1].toUpperCase()
  }
  COURSE_CODE_REGEX.lastIndex = 0
  return courseCode
}

function extractCourseName(title: string, courseCode?: string): string | undefined {
  let working = title
  if (courseCode) {
    const idx = working.toUpperCase().lastIndexOf(courseCode)
    if (idx > -1) {
      working = working.slice(0, idx)
    }
  }

  working = working.replace(/[-–—]\s*$/, '').trim()

  const tokens = working.split(/\s+/)
  const resultTokens: string[] = []
  let started = false

  for (const token of tokens) {
    if (!started) {
      if (isMetadataToken(token)) {
        continue
      }
      started = true
    }
    resultTokens.push(token)
  }

  const name = resultTokens.join(' ').trim()
  return name || undefined
}

function isMetadataToken(token: string): boolean {
  const normalized = token.replace(/[^a-z0-9-]/gi, '').toLowerCase()
  if (!normalized) return true
  if (/^cat-?\d$/.test(normalized)) return true
  if (/^(fat|quiz|mid|cia)$/.test(normalized)) return true
  if (/^(qp|paper|select)$/.test(normalized)) return true
  if (/^[a-g]\d$/i.test(normalized)) return true
  if (/^\d{2}-\d{2}$/.test(normalized)) return true
  if (/^20\d{2}$/.test(normalized)) return true
  return false
}

function normalizeYear(value?: string): string | undefined {
  if (!value) return undefined
  const digits = value.replace(/\D/g, '')
  if (digits.length === 4) return digits
  if (digits.length === 2) {
    const parsed = parseInt(digits, 10)
    if (!Number.isNaN(parsed)) {
      return (2000 + parsed).toString()
    }
  }
  return undefined
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

function buildPaperUrl(id: string): string {
  return `${BASE_URL}/past_papers/${id}`
}

function buildDescription(courseName: string | null, meta: ParsedTitle, metadata: string | null): string | null {
  const pieces = [courseName ?? meta.cleanTitle, metadata]
  const description = pieces.filter(Boolean).join(' — ')
  return description || null
}

function findFirst<T>(items: T[], predicate: (value: T) => boolean): T | undefined {
  for (const item of items) {
    if (predicate(item)) {
      return item
    }
  }
  return undefined
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
