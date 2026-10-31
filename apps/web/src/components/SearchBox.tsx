import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from './Button'

/** Ô tìm kiếm chung cho các trang nội dung công khai, chuyển từ khóa sang /search?q=. */
export function SearchBox() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = query.trim()
    navigate(value ? `/search?q=${encodeURIComponent(value)}` : '/search')
  }

  return (
    <form onSubmit={submit} role="search" className="my-8 flex flex-col gap-3 sm:flex-row">
      <label className="sr-only" htmlFor="content-search">Tìm nội dung</label>
      <input
        id="content-search"
        maxLength={100}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Tìm theo tiêu đề..."
        className="w-full rounded-xl bg-paper px-4 py-3 text-[17px] text-ink shadow-[inset_0_0_0_2px_#081F3D] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_#1568C9,0_0_0_4px_rgba(21,104,201,0.2)] sm:flex-1"
      />
      <Button type="submit">Tìm kiếm</Button>
    </form>
  )
}
