import { z } from 'zod'

export const QuestionTypeSchema = z.enum([
  'short_text',
  'long_text',
  'single_choice',
  'multiple_choice',
])

export const QuestionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, 'Nhãn lựa chọn không được để trống'),
})

export const QuestionSchema = z.object({
  id: z.string().min(1),
  type: QuestionTypeSchema,
  label: z.string().min(1, 'Nội dung câu hỏi không được để trống'),
  required: z.boolean().default(false),
  options: z.array(QuestionOptionSchema).optional().default([]),
  hidden: z.boolean().optional().default(false),
})

export type Question = z.infer<typeof QuestionSchema>
export type QuestionOption = z.infer<typeof QuestionOptionSchema>

export const CreateRecruitmentRoundSchema = z.object({
  title: z.string().min(3, 'Tiêu đề đợt tuyển tối thiểu 3 ký tự'),
  slug: z.string().min(3, 'Slug tối thiểu 3 ký tự').regex(/^[a-z0-9-]+$/, 'Slug chỉ gồm chữ thường, số và dấu gạch ngang'),
  description: z.string().min(10, 'Mô tả tối thiểu 10 ký tự'),
  audience: z.string().min(5, 'Đối tượng tuyển tối thiểu 5 ký tự'),
  requirements: z.string().min(5, 'Điều kiện ứng tuyển tối thiểu 5 ký tự'),
  opensAt: z.string().datetime({ message: 'Thời gian mở không hợp lệ' }),
  closesAt: z.string().datetime({ message: 'Thời gian đóng không hợp lệ' }),
  departmentIds: z.array(z.string()).min(1, 'Phải chọn ít nhất 1 ban chuyên môn'),
  questions: z.array(QuestionSchema).optional().default([]),
}).refine((data) => new Date(data.closesAt) > new Date(data.opensAt), {
  message: 'Thời gian kết thúc phải sau thời gian bắt đầu',
  path: ['closesAt'],
})

export const UpdateRecruitmentRoundSchema = z.object({
  title: z.string().min(3).optional(),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().min(10).optional(),
  audience: z.string().min(5).optional(),
  requirements: z.string().min(5).optional(),
  opensAt: z.string().datetime().optional(),
  closesAt: z.string().datetime().optional(),
  departmentIds: z.array(z.string()).optional(),
  questions: z.array(QuestionSchema).optional(),
}).refine(
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
  applicantName: z.string().trim().min(2,'Họ tên tối thiểu 2 ký tự').max(100),
  applicantEmail: z.string().trim().email('Email không hợp lệ'),
  studentId: z.string().trim().min(3,'Mã số sinh viên không hợp lệ').max(20),
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