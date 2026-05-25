import { useCallback, useEffect, useRef, useState } from 'react'

type Turnstile = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
      theme?: 'light' | 'dark' | 'auto'
      size?: 'normal' | 'compact' | 'flexible'
      appearance?: 'always' | 'execute' | 'interaction-only'
      execution?: 'render' | 'execute'
    },
  ) => string
  reset: (widgetId: string) => void
  execute: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

export const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''
const turnstileTokenMaxAgeMs = 240_000

export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const readyTokenRef = useRef<string | null>(null)
  const tokenIssuedAtRef = useRef(0)
  const isCheckingRef = useRef(false)
  const pendingResolveRef = useRef<((token: string) => void) | null>(null)
  const pendingRejectRef = useRef<((error: Error) => void) | null>(null)
  const [, setStatus] = useState(turnstileSiteKey ? 'waiting' : 'disabled')

  const rejectPending = useCallback((error: Error) => {
    isCheckingRef.current = false
    pendingRejectRef.current?.(error)
    pendingResolveRef.current = null
    pendingRejectRef.current = null
  }, [])

  const hasFreshToken = useCallback(() => {
    return Boolean(readyTokenRef.current && Date.now() - tokenIssuedAtRef.current < turnstileTokenMaxAgeMs)
  }, [])

  const executeWidget = useCallback(() => {
    const widgetId = widgetIdRef.current

    if (!window.turnstile || !widgetId || isCheckingRef.current || hasFreshToken()) {
      return
    }

    try {
      isCheckingRef.current = true
      setStatus('checking')
      window.turnstile.execute(widgetId)
    } catch (err) {
      rejectPending(err instanceof Error ? err : new Error('Turnstile verification failed.'))
    }
  }, [hasFreshToken, rejectPending])

  useEffect(() => {
    if (!turnstileSiteKey || !containerRef.current || widgetIdRef.current) {
      return
    }

    const renderTurnstile = () => {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current) {
        return false
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: turnstileSiteKey,
        appearance: 'execute',
        execution: 'execute',
        callback: (token) => {
          isCheckingRef.current = false
          tokenIssuedAtRef.current = Date.now()
          setStatus('ready')
          if (pendingResolveRef.current) {
            pendingResolveRef.current(token)
            pendingResolveRef.current = null
            pendingRejectRef.current = null
          } else {
            readyTokenRef.current = token
          }
        },
        'expired-callback': () => {
          readyTokenRef.current = null
          tokenIssuedAtRef.current = 0
          setStatus('waiting')
          rejectPending(new Error('Turnstile verification expired. Please try again.'))
          if (document.visibilityState === 'visible') {
            if (widgetIdRef.current && window.turnstile) {
              window.turnstile.reset(widgetIdRef.current)
            }
            executeWidget()
          }
        },
        'error-callback': () => {
          setStatus('error')
          readyTokenRef.current = null
          tokenIssuedAtRef.current = 0
          rejectPending(new Error('Turnstile verification failed.'))
        },
      })
      executeWidget()
      return true
    }

    if (renderTurnstile()) {
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = renderTurnstile
    script.onerror = () => {
      setStatus('error')
      pendingRejectRef.current?.(new Error('Turnstile failed to load.'))
      pendingResolveRef.current = null
      pendingRejectRef.current = null
    }
    document.head.appendChild(script)

    return () => {
      script.onload = null
      script.onerror = null
    }
  }, [executeWidget, rejectPending])

  useEffect(() => {
    function refreshVisibleToken() {
      if (document.visibilityState === 'visible' && !hasFreshToken()) {
        readyTokenRef.current = null
        tokenIssuedAtRef.current = 0
        if (widgetIdRef.current && window.turnstile) {
          isCheckingRef.current = false
          window.turnstile.reset(widgetIdRef.current)
        }
        executeWidget()
      }
    }

    document.addEventListener('visibilitychange', refreshVisibleToken)

    return () => {
      document.removeEventListener('visibilitychange', refreshVisibleToken)
    }
  }, [executeWidget, hasFreshToken])

  const getToken = useCallback((): Promise<string> => {
    if (hasFreshToken() && readyTokenRef.current) {
      const token = readyTokenRef.current
      readyTokenRef.current = null
      tokenIssuedAtRef.current = 0
      return Promise.resolve(token)
    }

    readyTokenRef.current = null
    tokenIssuedAtRef.current = 0
    if (widgetIdRef.current && window.turnstile) {
      isCheckingRef.current = false
      window.turnstile.reset(widgetIdRef.current)
    }

    return new Promise((resolve, reject) => {
      const widgetId = widgetIdRef.current

      pendingResolveRef.current = resolve
      pendingRejectRef.current = reject

      if (!window.turnstile || !widgetId) {
        rejectPending(new Error('Turnstile is not ready. Please try again.'))
        return
      }

      executeWidget()
    })
  }, [executeWidget, hasFreshToken, rejectPending])

  const reset = useCallback(() => {
    readyTokenRef.current = null
    tokenIssuedAtRef.current = 0
    if (widgetIdRef.current && window.turnstile) {
      try {
        isCheckingRef.current = false
        window.turnstile.reset(widgetIdRef.current)
        setStatus('waiting')
        executeWidget()
      } catch (err) {
        rejectPending(err instanceof Error ? err : new Error('Turnstile verification failed.'))
      }
    }
  }, [executeWidget, rejectPending])

  return {
    containerRef,
    enabled: Boolean(turnstileSiteKey),
    getToken,
    reset,
  }
}
