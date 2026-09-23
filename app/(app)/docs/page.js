'use client'

import { useEffect, useMemo, useState } from 'react'
import { Empty } from '@/components/ui'
import { DOC_CATEGORIES, DOC_TOPICS } from '@/lib/devDocs'

const ALL = 'all'

const matches = (topic, term) =>
  !term ||
  [topic.title, topic.summary, topic.what, topic.why, ...(topic.where || []), ...(topic.pitfalls || [])]
    .join(' ')
    .toLowerCase()
    .includes(term)

export default function DeveloperDocsPage() {
  const [category, setCategory] = useState(ALL)
  const [search, setSearch] = useState('')

  const term = search.trim().toLowerCase()
  const visible = useMemo(
    () => DOC_TOPICS.filter((t) => (category === ALL || t.category === category) && matches(t, term)),
    [category, term]
  )
  const countIn = (id) => DOC_TOPICS.filter((t) => t.category === id).length

  // A shared link like /docs#idempotency lands on its topic even when a
  // filter would hide it: clear the filters, then scroll once it renders.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id || !DOC_TOPICS.some((t) => t.id === id)) return
    setCategory(ALL)
    setSearch('')
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }))
  }, [])

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Developer Docs</h1>
          <div className="page-sub">
            How Market Neurons is built and why: {DOC_TOPICS.length} topics across the backend, frontend,
            database, security and delivery
          </div>
        </div>
      </header>

      <div className="page">
        <div className="between wrap">
          <div className="segmented docs-tabs" role="tablist" aria-label="Doc categories">
            <button className={category === ALL ? 'on' : ''} role="tab" aria-selected={category === ALL}
              onClick={() => setCategory(ALL)}>
              All ({DOC_TOPICS.length})
            </button>
            {DOC_CATEGORIES.map((c) => (
              <button key={c.id} className={category === c.id ? 'on' : ''} role="tab"
                aria-selected={category === c.id} onClick={() => setCategory(c.id)}>
                {c.label} ({countIn(c.id)})
              </button>
            ))}
          </div>
          <input className="input" style={{ width: 240 }} placeholder="Search docs… (e.g. debounce)"
            aria-label="Search docs" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {!visible.length ? (
          <div className="card">
            <Empty title="Nothing matches" hint="Try another word, or clear the category filter." />
          </div>
        ) : (
          <div className="docs-layout">
            <nav className="card docs-index" aria-label="Topics">
              {DOC_CATEGORIES.filter((c) => visible.some((t) => t.category === c.id)).map((c) => (
                <div key={c.id} className="docs-index-group">
                  <div className="stat-label">{c.label}</div>
                  {visible.filter((t) => t.category === c.id).map((t) => (
                    <a key={t.id} href={`#${t.id}`} className="docs-index-link">{t.title}</a>
                  ))}
                </div>
              ))}
            </nav>

            <div className="docs-topics">
              {visible.map((t) => <DocTopic key={t.id} topic={t} />)}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function DocTopic({ topic }) {
  const category = DOC_CATEGORIES.find((c) => c.id === topic.category)
  return (
    <article id={topic.id} className="card docs-topic">
      <div className="row wrap" style={{ gap: 8 }}>
        <span className="badge docs-badge">{category?.label}</span>
        <a href={`#${topic.id}`} className="faint small docs-anchor" aria-label={`Link to ${topic.title}`}>#</a>
      </div>
      <h2 className="docs-title">{topic.title}</h2>
      <p className="docs-summary">{topic.summary}</p>

      <section className="docs-block">
        <h3 className="docs-h">What it is</h3>
        <p>{topic.what}</p>
      </section>

      <section className="docs-block">
        <h3 className="docs-h">Why we need it</h3>
        <p>{topic.why}</p>
      </section>

      {topic.code ? (
        <section className="docs-block">
          <h3 className="docs-h">Example</h3>
          <pre className="docs-code"><code>{topic.code}</code></pre>
        </section>
      ) : null}

      {topic.where?.length ? (
        <section className="docs-block">
          <h3 className="docs-h">Where it lives in our code</h3>
          <ul className="docs-list docs-where">
            {topic.where.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </section>
      ) : null}

      {topic.pitfalls?.length ? (
        <section className="docs-block">
          <h3 className="docs-h">Watch out for</h3>
          <ul className="docs-list">
            {topic.pitfalls.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </section>
      ) : null}
    </article>
  )
}
