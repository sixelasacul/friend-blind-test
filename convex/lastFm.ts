import { customAction, customCtx } from 'convex-helpers/server/customFunctions'
import { action, internalAction } from './_generated/server'
import { LastFmApi } from './lastFmApi'

export function getLastFmSdk() {
  return new LastFmApi(process.env.LAST_FM_API_KEY!)
}

export const lastFmAction = customAction(
  action,
  customCtx(() => {
    return { lastFm: getLastFmSdk() }
  })
)

export const lastFmInternalAction = customAction(
  internalAction,
  customCtx(() => {
    return { lastFm: getLastFmSdk() }
  })
)
