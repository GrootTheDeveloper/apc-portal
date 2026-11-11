import { z } from 'zod'

// Danh sách các slug dành riêng cho hệ thống web (không cho đặt trùng route tĩnh)
export const RESERVED_SLUGS  = ['application-lookup', 'new', 'edit', 'preview']


export const QuestionTypeSchema = z.enum([
  'short_text',
  'long_text',
  'single_choice',
  'multiple_choice',
])

export const QuestionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, 'Nhãn lựa chọn không được để trống').max(200, 'Nhãn lựa chọn tối đa 200 ký tự'),
})

export const QuestionSchema = z.object({
  id: z.string().min(1),
  type: QuestionTypeSchema,
  label: z.string().min(1, 'Nội dung câu hỏi không được để trống').max(500, 'Nội dung câu hỏi tối đa 500 ký tự'),
  required: z.boolean().default(false),
  options: z.array(QuestionOptionSchema).optional().default([]),
  hidden: z.boolean().optional().default(false),
})

.superRefine((q,ctx) => {
  // Câu tự luận không được có options
  if ((q.type === 'short_text' || q.type === 'long_text') && q.options && q.options.length > 0) {
    ctx.addIssue({
      code : z.ZodIssueCode.custom,
      message: 'Câu hỏi tự luận không được có danh sách lựa chọn',
      path : ['options'],
    })
  }
  // Câu lựa chọn bắt buộc phải có ít nhất 1 option và không được trùng id option
  if (q.type === 'single_choice' || q.type === 'multiple_choice') {
      if (!q.options || q.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Câu hỏi dạng lựa chọn phải có ít nhất 1 lựa chọn',
          path: ['options'],
        })
      } else {
        const optIds = new Set<string>()
        for (let i = 0; i < q.options.length; i++) {
          const optId = q.options[i]?.id
          if (optId) {
            if (optIds.has(optId)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `ID lựa chọn "${optId}" bị trùng lặp`,
                path: ['options', i, 'id'],
              })
            }
            optIds.add(optId)
          }
        }
      }
    }
})

export type Question = z.infer<typeof QuestionSchema>
export type QuestionOption = z.infer<typeof QuestionOptionSchema>

// Kiểm tra mảng câu hỏi không bị trùng id câu hỏi
const QuestionsArraySchema = z
  .array(QuestionSchema)
  .max(50, 'Tối đa 50 câu hỏi')
  .superRefine((questions, ctx) => {
    const qIds = new Set<string>()
    for (let i = 0; i < questions.length; i++) {
      const qId = questions[i]?.id
      if (qId) {
        if (qIds.has(qId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `ID câu hỏi "${qId}" bị trùng lặp`,
            path: [i, 'id'],
          })
        }
        qIds.add(qId)
      }
    }
  })

