import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/api'
import { useTransition } from 'react'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/')({
  component: RouteComponent
})

function RouteComponent() {
  const navigate = useNavigate()
  const createLobby = useMutation(api.lobbies.create)
  const [isPending, startTransition] = useTransition()

  async function createLobbyThenRedirect() {
    startTransition(async () => {
      const lobbyId = await createLobby()
      await navigate({
        to: '/$lobbyId',
        params: { lobbyId }
      })
    })
  }

  return (
    <div className='flex min-h-screen items-center justify-center'>
      <div className='bg-card flex w-full max-w-2xl flex-col items-center gap-8 rounded-lg border p-12 md:p-16'>
        {/* App Title */}
        <h1 className='text-center text-4xl font-bold md:text-6xl'>
          Friend Blind Test
        </h1>

        {/* Description */}
        <p className='text-muted-foreground max-w-md text-center text-lg md:text-xl'>
          Test your music knowledge with friends. Guess the artist and song
          name!
        </p>

        {/* Play Button */}
        <Button
          size='lg'
          className='px-8 py-6 text-lg'
          onClick={createLobbyThenRedirect}
          disabled={isPending}
        >
          {isPending && <Spinner />}
          Play
        </Button>

        {/*<Link to='/debug'>Debug</Link>*/}
      </div>
    </div>
  )
}
