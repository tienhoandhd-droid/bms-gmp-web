const MAX_INCIDENT_ID = 9223372036854775807n

export function parseEmailIncidentSearch(search) {
  const params = new URLSearchParams(search || '')
  const token = params.get('token')
  if (token) return { kind: 'token', token }

  const incidentId = params.get('incident')
  const intent = params.get('intent')
  if (!incidentId && !intent) return { kind: 'none' }
  if (!/^[1-9]\d*$/.test(incidentId || '') || !['receive', 'update', 'view'].includes(intent || '')) {
    return { kind: 'invalid' }
  }
  try {
    if (BigInt(incidentId) > MAX_INCIDENT_ID) return { kind: 'invalid' }
  } catch { return { kind: 'invalid' }
  }
  return { kind: 'incident', incidentId, intent }
}

export function scrubEmailActionSearch(search, tokenWins) {
  const params = new URLSearchParams(search || '')
  for (const key of ['token', 'sc', 'act']) params.delete(key)
  if (tokenWins) { params.delete('incident'); params.delete('intent') }
  return params.toString()
}

export function theoDoiPhienEmail(auth, onSession) {
  let stopped = false
  let generation = 0
  const { data: subscriptionData } = auth.onAuthStateChange((_event, session) => {
    generation += 1
    if (!stopped) onSession(session)
  })
  const initialGeneration = generation
  Promise.resolve(auth.getSession()).then(({ data }) => {
    if (!stopped && initialGeneration === generation) onSession(data?.session || null)
  }).catch(() => {
    if (!stopped && initialGeneration === generation) onSession(null)
  })
  return () => { stopped = true; subscriptionData?.subscription?.unsubscribe?.() }
}

export function laNutNhanViec(action) {
  return new Set(['ipc_nhan_viec', 'mep_tiep_nhan', 'lot_nhan_dieu_phoi', 'qa_nhan_ra_soat']).has(action?.code)
}

export function chonNutTheoIntent(actions, intent) {
  return intent === 'receive' ? (actions || []).find(laNutNhanViec) || null : null
}