export const CreateRecruitmentRoundSchema = z.object({
  title: z
  .string()
  .min(3, 'Tiêu đề đợt tuyển tối thiểu 3 ký tự')
  .max(200, 'Tiêu đề tối đa 200 ký tự'),
  slug: z
  .string()
  .min(3, 'Slug tối thiểu 3 ký tự')
  .max(100, 'Slug tối đa 100 ký tự')
  .regex(/^[a-z0-9-]+$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang')
  .refine((val) => !RESERVED_SLUGS.includes(val), {
        message: 'Slug này trùng với đường dẫn tĩnh của hệ thống',
  }),
  description: z
  .string()
  .min(10, 'Mô tả tối thiểu 10 ký tự')
  .max(5000, 'Mô tả tối đa 5000 ký tự'),
  audience: z
  .string()
  .min(5, 'Đối tượng tuyển tối thiểu 5 ký tự')
  .max(1000, 'Đối tượng tối đa 1000 ký tự'),
  requirements: z
  .string()
  .min(5, 'Điều kiện ứng tuyển tối thiểu 5 ký tự')
  .max(2000, 'Điều kiện tối đa 2000 ký tự'),
  opensAt: z
  .string()
  .datetime({ message: 'Thời gian mở không hợp lệ' }),
  closesAt: z
  .string()
  .datetime({ message: 'Thời gian đóng không hợp lệ' }),
  departmentIds: z
  .array(z.string())
  .min(1, 'Phải chọn ít nhất 1 ban chuyên môn'),
  questions: QuestionsArraySchema
  .optional()
  .default([]),
})
.refine((data) => new Date(data.closesAt) > new Date(data.opensAt), {
  message: 'Thời gian kết thúc phải sau thời gian bắt đầu',
  path: ['closesAt'],
})

export const UpdateRecruitmentRoundSchema = z.object({
  title: z.string().min(3).optional(),
  slug: z
  .string()
  .min(3)
  .regex(/^[a-z0-9-]+$/)
  .refine((val) => !RESERVED_SLUGS.includes(val), {
    message: 'Slug này trùng với đường dẫn tĩnh của hệ thống',
  })
  .optional(),
  description: z.string().min(10).max(5000).optional(),
  audience: z.string().min(5).max(1000).optional(),
  requirements: z.string().min(5).max(2000).optional(),
  opensAt: z.string().datetime().optional(),
  closesAt: z.string().datetime().optional(),
  departmentIds: z.array(z.string()).min(1, 'Phải chọn ít nhất 1 ban chuyên môn').optional(),
  questions: QuestionsArraySchema.optional(),
})
.refine(
  (data) => {
    if (data.opensAt && data.closesAt) {
      return new Date(data.closesAt) > new Date(data.opensAt)
    }
    return true
  },
  {
    message: 'Thời gian kết thúc phải sau thời gian bắt đầu',
    path: ['closesAt'],
  },
)

export const ChangeRoundStatusSchema = z.object({
  status: z.enum(['OPEN', 'CLOSED', 'ARCHIVED']),
})

export const SubmitApplicationSchema = z.object({
  applicantName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(100),
  applicantEmail: z.string().trim().email('Email không hợp lệ').max(254,'Email tối đa 254 ký tự').toLowerCase(),
  studentId: z.string().trim().min(3, 'Mã số sinh viên không hợp lệ').max(20).toUpperCase(),
  faculty: z.string().trim().max(100).optional().nullable(),
  major: z.string().trim().max(100).optional().nullable(),
  cohort: z.string().trim().max(50).optional().nullable(),
  desiredDepartmentId: z.string().min(1, 'Vui lòng chọn ban mong muốn'),
  skills: z.string().trim().max(1000).optional().nullable(),
  experience: z.string().trim().max(2000).optional().nullable(),
  answers: z.record(z.string(), z.unknown()).optional().default({}),
  consent: z.boolean().refine((val) => val === true, {
    message: 'Bạn phải đồng ý với chính sách xử lý dữ liệu cá nhân',
  }),
})

export type SubmitApplicationInput = z.infer<typeof SubmitApplicationSchema>
export const LookupApplicationSchema = z.object({
  email: z.string().trim().email('Email không đúng định dạng').max(254, 'Email tối đa 254 ký tự').toLowerCase(),
  code: z.string().trim().min(1, 'Mã hồ sơ không được để trống').max(32, 'Mã hồ sơ tối đa 32 ký tự').toUpperCase(),
})
export type LookupApplicationInput = z.infer<typeof LookupApplicationSchema>

export const WithdrawApplicationSchema = LookupApplicationSchema
export type WithdrawApplicationInput = LookupApplicationInput

// ─── ADMIN SCHEMAS (R5) ────────────────────────────────────────────────────────

export const AdminApplicationQuerySchema = z.object({
  status: z.enum(['NEW', 'REVIEWING', 'INTERVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']).optional(),
  departmentId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
export type AdminApplicationQueryInput = z.infer<typeof AdminApplicationQuerySchema>

export const AdminApplicationSearchSchema = AdminApplicationQuerySchema.extend({
  search: z.string().trim().optional(),
})
export type AdminApplicationSearchInput = z.infer<typeof AdminApplicationSearchSchema>

export const UpdateApplicationReviewSchema = z.object({
  internalNote: z.string().max(5000, 'Ghi chú tối đa 5000 ký tự').nullable().optional(),
  updatedAt: z.string().datetime({ message: 'Thời điểm cập nhật không hợp lệ' }),
})
export type UpdateApplicationReviewInput = z.infer<typeof UpdateApplicationReviewSchema>

export const ChangeApplicationStatusSchema = z.object({
  status: z.enum(['NEW', 'REVIEWING', 'INTERVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']),
  reason: z.string().trim().max(1000, 'Lý do tối đa 1000 ký tự').optional().nullable(),
  updatedAt: z.string().datetime({ message: 'Thời điểm cập nhật không hợp lệ' }),
}).superRefine((data, ctx) => {
  if (data.status === 'WITHDRAWN' && (!data.reason || data.reason.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Lý do rút đơn không được để trống khi rút đơn ứng viên',
      path: ['reason'],
    })
  }
})
export type ChangeApplicationStatusInput = z.infer<typeof ChangeApplicationStatusSchema>

export const AdminApplicationExportSchema = z.object({
  status: z.enum(['NEW', 'REVIEWING', 'INTERVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']).optional(),
  departmentId: z.string().optional(),
  search: z.string().trim().optional(),
})
export type AdminApplicationExportInput = z.infer<typeof AdminApplicationExportSchema>
export const AdminApplicationExportQuerySchema = AdminApplicationExportSchema
export type AdminApplicationExportQueryInput = AdminApplicationExportInput

