'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useWorkspace } from '@/components/WorkspaceProvider'
import { Empty, Modal, Spinner } from '@/components/ui'
import { ENVIRONMENTS, ENVS, TROUBLESHOOTING, VAULT_REFS, fillPlaceholders, stepsFor } from '@/lib/infraGuide'
import {
  addVaultEntry,
  createVaultMeta,
  deleteVaultEntry,
  subscribeVaultEntries,
  subscribeVaultMeta,
  updateVaultEntry,
} from '@/lib/vault'
import {
  PBKDF2_ITERATIONS,
  decryptJson,
  deriveKey,
  encryptJson,
  makeCheck,
  newSalt,
  passphraseProblem,
  verifyCheck,
} from '@/lib/vaultCrypto'

// The derived key lives only in memory; it is dropped after this much quiet time.
const IDLE_LOCK_MS = 10 * 60 * 1000
// A copied secret is wiped from the clipboard after this long.
const CLIPBOARD_CLEAR_MS = 30 * 1000

const TABS = [
  { id: 'production', label: 'Production' },
  { id: 'staging', label: 'Dev / Staging' },
  { id: 'local', label: 'Local' },
  { id: 'vault', label: 'Vault' },
  { id: 'help', label: 'Troubleshooting' },
]

function useCopy() {
  const [copied, setCopied] = useState(null)
  const timer = useRef(null)
  const copy = useCallback(async (text, id, secret = false) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600)
      if (secret) {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), CLIPBOARD_CLEAR_MS)
      }
    } catch {
      setCopied(null)
    }
  }, [])
  return { copied, copy }
}

function CopyButton({ text, id, secret, copy, copied, label = 'Copy' }) {
  return (
    <button type="button" className="btn btn-sm infra-copy" onClick={() => copy(text, id, secret)}>
      {copied === id ? 'Copied ✓' : label}
    </button>
  )
}

function SecretValue({ value, id, copy, copied }) {
  const [shown, setShown] = useState(false)
  if (value == null) return <span className="faint small">Not in vault</span>
  return (
    <span className="infra-secret">
      <code className="infra-secret-value">{shown ? value : '•'.repeat(Math.min(Math.max(value.length, 8), 18))}</code>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShown((s) => !s)} aria-pressed={shown}>
        {shown ? 'Hide' : 'Show'}
      </button>
      <CopyButton text={value} id={id} secret copy={copy} copied={copied} />
    </span>
  )
}

/* ---------------------------------------------------------------- gate */

function SetupVault({ onCreate }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const problem = p1 ? passphraseProblem(p1) : null

  const submit = async (e) => {
    e.preventDefault()
    if (problem) return setError(problem)
    if (p1 !== p2) return setError('The two passphrases do not match.')
    setBusy(true)
    setError(null)
    try {
      await onCreate(p1)
    } catch (err) {
      setError(err.message || 'Could not create the vault.')
      setBusy(false)
    }
  }

  return (
    <form className="card infra-gate" onSubmit={submit}>
      <div className="infra-gate-icon" aria-hidden="true">🔐</div>
      <h2 className="card-title">Create the team vault</h2>
      <p className="muted small">
        Choose a master passphrase. Passwords you store are encrypted in this browser with it; Firestore only ever
        holds scrambled text. Share the passphrase with the other admins in person or through a password manager —
        never in chat.
      </p>
      <div className="field">
        <label className="label" htmlFor="vp1">Master passphrase</label>
        <input id="vp1" className="input" type="password" autoComplete="new-password" value={p1}
          onChange={(e) => setP1(e.target.value)} placeholder="e.g. four random words you can remember" />
        {problem && <span className="small" style={{ color: 'var(--amber)' }}>{problem}</span>}
      </div>
      <div className="field">
        <label className="label" htmlFor="vp2">Repeat it</label>
        <input id="vp2" className="input" type="password" autoComplete="new-password" value={p2}
          onChange={(e) => setP2(e.target.value)} />
      </div>
      <label className="infra-ack">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span className="small">I understand a forgotten passphrase cannot be recovered — the vault would have to be deleted and refilled.</span>
      </label>
      {error && <div className="alert alert-error">{error}</div>}
      <button className="btn btn-primary btn-block" disabled={busy || !ack || !p1 || !p2}>
        {busy ? 'Creating…' : 'Create vault'}
      </button>
    </form>
  )
}

