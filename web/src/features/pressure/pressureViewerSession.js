export const PRESSURE_HEARTBEAT_MS = 30_000

export function isPressureViewerActive({ isLive, active, visibilityState }) {
  return Boolean(isLive && active && visibilityState === 'visible')
}

export function createPressureViewerId(cryptoApi = globalThis.crypto) {
  return cryptoApi.randomUUID()
}

export function createPressureViewerSession({
  viewerId,
  touch,
  release,
  requestUpdate,
  setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer = (id) => globalThis.clearTimeout(id),
}) {
  let active = false
  let disposed = false
  let heartbeatId = null
  let transition = 0
  let activationPromise = null
  let rpcQueue = Promise.resolve()

  const touchSucceeded = (result) => result !== false && result?.ok !== false

  const enqueueRpc = (operation) => {
    const queued = rpcQueue.then(operation, operation)
    rpcQueue = queued.catch(() => undefined)
    return queued
  }

  const touchViewer = () => enqueueRpc(() => touch(viewerId))

  const clearHeartbeat = () => {
    if (heartbeatId === null) return
    clearTimer(heartbeatId)
    heartbeatId = null
  }

  const releaseBestEffort = () => {
    return enqueueRpc(() => release(viewerId)).catch(() => undefined)
  }

  const scheduleHeartbeat = (currentTransition, updateAfterSuccessfulTouch = false) => {
    if (!active || disposed || transition !== currentTransition) return

    heartbeatId = setTimer(async () => {
      heartbeatId = null
      if (!active || disposed || transition !== currentTransition) return

      try {
        const result = await touchViewer()
        if (!touchSucceeded(result)) {
          scheduleHeartbeat(currentTransition, updateAfterSuccessfulTouch)
          return
        }
      } catch {
        scheduleHeartbeat(currentTransition, updateAfterSuccessfulTouch)
        return
      }

      if (!active || disposed || transition !== currentTransition) return

      if (updateAfterSuccessfulTouch) {
        try {
          await requestUpdate()
        } catch {
          // The heartbeat remains the source of subsequent updates.
        }
      }

      scheduleHeartbeat(currentTransition)
    }, PRESSURE_HEARTBEAT_MS)
  }

  const activate = async (currentTransition) => {
    let result
    try {
      result = await touchViewer()
    } catch {
      scheduleHeartbeat(currentTransition, true)
      return
    }

    if (!touchSucceeded(result)) {
      scheduleHeartbeat(currentTransition, true)
      return
    }

    if (!active || disposed || transition !== currentTransition) return

    try {
      await requestUpdate()
    } catch {
      // The heartbeat remains the source of subsequent updates.
    }

    if (!active || disposed || transition !== currentTransition) return
    scheduleHeartbeat(currentTransition)
  }

  const setActive = (nextActive) => {
    if (disposed) return Promise.resolve()

    const shouldBeActive = Boolean(nextActive)
    if (shouldBeActive) {
      if (active) return activationPromise ?? Promise.resolve()

      active = true
      const currentTransition = ++transition
      activationPromise = activate(currentTransition)
      return activationPromise
    }

    if (!active) return Promise.resolve()

    active = false
    transition += 1
    clearHeartbeat()
    return releaseBestEffort()
  }

  const dispose = () => {
    if (disposed) return Promise.resolve()

    disposed = true
    const wasActive = active
    active = false
    transition += 1
    clearHeartbeat()
    return wasActive ? releaseBestEffort() : Promise.resolve()
  }

  return { setActive, dispose }
}
