import { expect, it } from 'vitest'

import { ApiError } from './api'
import { fieldErrors } from './formErrors'

it('groups 422 issues by field and ignores other errors', () => {
  const error = new ApiError(422, 'validation', 'Dữ liệu không hợp lệ.', [
    { path: ['newPassword'], message: 'Mật khẩu phải có ít nhất 15 ký tự.' },
    { path: ['newPassword'], message: 'Mật khẩu quá phổ biến.' },
    { path: ['confirmPassword'], message: 'Mật khẩu nhập lại không khớp.' },
  ])
  expect(fieldErrors(error)).toEqual({
    newPassword: ['Mật khẩu phải có ít nhất 15 ký tự.', 'Mật khẩu quá phổ biến.'],
    confirmPassword: ['Mật khẩu nhập lại không khớp.'],
  })
  expect(fieldErrors(new ApiError(403, 'forbidden', 'x'))).toEqual({})
  expect(fieldErrors(new Error('x'))).toEqual({})
})
