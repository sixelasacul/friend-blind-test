import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import type { ConvexHttpClient } from 'convex/browser'

type RouterContext = {
  convexHttpClient: ConvexHttpClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <div className='bg-background min-h-screen p-4'>
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