function UnlockVault({ onUnlock }) {
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const ok = await onUnlock(pass)
    if (!ok) {
      setError('Wrong passphrase.')
      setBusy(false)
    }
  }

  return (
    <form className="card infra-gate" onSubmit={submit}>
      <div className="infra-gate-icon" aria-hidden="true">🔒</div>
      <h2 className="card-title">Vault locked</h2>
      <p className="muted small">Enter the team’s master passphrase to show passwords and fill the commands below.</p>
      <div className="field">
        <label className="label" htmlFor="vpass">Master passphrase</label>
        <input id="vpass" className="input" type="password" autoComplete="current-password" autoFocus
          value={pass} onChange={(e) => setPass(e.target.value)} />
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <button className="btn btn-primary btn-block" disabled={busy || !pass}>{busy ? 'Unlocking…' : 'Unlock'}</button>
    </form>
  )
}

/* ------------------------------------------------------------- env view */

function EnvironmentPanel({ env, values, unlocked, copy, copied }) {
  const steps = stepsFor(env)
  return (
    <div className="infra-env">
      <div className={`infra-warning tone-${env.id}`}>
        <strong>{env.name}</strong>
        <span>{env.warning}</span>
        {env.url && (
          <a href={env.url} target="_blank" rel="noopener noreferrer" className="infra-url">{env.url.replace(/^https?:\/\//, '')} ↗</a>
        )}
      </div>

      <div className="infra-grid">
        <section className="card">
          <div className="card-head"><span className="card-title">Connection facts</span></div>
          <dl className="infra-facts">
            {env.facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd><code>{v}</code></dd>
              </div>
            ))}
            {env.id !== 'local' && (
              <div>
                <dt>VPS host</dt>
                <dd>{unlocked ? <code>{values.VPS_HOST || 'add “VPS host” to the vault'}</code> : <span className="faint small">locked</span>}</dd>
              </div>
            )}
            <div>
              <dt>DB password</dt>
              <dd>
                {unlocked ? (
                  <SecretValue value={values[env.passwordRef]} id={`pw-${env.id}`} copy={copy} copied={copied} />
                ) : (
                  <span className="faint small">locked</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <div className="card-head"><span className="card-title">Open it in psql / pgAdmin</span></div>
          <ol className="infra-steps">
            {steps.map((step, i) => {
              const cmd = step.cmd ? fillPlaceholders(step.cmd, unlocked ? values : {}) : null
              return (
                <li key={step.title}>
                  <div className="infra-step-title">{step.title}</div>
                  {step.text && <p className="muted small">{step.text}</p>}
                  {cmd && (
                    <div className="infra-cmd">
                      <pre>{cmd}</pre>
                      <CopyButton text={cmd} id={`${env.id}-${i}`} copy={copy} copied={copied} />
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ vault view */

const blankDraft = { label: '', env: 'production', ref: '', value: '', notes: '' }

function EntryForm({ initial, onSave, onClose, takenRefs }) {
  const [draft, setDraft] = useState(initial || blankDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!draft.label.trim() || !draft.value) return setError('Label and value are required.')
    setBusy(true)
    try {
      await onSave({ ...draft, label: draft.label.trim() })
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save.')
      setBusy(false)
    }
  }

  return (
    <Modal title={initial ? 'Edit entry' : 'Add to vault'} subtitle="Encrypted in this browser before it is saved" onClose={onClose}>
      <form onSubmit={submit} className="infra-form">
        <div className="field">
          <label className="label" htmlFor="vl">Label</label>
          <input id="vl" className="input" value={draft.label} onChange={set('label')} placeholder="e.g. Staging DB password" />
        </div>
        <div className="infra-form-row">
          <div className="field">
            <label className="label" htmlFor="ve">Environment</label>
            <select id="ve" className="select" value={draft.env} onChange={set('env')}>
              {ENVS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="vr">Used for</label>
            <select id="vr" className="select" value={draft.ref} onChange={set('ref')}>
              <option value="">Nothing (just stored)</option>
              {VAULT_REFS.map((r) => (
                <option key={r.id} value={r.id} disabled={takenRefs.has(r.id) && initial?.ref !== r.id}>
                  {r.label}{takenRefs.has(r.id) && initial?.ref !== r.id ? ' (already set)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="vv">Value</label>
          <input id="vv" className="input infra-mono" type="password" autoComplete="off" value={draft.value} onChange={set('value')} />
        </div>
        <div className="field">
          <label className="label" htmlFor="vn">Notes (encrypted too)</label>
          <textarea id="vn" className="textarea" rows={3} value={draft.notes} onChange={set('notes')}
            placeholder="Where it is used, when it was rotated…" />
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}

function VaultPanel({ entries, plain, onAdd, onEdit, onDelete, copy, copied }) {
  const [filter, setFilter] = useState('all')
  const visible = entries.filter((e) => filter === 'all' || e.env === filter)
  const envLabel = (id) => ENVS.find((e) => e.id === id)?.label || id
  const refLabel = (id) => VAULT_REFS.find((r) => r.id === id)?.label

  return (
    <section className="card">
      <div className="between wrap" style={{ marginBottom: 14 }}>
        <div className="segmented" role="tablist" aria-label="Filter by environment">
          {[{ id: 'all', label: 'All' }, ...ENVS].map((e) => (
            <button key={e.id} className={filter === e.id ? 'on' : ''} role="tab" aria-selected={filter === e.id}
              onClick={() => setFilter(e.id)}>
              {e.label}
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={onAdd}>+ Add entry</button>
      </div>

      {visible.length === 0 ? (
        <Empty title="Nothing here yet" hint="Add the VPS host, SSH user and each database password to fill this page." />
      ) : (
        <ul className="infra-vault-list">
          {visible.map((entry) => {
            const data = plain[entry.id]
            return (
              <li key={entry.id} className="infra-vault-item">
                <div className="infra-vault-head">
                  <div>
                    <div className="infra-vault-label">{entry.label}</div>
                    <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                      <span className={`infra-tag tone-${entry.env}`}>{envLabel(entry.env)}</span>
                      {entry.ref && <span className="infra-tag">{refLabel(entry.ref)}</span>}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => onEdit(entry)} disabled={!data}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => onDelete(entry)}>Delete</button>
                  </div>
                </div>
                {data ? (
                  <>
                    <SecretValue value={data.value} id={`v-${entry.id}`} copy={copy} copied={copied} />
                    {data.notes && <p className="small muted infra-notes">{data.notes}</p>}
                  </>
                ) : (
                  <span className="small" style={{ color: 'var(--red)' }}>Could not decrypt — saved with a different passphrase?</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ----------------------------------------------------------------- page */

export default function InfrastructurePage() {
  const { user } = useAuth()
  const { teamId, canManage, loading } = useWorkspace()
  const [meta, setMeta] = useState(undefined)
  const [entries, setEntries] = useState([])
  const [key, setKey] = useState(null)
  const [plain, setPlain] = useState({})
  const [tab, setTab] = useState('staging')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)
  const { copied, copy } = useCopy()

  useEffect(() => {
    if (!teamId || !canManage) return undefined
    const offMeta = subscribeVaultMeta(teamId, setMeta, (err) => setError(err.message))
    const offEntries = subscribeVaultEntries(teamId, setEntries, (err) => setError(err.message))
    return () => {
      offMeta()
      offEntries()
    }
  }, [teamId, canManage])

  // Decrypt whenever the key or the entries change; nothing decrypted is stored.
  useEffect(() => {
    if (!key) {
      setPlain({})
      return
    }
    let cancelled = false
    Promise.all(
      entries.map(async (e) => {
        try {
          return [e.id, await decryptJson(key, e)]
        } catch {
          return [e.id, null]
        }
      })
    ).then((pairs) => !cancelled && setPlain(Object.fromEntries(pairs)))
    return () => {
      cancelled = true
    }
  }, [key, entries])

  // Idle auto-lock: any interaction pushes the deadline back.
  useEffect(() => {
    if (!key) return undefined
    let timer = setTimeout(() => setKey(null), IDLE_LOCK_MS)
    const bump = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setKey(null), IDLE_LOCK_MS)
    }
    const events = ['pointerdown', 'keydown', 'scroll']
    events.forEach((ev) => window.addEventListener(ev, bump, { passive: true }))
    return () => {
      clearTimeout(timer)
      events.forEach((ev) => window.removeEventListener(ev, bump))
    }
  }, [key])

  const values = useMemo(() => {
    const out = {}
    for (const e of entries) {
      if (e.ref && plain[e.id]) out[e.ref] = plain[e.id].value
    }
    return out
  }, [entries, plain])

  const takenRefs = useMemo(() => new Set(entries.map((e) => e.ref).filter(Boolean)), [entries])

  const createVault = async (passphrase) => {
    const salt = newSalt()
    const k = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS)
    await createVaultMeta(teamId, { salt, iterations: PBKDF2_ITERATIONS, check: await makeCheck(k) }, user.uid)
    setKey(k)
    setTab('vault')
  }

  const unlock = async (passphrase) => {
    const k = await deriveKey(passphrase, meta.salt, meta.iterations)
    if (!(await verifyCheck(k, meta.check))) return false
    setKey(k)
    return true
  }

  const saveEntry = async (draft) => {
    const sealed = await encryptJson(key, { value: draft.value, notes: draft.notes || '' })
    const payload = { label: draft.label, env: draft.env, ref: draft.ref, sealed }
    if (draft.id) await updateVaultEntry(teamId, draft.id, payload, user.uid)
    else await addVaultEntry(teamId, payload, user.uid)
  }

  const removeEntry = async (entry) => {
    if (!window.confirm(`Delete “${entry.label}” from the vault? This cannot be undone.`)) return
    await deleteVaultEntry(teamId, entry.id)
  }

  if (loading) return <Spinner full />

  if (!canManage) {
    return (
      <div className="page">
        <Empty title="Owners and admins only" hint="Ask the workspace owner if you need access to infrastructure details." />
      </div>
    )
  }

  const unlocked = Boolean(key)
  const env = ENVIRONMENTS.find((e) => e.id === tab)

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Infrastructure</h1>
          <div className="page-sub">Servers, databases and how to open them — passwords stay encrypted until you unlock</div>
        </div>
        {meta && (
          <div className="row">
            <span className={`infra-lock ${unlocked ? 'open' : ''}`}>{unlocked ? '● Unlocked' : '● Locked'}</span>
            {unlocked && <button className="btn btn-sm" onClick={() => setKey(null)}>Lock</button>}
          </div>
        )}
      </header>

      <div className="page">
        {error && <div className="alert alert-error">{error}</div>}

        {meta === undefined ? (
          <Spinner />
        ) : meta === null ? (
          <SetupVault onCreate={createVault} />
        ) : !unlocked ? (
          <UnlockVault onUnlock={unlock} />
        ) : null}

        {meta && (
          <>
            <div className="segmented infra-tabs" role="tablist" aria-label="Sections">
              {TABS.map((t) => (
                <button key={t.id} className={tab === t.id ? 'on' : ''} role="tab" aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            {env && <EnvironmentPanel env={env} values={values} unlocked={unlocked} copy={copy} copied={copied} />}

            {tab === 'vault' &&
              (unlocked ? (
                <VaultPanel
                  entries={entries}
                  plain={plain}
                  onAdd={() => setEditing({})}
                  onEdit={(entry) => setEditing({ ...entry, ...plain[entry.id] })}
                  onDelete={removeEntry}
                  copy={copy}
                  copied={copied}
                />
              ) : (
                <div className="card"><Empty title="Unlock to see the vault" hint={`${entries.length} encrypted ${entries.length === 1 ? 'entry' : 'entries'} stored.`} /></div>
              ))}

            {tab === 'help' && (
              <section className="card">
                <div className="card-head"><span className="card-title">When something fails</span></div>
                <dl className="infra-trouble">
                  {TROUBLESHOOTING.map(([problem, fix]) => (
                    <div key={problem}>
                      <dt><code>{problem}</code></dt>
                      <dd className="muted">{fix}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </>
        )}
      </div>

      {editing && (
        <EntryForm
          initial={editing.id ? { id: editing.id, label: editing.label, env: editing.env, ref: editing.ref || '', value: editing.value || '', notes: editing.notes || '' } : null}
          takenRefs={takenRefs}
          onSave={saveEntry}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
