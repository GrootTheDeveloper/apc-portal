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
        className="min-h-12 flex-1 rounded-full bg-soft px-6 text-ink outline-none focus:ring-2 focus:ring-apc-blue"
      />
      <Button type="submit">Tìm kiếm</Button>
    </form>
  )
}
