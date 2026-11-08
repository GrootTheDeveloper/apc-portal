import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AsyncState } from '../../../../components/AsyncState'
import { Button } from '../../../../components/Button'
import { buttonClass } from '../../../../components/buttonClass'
import { PageHero } from '../../../../components/PageHero'
import { useApi } from '../../../../hooks/useApi'
import { api, ApiError } from '../../../../lib/api'
import { formatDate } from '../../../../lib/format'
import type { FeaturedContentData } from '../types'

export function AdminFeaturedContentPage() {
  const { data, loading, error, reload } = useApi<FeaturedContentData>('/admin/organization/featured-content')

  return (
    <div className="min-h-screen bg-soft pb-16">
      <PageHero
        comment="cấu hình tổ chức"
        title="Nội dung nổi bật trang chủ"
        lede="Chọn tin tức, sự kiện và dự án nổi bật hiển thị trên trang chủ (FLOW-24, ORG-04, QĐ-4). Khối chưa chọn sẽ tự động hiển thị mục mới nhất đang công khai."
      />

      <div className="mx-auto mt-8 max-w-container-max px-4 md:px-8">
        <AsyncState loading={loading} error={error} empty={!data} onRetry={reload}>
          {data && <FeaturedContentForm initial={data} reload={reload} />}
        </AsyncState>
      </div>
    </div>
  )
}

