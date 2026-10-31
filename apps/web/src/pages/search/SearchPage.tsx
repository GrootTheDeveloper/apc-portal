import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AsyncState } from '../../components/AsyncState'
import { Button } from '../../components/Button'
import { EventCard } from '../../components/EventCard'
import { NewsCard } from '../../components/NewsCard'
import { PageHero } from '../../components/PageHero'
import { ProjectCard } from '../../components/ProjectCard'
import { Seo } from '../../components/Seo'
import { useApi } from '../../hooks/useApi'
import type { ProjectItem, NewsItem } from '../../lib/content'
import type { EventListItem } from '../events/types'

type SearchResponse = { news: NewsItem[]; events: EventListItem[]; projects: ProjectItem[] }

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const [input, setInput] = useState(query)
  useEffect(() => setInput(query), [query])
  const endpoint = `/public/search?${new URLSearchParams({ q: query })}`
  const { data, loading, error, reload } = useApi<SearchResponse>(endpoint)
  const news = data?.news ?? []
  const events = data?.events ?? []
  const projects = data?.projects ?? []
  const isEmpty = news.length + events.length + projects.length === 0

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearchParams(input.trim() ? { q: input.trim() } : {})
  }

  function clear() {
    setInput('')
    setSearchParams({})
  }

  return (
    <main>
      <Seo title="Tìm kiếm" path="/search" robots="noindex, follow" />
      <PageHero tone="blue" comment="tìm kiếm" title="Tìm nội dung APC" lede="Tìm tin tức, sự kiện và dự án theo tiêu đề." />
      <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
        <div className="mx-auto w-full max-w-container-max">
          <form onSubmit={submit} className="mb-10 flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="site-search">Từ khóa</label>
            <input id="site-search" maxLength={100} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Nhập từ khóa..." className="min-h-12 flex-1 rounded-full bg-soft px-6 text-ink outline-none focus:ring-2 focus:ring-apc-blue" />
            <Button type="submit">Tìm kiếm</Button>
          </form>
          <AsyncState loading={loading} error={error} empty={isEmpty} emptyText="Không tìm thấy nội dung phù hợp." onRetry={reload}>
            {news.length > 0 && (
              <section aria-labelledby="search-news-heading" className="mb-16">
                <h2 id="search-news-heading" className="mb-8 font-display text-2xl font-extrabold">Tin tức</h2>
                <div className="grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
                  {news.map((item) => <NewsCard key={item.id} item={item} />)}
                </div>
              </section>
            )}
            {events.length > 0 && (
              <section aria-labelledby="search-events-heading" className="mb-16">
                <h2 id="search-events-heading" className="mb-8 font-display text-2xl font-extrabold">Sự kiện</h2>
                <div className="grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
                  {events.map((item) => <EventCard key={item.slug} {...item} />)}
                </div>
              </section>
            )}
            {projects.length > 0 && (
              <section aria-labelledby="search-projects-heading">
                <h2 id="search-projects-heading" className="mb-8 font-display text-2xl font-extrabold">Dự án</h2>
                <div className="grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
                  {projects.map((item) => <ProjectCard key={item.id} item={item} />)}
                </div>
              </section>
            )}
          </AsyncState>
          {!loading && !error && isEmpty && query && (
            <div className="-mt-8 pb-16 text-center"><Button variant="outline" onClick={clear}>Xóa từ khóa</Button></div>
          )}
        </div>
      </section>
    </main>
  )
}
