import { z } from 'zod'

// ?page=1&pageSize=20 → { items, total, page, pageSize } (AGENTS.md). Ví dụ:
//   const query = pageQuery.parse(request.query)            // cần lọc thêm: pageQuery.extend({ status: ... })
//   const [items, total] = await db.$transaction([
//     db.post.findMany({ where, orderBy, ...pageArgs(query) }),
//     db.post.count({ where }),
//   ])
//   return toPage(items, total, query)
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type PageQuery = z.infer<typeof pageQuery>

export const pageArgs = ({ page, pageSize }: PageQuery) => ({ skip: (page - 1) * pageSize, take: pageSize })

export const toPage = <T>(items: T[], total: number, { page, pageSize }: PageQuery) => ({ items, total, page, pageSize })
