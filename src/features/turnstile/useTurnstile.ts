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

export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const pendingResolveRef = useRef<((token: string) => void) | null>(null)
  const pendingRejectRef = useRef<((error: Error) => void) | null>(null)
  const [, setStatus] = useState(turnstileSiteKey ? 'waiting' : 'disabled')

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
          setStatus('ready')
          pendingResolveRef.current?.(token)
          pendingResolveRef.current = null
          pendingRejectRef.current = null
        },
        'expired-callback': () => {
          setStatus('expired')
          pendingRejectRef.current?.(new Error('Turnstile challenge expired.'))
          pendingResolveRef.current = null
          pendingRejectRef.current = null
        },
        'error-callback': () => {
          setStatus('error')
          pendingRejectRef.current?.(new Error('Turnstile verification failed.'))
          pendingResolveRef.current = null
          pendingRejectRef.current = null
        },
      })
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
    document.head.appendChild(script)

    return () => {
      script.onload = null
    }
  }, [])

  const getToken = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const widgetId = widgetIdRef.current

      if (!window.turnstile || !widgetId) {
        reject(new Error('Turnstile is not ready yet.'))
        return
      }

      pendingResolveRef.current = resolve
      pendingRejectRef.current = reject
      setStatus('checking')
      window.turnstile.execute(widgetId)
    })
  }, [])

  const reset = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
      setStatus('waiting')
    }
  }, [])

  return {
    containerRef,
    enabled: Boolean(turnstileSiteKey),
    getToken,
    reset,
  }
}
