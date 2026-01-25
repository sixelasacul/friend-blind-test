import { TanStackDevtools } from '@tanstack/react-devtools'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import type { ConvexHttpClient } from 'convex/browser'

type RouterContext = {
  convexHttpClient: ConvexHttpClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <div className='min-h-screen bg-background p-4'>
      <Outlet />
      <TanStackDevtools
        config={{
          position: 'bottom-right'
        }}
        plugins={[
          {
            name: 'Tanstack Router',
            render: <TanStackRouterDevtoolsPanel />
          }
        ]}
      />
    </div>
  )
})
