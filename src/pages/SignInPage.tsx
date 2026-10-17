import { useState } from 'react'
import type { AuthService } from '../services/types'
import { friendlyError } from '../services/types'

export function SignInPage({ auth, demo, onDemo }: { auth: AuthService; demo: boolean; onDemo?: () => void }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<{ s: 'idle' } | { s: 'sending' } | { s: 'sent'; to: string } | { s: 'error'; msg: string }>({ s: 'idle' })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const to = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { setState({ s: 'error', msg: 'Enter a full email address, like name@company.com.' }); return }
    setState({ s: 'sending' })
    try { await auth.sendMagicLink(to); setState({ s: 'sent', to }) } catch (err) { setState({ s: 'error', msg: friendlyError(err) }) }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col justify-between bg-ink px-6 py-8 text-white sm:px-12 lg:py-14">
        <p className="condensed m-0 text-2xl font-extrabold tracking-tight">GTM Planner</p>
        <div className="my-10 lg:my-0">
          <p className="condensed m-0 text-[clamp(4.5rem,13vw,9rem)] font-extrabold leading-[0.85] tracking-tight">T−56</p>
          <p className="mb-0 mt-5 max-w-sm text-lg text-white/80">From the first research interview to the go/no-go call, one plan that tells every team what’s left to do.</p>
        </div>
        <p className="m-0 text-sm text-white/55">Strategy, plan, readiness, and what you learn after launch.</p>
      </section>

      <section className="flex items-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          {state.s === 'sent' ? (
            <div role="status">
              <h1 className="m-0 text-3xl font-bold tracking-tight text-ink">Check your inbox</h1>
              <p className="mt-3 text-ink-soft">We sent a sign-in link to <b className="text-ink">{state.to}</b>. Open it on this device and you’ll land back here, signed in.</p>
              <p className="mt-3 text-sm text-ink-muted">Nothing after a couple of minutes? Check spam, or send the link again.</p>
              <button type="button" onClick={() => setState({ s: 'idle' })} className="mt-4 rounded-md border border-line bg-sheet px-4 py-2.5 font-semibold text-ink hover:border-ink-muted">Use a different email</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h1 className="m-0 text-3xl font-bold tracking-tight text-ink">Sign in</h1>
              <p className="mb-6 mt-2 text-ink-soft">No password. We’ll email you a link that signs you in.</p>
              <label htmlFor="email" className="mb-1 block text-sm font-semibold text-ink">Work email</label>
              <input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                aria-invalid={state.s === 'error'} aria-describedby={state.s === 'error' ? 'email-error' : undefined}
                className="field-control text-base" placeholder="name@company.com" />
              {state.s === 'error' && <p id="email-error" className="mb-0 mt-2 text-sm text-alert">{state.msg}</p>}
              <button type="submit" disabled={state.s === 'sending'} className="mt-5 w-full rounded-md bg-ink px-4 py-3 font-semibold text-white hover:bg-ink-soft disabled:opacity-60">
                {state.s === 'sending' ? 'Sending the link…' : 'Email me a sign-in link'}
              </button>
              {demo && onDemo && (
                <p className="mt-6 text-sm text-ink-muted">
                  Supabase isn’t configured on this copy of the app. <button type="button" onClick={onDemo} className="font-semibold text-ink underline decoration-signal decoration-2 underline-offset-2">Try it without an account</button> (nothing is saved).
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
