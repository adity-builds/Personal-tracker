import { useState, useEffect } from 'react'

/**
 * Returns a Date updated in realtime.
 * @param {number} intervalMs - tick interval (default 1000ms for live clock, use 60000 for date-only)
 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    // Sync to next second boundary for smooth clock (avoid drift)
    let id
    const tick = () => setNow(new Date())

    if (intervalMs >= 1000) {
      const msToNextSec = 1000 - (Date.now() % 1000)
      const timeout = setTimeout(() => {
        tick()
        id = setInterval(tick, intervalMs)
      }, msToNextSec)
      return () => {
        clearTimeout(timeout)
        if (id) clearInterval(id)
      }
    }

    id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
