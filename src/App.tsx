import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type LoginResponse = {
  access_token: string
  token_type: string
  expires_in: number
  user_id: string
  username: string
}

type QnARecord = {
  id: number
  user_id: string
  question: string
  answer: string
  is_ai_generated: boolean
  created_at: string
  updated_at: string
}

type HealthResponse = {
  status: string
  message: string
}

type HealthState = {
  auth: string
  qna: string
}

const AUTH_API = 'http://localhost:5000'
const QNA_API = 'http://localhost:8000'
const STORAGE_KEY = 'fullstack-auth-session'

function formatTime(value: string) {
  return new Date(value).toLocaleString()
}

function App() {
  const [username, setUsername] = useState('testuser')
  const [password, setPassword] = useState('testpass')
  const [question, setQuestion] = useState('')
  const [session, setSession] = useState<LoginResponse | null>(null)
  const [records, setRecords] = useState<QnARecord[]>([])
  const [health, setHealth] = useState<HealthState>({ auth: 'Checking', qna: 'Checking' })
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false)
  const [isLoadingRecords, setIsLoadingRecords] = useState(false)
  const [authError, setAuthError] = useState('')
  const [workspaceError, setWorkspaceError] = useState('')

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      return
    }

    try {
      const parsed = JSON.parse(saved) as LoginResponse
      if (parsed.access_token) {
        setSession(parsed)
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchHealth() {
      const [authStatus, qnaStatus] = await Promise.all([
        fetch(`${AUTH_API}/health`)
          .then(async (response) => {
            if (!response.ok) {
              throw new Error('Unavailable')
            }
            const data = (await response.json()) as HealthResponse
            return data.status
          })
          .catch(() => 'Offline'),
        fetch(`${QNA_API}/health`)
          .then(async (response) => {
            if (!response.ok) {
              throw new Error('Unavailable')
            }
            const data = (await response.json()) as HealthResponse
            return data.status
          })
          .catch(() => 'Offline'),
      ])

      if (!cancelled) {
        setHealth({
          auth: authStatus,
          qna: qnaStatus,
        })
      }
    }

    fetchHealth()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setRecords([])
      window.localStorage.removeItem(STORAGE_KEY)
      return
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    void loadRecords(session.access_token)
  }, [session])

  async function loadRecords(token: string) {
    setIsLoadingRecords(true)
    setWorkspaceError('')

    try {
      const response = await fetch(`${QNA_API}/qna`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.status === 401) {
        throw new Error('Your session is no longer valid. Please sign in again.')
      }

      if (!response.ok) {
        throw new Error('Unable to load your QnA history.')
      }

      const data = (await response.json()) as QnARecord[]
      setRecords(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load your workspace.'
      setWorkspaceError(message)
      if (message.includes('sign in again')) {
        setSession(null)
      }
    } finally {
      setIsLoadingRecords(false)
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoggingIn(true)
    setAuthError('')

    try {
      const response = await fetch(`${AUTH_API}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      setSession(data as LoginResponse)
      setQuestion('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session || !question.trim()) {
      return
    }

    setIsSubmittingQuestion(true)
    setWorkspaceError('')

    try {
      const response = await fetch(`${QNA_API}/qna`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ question: question.trim() }),
      })

      const data = await response.json()

      if (response.status === 401) {
        throw new Error('Your session expired. Please sign in again.')
      }

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to save your question.')
      }

      setRecords((current) => [data as QnARecord, ...current])
      setQuestion('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit your question.'
      setWorkspaceError(message)
      if (message.includes('sign in again')) {
        setSession(null)
      }
    } finally {
      setIsSubmittingQuestion(false)
    }
  }

  function handleLogout() {
    setSession(null)
    setQuestion('')
    setWorkspaceError('')
    setAuthError('')
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Node Auth + FastAPI QnA</p>
        <h1>Sign in once. Route every question through the live backend pair.</h1>
        <p className="hero-copy">
          This client uses the Express login endpoint to mint a JWT, then forwards
          that token to FastAPI for protected QnA creation and history retrieval.
        </p>

        <div className="status-grid">
          <article className="status-card">
            <span className="status-label">Auth API</span>
            <strong>{health.auth}</strong>
            <p>{AUTH_API}/auth/login</p>
          </article>
          <article className="status-card">
            <span className="status-label">QnA API</span>
            <strong>{health.qna}</strong>
            <p>{QNA_API}/qna</p>
          </article>
        </div>

        <div className="hero-notes">
          <div>
            <span>Screen 1</span>
            <p>Credential capture with backend health visibility.</p>
          </div>
          <div>
            <span>Screen 2</span>
            <p>Authenticated workspace for asking, storing, and reviewing responses.</p>
          </div>
        </div>
      </section>

      {!session ? (
        <section className="panel auth-panel">
          <div className="panel-copy">
            <p className="section-kicker">Login</p>
            <h2>Open your workspace</h2>
            <p>
              The current backend accepts any username and password pair. This screen
              is wired to the real login endpoint, not mocked client state.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span>Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </label>

            {authError ? <p className="message error">{authError}</p> : null}

            <button className="primary-button" type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>
      ) : (
        <section className="panel workspace-panel">
          <header className="workspace-header">
            <div>
              <p className="section-kicker">Workspace</p>
              <h2>{session.username}'s questions</h2>
              <p>
                Token type: <code>{session.token_type}</code> · Expires in{' '}
                <code>{session.expires_in}s</code>
              </p>
            </div>
            <button className="ghost-button" type="button" onClick={handleLogout}>
              Logout
            </button>
          </header>

          <form className="composer" onSubmit={handleAsk}>
            <label>
              <span>Ask the FastAPI service</span>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Try: What can this stack do for authenticated users?"
                rows={4}
              />
            </label>

            <div className="composer-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={isSubmittingQuestion || !question.trim()}
              >
                {isSubmittingQuestion ? 'Sending...' : 'Send question'}
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={isLoadingRecords}
                onClick={() => void loadRecords(session.access_token)}
              >
                {isLoadingRecords ? 'Refreshing...' : 'Refresh history'}
              </button>
            </div>
          </form>

          {workspaceError ? <p className="message error">{workspaceError}</p> : null}

          <section className="records-section">
            <div className="records-head">
              <h3>Saved responses</h3>
              <span>{records.length} record(s)</span>
            </div>

            {records.length === 0 && !isLoadingRecords ? (
              <div className="empty-state">
                <p>No QnA records yet.</p>
                <span>Your first successful question will appear here.</span>
              </div>
            ) : (
              <div className="record-list">
                {records.map((record) => (
                  <article className="record-card" key={record.id}>
                    <div className="record-meta">
                      <span>#{record.id}</span>
                      <span>{formatTime(record.created_at)}</span>
                    </div>
                    <h3>{record.question}</h3>
                    <p>{record.answer}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      )}
    </main>
  )
}

export default App
