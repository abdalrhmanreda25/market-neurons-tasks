'use client'

import { useState } from 'react'
import { useWorkspace } from '@/components/WorkspaceProvider'
import { Empty, Spinner } from '@/components/ui'
import { SERVER_PORTS, SERVER_REPORTS } from '@/lib/serverLog'

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }
  return (
    <button type="button" className="btn btn-sm infra-copy" onClick={copy}>
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  )
}

function Report({ report }) {
  return (
    <article id={report.id} className="card server-report" dir="rtl" lang="ar">
      <div className="row wrap" style={{ gap: 8 }}>
        <span className="badge docs-badge" dir="ltr">{report.date}</span>
        {report.author && <span className="faint small" dir="ltr">@{report.author}</span>}
      </div>
      <h2 className="docs-title">{report.title}</h2>

      {report.explainer && (
        <section className="server-explainer">
          <h3 className="infra-step-title">{report.explainer.title}</h3>
          <p className="muted small">{report.explainer.intro}</p>
          <dl className="server-points">
            {report.explainer.points.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="docs-block">
        <h3 className="docs-h">ملخص اللي عملناه</h3>
        <ol className="infra-steps server-steps">
          {report.done.map((step) => (
            <li key={step.title}>
              <div className="infra-step-title">{step.title}</div>
              <ul className="docs-list">
                {step.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </article>
  )
}

export default function ServerManagementPage() {
  const { canManage, loading } = useWorkspace()

  if (loading) return <Spinner full />

  if (!canManage) {
    return (
      <div className="page">
        <Empty title="Owners and admins only" hint="Ask the workspace owner if you need access to server details." />
      </div>
    )
  }

  const latest = SERVER_REPORTS[0]

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Server management</h1>
          <div className="page-sub">What was done on the VPS, what is exposed now, and what comes next</div>
        </div>
      </header>

      <div className="page">
        <div className="infra-grid server-grid" dir="rtl" lang="ar">
          <section className="card">
            <div className="card-head"><span className="card-title">وضع السيرفر دلوقتي</span></div>
            <div className="server-table-wrap">
            <table className="table server-ports">
              <thead>
                <tr>
                  <th>البورت</th>
                  <th>الخدمة</th>
                  <th>متاح لمين</th>
                </tr>
              </thead>
              <tbody>
                {SERVER_PORTS.map((row) => (
                  <tr key={row.service}>
                    <td><code dir="ltr">{row.port}</code></td>
                    <td>{row.service}</td>
                    <td><span className={`infra-tag tone-${row.tone}`}>{row.reach}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>

          {latest?.next?.length ? (
            <section className="card">
              <div className="card-head"><span className="card-title">الخطوة الجاية</span></div>
              <ol className="infra-steps server-steps">
                {latest.next.map((step) => (
                  <li key={step.cmd}>
                    <div className="infra-step-title">{step.text}</div>
                    <div className="infra-cmd" dir="ltr">
                      <pre>{step.cmd}</pre>
                      <CopyButton text={step.cmd} />
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        {SERVER_REPORTS.map((r) => <Report key={r.id} report={r} />)}
      </div>
    </>
  )
}
