import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'

// Import the generated route tree
import { routeTree } from './routeTree.gen'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ConvexHttpClient } from 'convex/browser'
import reportWebVitals from './reportWebVitals.ts'

import './index.css'

// Create a new router instance
const router = createRouter({
  routeTree,
  context: {
    convexHttpClient: new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL)
  }
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)

// Render the app
const rootElement = document.getElementById('app')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <ConvexProvider client={convex}>
        <RouterProvider router={router} />
      </ConvexProvider>
    </StrictMode>
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