function FeaturedContentForm({
  initial,
  reload,
}: {
  initial: FeaturedContentData
  reload: () => void
}) {
  const navigate = useNavigate()

  const [selectedPosts, setSelectedPosts] = useState<string[]>(initial.selected.postIds ?? [])
  const [selectedEvents, setSelectedEvents] = useState<string[]>(initial.selected.eventIds ?? [])
  const [selectedProjects, setSelectedProjects] = useState<string[]>(initial.selected.projectIds ?? [])

  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function toggleItem(list: string[], setList: (updater: (prev: string[]) => string[]) => void, id: string, max = 3) {
    if (list.includes(id)) {
      setList((prev) => prev.filter((x) => x !== id))
      setStatusMessage(null)
    } else {
      if (list.length >= max) {
        setStatusMessage({ type: 'error', text: `Chỉ được chọn tối đa ${max} mục nổi bật cho mỗi khối.` })
        return
      }
      setList((prev) => [...prev, id])
      setStatusMessage(null)
    }
  }

  function handlePreview() {
    navigate('/', {
      state: {
        previewFeatured: {
          postIds: selectedPosts,
          eventIds: selectedEvents,
          projectIds: selectedProjects,
        },
      },
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setStatusMessage(null)

    try {
      await api('/admin/organization/featured-content', {
        method: 'PUT',
        body: {
          postIds: selectedPosts,
          eventIds: selectedEvents,
          projectIds: selectedProjects,
        },
      })
      setStatusMessage({ type: 'success', text: 'Đã lưu cấu hình nội dung nổi bật cho trang chủ.' })
      reload()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Không thể lưu nội dung nổi bật.'
      setStatusMessage({ type: 'error', text: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {statusMessage && (
        <div
          className={`mb-6 rounded-xl border-2 p-4 font-bold ${
            statusMessage.type === 'success'
              ? 'border-ink bg-apc-gold text-ink'
              : 'border-apc-red bg-apc-red/10 text-apc-red'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <div className="space-y-8">
        {/* 1. Tin tức nổi bật */}
        <div className="rounded-2xl border-2 border-ink bg-paper p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink pb-4">
            <div>
              <h3 className="font-display text-xl font-bold">1. Tin tức nổi bật trên trang chủ</h3>
              <p className="font-sans text-sm text-ink/75">
                Chọn tối đa 3 bài viết công khai để ghim. Nếu không chọn, trang chủ sẽ hiển thị 3 bài viết mới nhất.
              </p>
            </div>
            <span className="font-code text-sm font-bold">Đã chọn: {selectedPosts.length}/3</span>
          </div>

          <div className="mt-4 divide-y divide-ink/20">
            {initial.candidates.posts.length === 0 ? (
              <p className="py-4 text-center font-code text-sm text-ink/60">Không có bài viết công khai nào.</p>
            ) : (
              initial.candidates.posts.map((post) => {
                const isSelected = selectedPosts.includes(post.id)
                return (
                  <label
                    key={post.id}
                    className={`flex cursor-pointer items-center justify-between py-3 transition-colors ${
                      isSelected ? '-mx-3 rounded-lg bg-apc-gold/20 px-3' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        checked={isSelected}
                        className="h-5 w-5 accent-apc-blue"
                        type="checkbox"
                        onChange={() => toggleItem(selectedPosts, setSelectedPosts, post.id, 3)}
                      />
                      <div>
                        <span className="font-bold text-ink">{post.title}</span>
                        <div className="flex gap-2 font-code text-xs text-ink/60">
                          <span className="font-bold text-apc-blue">{post.category}</span>
                          {post.publishedAt && <span>{formatDate(post.publishedAt)}</span>}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="rounded-full bg-apc-blue/10 px-2.5 py-0.5 font-code text-xs font-bold text-apc-blue">
                        Nổi bật
                      </span>
                    )}
                  </label>
                )
              })
            )}
          </div>
        </div>

        {/* 2. Sự kiện nổi bật */}
        <div className="rounded-2xl border-2 border-ink bg-paper p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink pb-4">
            <div>
              <h3 className="font-display text-xl font-bold">2. Sự kiện nổi bật trên trang chủ</h3>
              <p className="font-sans text-sm text-ink/75">
                Chọn tối đa 3 sự kiện công khai để ghim. Nếu không chọn, trang chủ sẽ hiển thị 3 sự kiện sắp diễn ra gần
                nhất.
              </p>
            </div>
            <span className="font-code text-sm font-bold">Đã chọn: {selectedEvents.length}/3</span>
          </div>

          <div className="mt-4 divide-y divide-ink/20">
            {initial.candidates.events.length === 0 ? (
              <p className="py-4 text-center font-code text-sm text-ink/60">Không có sự kiện công khai nào.</p>
            ) : (
              initial.candidates.events.map((evt) => {
                const isSelected = selectedEvents.includes(evt.id)
                return (
                  <label
                    key={evt.id}
                    className={`flex cursor-pointer items-center justify-between py-3 transition-colors ${
                      isSelected ? '-mx-3 rounded-lg bg-apc-gold/20 px-3' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        checked={isSelected}
                        className="h-5 w-5 accent-apc-blue"
                        type="checkbox"
                        onChange={() => toggleItem(selectedEvents, setSelectedEvents, evt.id, 3)}
                      />
                      <div>
                        <span className="font-bold text-ink">{evt.title}</span>
                        <div className="flex gap-2 font-code text-xs text-ink/60">
                          <span className="font-bold text-apc-red">{evt.eventType}</span>
                          <span>{formatDate(evt.startAt)}</span>
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="rounded-full bg-apc-blue/10 px-2.5 py-0.5 font-code text-xs font-bold text-apc-blue">
                        Nổi bật
                      </span>
                    )}
                  </label>
                )
              })
            )}
          </div>
        </div>

        {/* 3. Dự án nổi bật */}
        <div className="rounded-2xl border-2 border-ink bg-paper p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink pb-4">
            <div>
              <h3 className="font-display text-xl font-bold">3. Dự án nổi bật trên trang chủ</h3>
              <p className="font-sans text-sm text-ink/75">
                Chọn tối đa 3 dự án công bố để ghim vào khung ảnh chính. Nếu không chọn, trang chủ sẽ hiển thị các dự án
                mới nhất.
              </p>
            </div>
            <span className="font-code text-sm font-bold">Đã chọn: {selectedProjects.length}/3</span>
          </div>

          <div className="mt-4 divide-y divide-ink/20">
            {initial.candidates.projects.length === 0 ? (
              <p className="py-4 text-center font-code text-sm text-ink/60">Không có dự án công bố nào.</p>
            ) : (
              initial.candidates.projects.map((proj) => {
                const isSelected = selectedProjects.includes(proj.id)
                return (
                  <label
                    key={proj.id}
                    className={`flex cursor-pointer items-center justify-between py-3 transition-colors ${
                      isSelected ? '-mx-3 rounded-lg bg-apc-gold/20 px-3' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        checked={isSelected}
                        className="h-5 w-5 accent-apc-blue"
                        type="checkbox"
                        onChange={() => toggleItem(selectedProjects, setSelectedProjects, proj.id, 3)}
                      />
                      <div>
                        <span className="font-bold text-ink">{proj.title}</span>
                        {proj.publishedAt && (
                          <p className="font-code text-xs text-ink/60">{formatDate(proj.publishedAt)}</p>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="rounded-full bg-apc-blue/10 px-2.5 py-0.5 font-code text-xs font-bold text-apc-blue">
                        Nổi bật
                      </span>
                    )}
                  </label>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-end gap-4 border-t-2 border-ink pt-6">
        <button
          className={buttonClass('outline')}
          type="button"
          onClick={handlePreview}
        >
          Xem trước trên trang chủ
        </button>
        <Button disabled={saving} type="submit" variant="primary">
          {saving ? 'Đang lưu...' : 'Lưu nội dung nổi bật'}
        </Button>
      </div>
    </form>
  )
}
