import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/api'

export const Route = createFileRoute('/')({
  component: RouteComponent
})

function RouteComponent() {
  const navigate = useNavigate()
  const createLobby = useMutation(api.lobbies.create)

  async function createLobbyThenRedirect() {
    const lobbyId = await createLobby()
    navigate({
      to: '/$lobbyId',
      params: { lobbyId }
    })
  }

  return (
    <div className='flex flex-col items-start gap-4'>
      <Button onClick={createLobbyThenRedirect}>Create a lobby</Button>
      <Link to='/debug'>Debug</Link>
    </div>
  )
}
