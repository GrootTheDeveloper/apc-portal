import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

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

function SearchForm({ query, onSearch }: { query: string; onSearch: (value: string) => void }) {
  const [input, setInput] = useState(query)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSearch(input.trim())
  }

  return (
    <form onSubmit={submit} className="mb-10 flex flex-col gap-3 sm:flex-row">
      <label className="sr-only" htmlFor="site-search">Từ khóa</label>
      <input id="site-search" maxLength={100} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Nhập từ khóa..." className="w-full rounded-xl bg-paper px-4 py-3 text-[17px] text-ink shadow-[inset_0_0_0_2px_#081F3D] outline-none transition-shadow focus:shadow-[inset_0_0_0_2px_#1568C9,0_0_0_4px_rgba(21,104,201,0.2)] sm:flex-1" />
      <Button type="submit">Tìm kiếm</Button>
    </form>
  )
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const query = searchParams.get('q') ?? ''
  const from = `${location.pathname}${location.search}`
  const endpoint = `/public/search?${new URLSearchParams({ q: query })}`
  const { data, loading, error, reload } = useApi<SearchResponse>(endpoint)
  const news = data?.news ?? []
  const events = data?.events ?? []
  const projects = data?.projects ?? []
  const isEmpty = news.length + events.length + projects.length === 0

  function clear() {
    setSearchParams({})
  }

  return (
    <main>
      <Seo title="Tìm kiếm" path="/search" robots="noindex, follow" />
      <PageHero tone="blue" comment="tìm kiếm" title="Tìm nội dung APC" lede="Tìm tin tức, sự kiện và dự án theo tiêu đề." />
      <section className="px-4 py-[clamp(40px,7vh,80px)] md:px-8">
        <div className="mx-auto w-full max-w-container-max">
          <SearchForm key={query} query={query} onSearch={(value) => setSearchParams(value ? { q: value } : {})} />
          <AsyncState
            loading={loading}
            error={error}
            empty={isEmpty}
            emptyText="Không tìm thấy nội dung phù hợp."
            emptyAction={query ? <Button variant="outline" onClick={clear}>Xóa từ khóa</Button> : undefined}
            onRetry={reload}
          >
            {news.length > 0 && (
              <section aria-labelledby="search-news-heading" className="mb-16">
                <h2 id="search-news-heading" className="mb-8 font-display text-2xl font-extrabold">Tin tức</h2>
                <div className="grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
                  {news.map((item) => <NewsCard key={item.id} item={item} linkState={{ from }} />)}
                </div>
              </section>
            )}
            {events.length > 0 && (
              <section aria-labelledby="search-events-heading" className="mb-16">
                <h2 id="search-events-heading" className="mb-8 font-display text-2xl font-extrabold">Sự kiện</h2>
                <div className="grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
                  {events.map((item) => <EventCard key={item.slug} {...item} linkState={{ from }} />)}
                </div>
              </section>
            )}
            {projects.length > 0 && (
              <section aria-labelledby="search-projects-heading">
                <h2 id="search-projects-heading" className="mb-8 font-display text-2xl font-extrabold">Dự án</h2>
                <div className="grid gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
                  {projects.map((item) => <ProjectCard key={item.id} item={item} linkState={{ from }} />)}
                </div>
              </section>
            )}
          </AsyncState>
        </div>
      </section>
    </main>
  )
}
