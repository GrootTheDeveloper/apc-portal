import { describe, expect, it } from 'vitest'

import { affectsRegisteredUsers, capacityValue, validateEventForm, type EventFormValues } from './eventForm'

const valid: EventFormValues = {
  title: 'Workshop Git nâng cao',
  description: 'Kiến thức Git cho thành viên mới.',
  audience: 'PUBLIC',
  startAt: '2026-11-14T14:00',
  endAt: '2026-11-14T17:00',
  registrationOpensAt: '2026-11-01T08:00',
  registrationClosesAt: '2026-11-13T23:59',
  capacity: '50',
  departmentId: 'dept-1',
}

describe('validateEventForm', () => {
  it('form hợp lệ không có lỗi', () => {
    expect(validateEventForm(valid)).toEqual({})
  })

  it('thiếu trường bắt buộc thì báo từng ô', () => {
    const errors = validateEventForm({ ...valid, title: '  ', description: '', startAt: '', endAt: '' })
    expect(Object.keys(errors).sort()).toEqual(['description', 'endAt', 'startAt', 'title'])
  })

  it('endAt phải sau startAt', () => {
    expect(validateEventForm({ ...valid, endAt: '2026-11-14T14:00' }).endAt).toBeTruthy()
    expect(validateEventForm({ ...valid, endAt: '2026-11-14T13:59' }).endAt).toBeTruthy()
    expect(validateEventForm({ ...valid, endAt: '2026-11-14T14:01' }).endAt).toBeUndefined()
  })

  it('đóng đăng ký phải sau mở đăng ký', () => {
    expect(validateEventForm({ ...valid, registrationClosesAt: '2026-11-01T08:00' }).registrationClosesAt).toBeTruthy()
    expect(validateEventForm({ ...valid, registrationClosesAt: '2026-11-01T07:59' }).registrationClosesAt).toBeTruthy()
    expect(validateEventForm({ ...valid, registrationClosesAt: '2026-11-01T08:01' }).registrationClosesAt).toBeUndefined()
  })

  it('đóng đăng ký không được sau thời gian kết thúc sự kiện', () => {
    expect(validateEventForm({ ...valid, registrationClosesAt: '2026-11-14T18:00' }).registrationClosesAt).toBeTruthy()
    expect(validateEventForm({ ...valid, registrationClosesAt: '2026-11-14T17:00' }).registrationClosesAt).toBeUndefined()
  })

  it('cửa sổ đăng ký để trống là không kiểm chéo', () => {
    expect(validateEventForm({ ...valid, registrationOpensAt: '', registrationClosesAt: '' })).toEqual({})
    expect(validateEventForm({ ...valid, registrationOpensAt: '', registrationClosesAt: '2026-11-14T18:00' }).registrationClosesAt).toBeTruthy()
  })

  it('sức chứa rỗng là không giới hạn, nhập thì phải nguyên dương', () => {
    expect(validateEventForm({ ...valid, capacity: '' }).capacity).toBeUndefined()
    expect(validateEventForm({ ...valid, capacity: '0' }).capacity).toBeTruthy()
    expect(validateEventForm({ ...valid, capacity: '2.5' }).capacity).toBeTruthy()
    expect(validateEventForm({ ...valid, capacity: 'abc' }).capacity).toBeTruthy()
    expect(validateEventForm({ ...valid, capacity: '1' }).capacity).toBeUndefined()
  })

  it('quản lý ban bắt buộc chọn ban, BOARD thì không', () => {
    const options = { requireDepartment: true, requireDepartmentMessage: 'Hãy chọn ban.' }
    expect(validateEventForm({ ...valid, departmentId: '' }, options).departmentId).toBe('Hãy chọn ban.')
    expect(validateEventForm({ ...valid, departmentId: '' })).toEqual({})
  })

  it('sức chứa không được nhỏ hơn số người đã đăng ký khi đang sửa sự kiện', () => {
    const options = { registeredCount: 30 }
    expect(validateEventForm({ ...valid, capacity: '29' }, options).capacity).toBe(
      'Sức chứa không thể nhỏ hơn số người đã đăng ký (hiện có 30).',
    )
    expect(validateEventForm({ ...valid, capacity: '30' }, options).capacity).toBeUndefined()
    // Không giới hạn (bỏ trống) vẫn hợp lệ; không truyền registeredCount thì không kiểm.
    expect(validateEventForm({ ...valid, capacity: '' }, options).capacity).toBeUndefined()
    expect(validateEventForm({ ...valid, capacity: '5' }).capacity).toBeUndefined()
  })
})

describe('affectsRegisteredUsers', () => {
  const event = {
    startAt: '2026-11-14T07:00:00.000Z',
    endAt: '2026-11-14T10:00:00.000Z',
    capacity: 50,
    audience: 'PUBLIC',
  } as const

  it('không đổi gì thì không ảnh hưởng', () => {
    expect(affectsRegisteredUsers(event, valid)).toBe(false)
  })

  it('đổi thời gian, sức chứa hay đối tượng đều tính là ảnh hưởng', () => {
    expect(affectsRegisteredUsers(event, { ...valid, startAt: '2026-11-14T15:00' })).toBe(true)
    expect(affectsRegisteredUsers(event, { ...valid, endAt: '2026-11-14T18:00' })).toBe(true)
    expect(affectsRegisteredUsers(event, { ...valid, capacity: '40' })).toBe(true)
    expect(affectsRegisteredUsers(event, { ...valid, audience: 'CLUB' })).toBe(true)
    // Đổi sang "không giới hạn" (bỏ trống) cũng là thay đổi sức chứa.
    expect(affectsRegisteredUsers(event, { ...valid, capacity: '' })).toBe(true)
  })
})

describe('capacityValue', () => {
  it('ô trống là không giới hạn, có giá trị thì quy về số', () => {
    expect(capacityValue('')).toBeNull()
    expect(capacityValue('  ')).toBeNull()
    expect(capacityValue('50')).toBe(50)
  })
})
