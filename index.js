import { serve } from '@hono/node-server'
import { app, injectWebSocket } from './src/app.js'

const server = serve(app, (info) => {
  console.log(`Server started on http://localhost:${info.port}`)
})

injectWebSocket(server)
