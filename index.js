import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import ejs from 'ejs'
import { drizzle } from 'drizzle-orm/libsql'
import { todosTable } from './src/schema.js'
import { eq } from 'drizzle-orm'
import { createNodeWebSocket } from '@hono/node-ws'
import { WSContext } from 'hono/ws'

const db = drizzle({
  connection: 'file:db.sqlite',
  logger: true,
})

const app = new Hono()

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

app.get(async (c, next) => {
  console.log(c.req.method, c.req.url)

  await next()
})

/**
 * @type {Set<WSContext<WebSocket>>}
 */
let webSockets = new Set()

app.get(
  '/ws',
  upgradeWebSocket((c) => ({
    onOpen: (evt, ws) => {
      webSockets.add(ws)
      console.log('open web sockets:', webSockets.size)
    },
    onMessage: () => {
      console.log('message')
    },
    onClose: (evt, ws) => {
      console.log('close')
      webSockets.delete(ws)
    },
  })),
)

app.get('/', async (c) => {
  const todos = await db.select().from(todosTable).all()

  const html = await ejs.renderFile('views/index.html', {
    name: 'Todos',
    todos,
    utils,
  })

  return c.html(html)
})

app.get('/todo/:id', async (c, next) => {
  const id = Number(c.req.param('id'))

  const todo = await db.select().from(todosTable).where(eq(todosTable.id, id)).get()

  if (!todo) return await next()

  const html = ejs.renderFile('views/todo-detail.html', {
    todo,
    utils,
  })

  return c.html(html)
})

app.post('/add-todo', async (c) => {
  const body = await c.req.formData()
  const title = body.get('title')
  const priority = body.get('priority')

  await db.insert(todosTable).values({
    title,
    priority,
    done: false,
  })

  sendTodosToAllWebsockets()

  return c.redirect('/')
})

app.get('/remove-todo/:id', async (c) => {
  const id = Number(c.req.param('id'))

  await db.delete(todosTable).where(eq(todosTable.id, id))

  sendTodosToAllWebsockets()
  sendTodoDeleteAlert(id)

  return c.redirect('/')
})

app.get('/toggle-todo/:id', async (c) => {
  const id = Number(c.req.param('id'))

  const todo = await db.select().from(todosTable).where(eq(todosTable.id, id)).get()

  await db.update(todosTable).set({ done: !todo.done }).where(eq(todosTable.id, id))

  sendTodosToAllWebsockets()
  sendTodoDetailToAllWebsockets(id)

  return redirectBack(c, '/')
})

const sendTodosToAllWebsockets = async () => {
  try {
    const todos = await db.select().from(todosTable).all()

    const html = await ejs.renderFile('views/_todos.html', {
      todos,
      utils,
    })

    for (const webSocket of webSockets) {
      webSocket.send(
        JSON.stringify({
          type: 'todos',
          html,
        }),
      )
    }
  } catch (e) {
    console.error(e)
  }
}

const sendTodoDetailToAllWebsockets = async (id) => {
  try {
    const todo = await db.select().from(todosTable).where(eq(todosTable.id, id)).get()

    const html = await ejs.renderFile('views/_todo_detail.html', {
      todo,
      utils,
    })

    for (const webSocket of webSockets) {
      webSocket.send(
        JSON.stringify({
          type: 'todo_detail',
          todo_id: id,
          html,
        }),
      )
    }
  } catch (e) {
    console.error(e)
  }
}

const sendTodoDeleteAlert = async (id) => {
  try {
    for (const webSocket of webSockets) {
      webSocket.send(
        JSON.stringify({
          type: 'todo_detail_deleted',
          todo_id: id
        }),
      )
    }
  } catch (e) {
    console.error(e)
  }
}

app.post('/update-todo/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.formData()
  const title = body.get('title')
  const priority = body.get('priority')

  await db.update(todosTable).set({ title, priority }).where(eq(todosTable.id, id))

  sendTodosToAllWebsockets()
  sendTodoDetailToAllWebsockets(id)

  return redirectBack(c, '/')
})

app.get('/todo-delete', async (c) => {
  const html = ejs.renderFile('views/todo_detail_deleted.html')

  return c.html(html)
})

app.notFound(async (c) => {
  const html = await ejs.renderFile('views/404.html')

  c.status(404)

  return c.html(html)
})

const server = serve(app, (info) => {
  console.log(`Server started on http://localhost:${info.port}`)
})

injectWebSocket(server)

const redirectBack = (c, fallbackUrl) => {
  const referer = c.req.header('Referer')
  return c.redirect(referer || fallbackUrl)
}

const utils = {
  formatPriority: (priority) => {
    if (priority === 'low') {
      return 'Nízká'
    } else if (priority === 'medium') {
      return 'Střední'
    } else if (priority === 'high') {
      return 'Vysoká'
    } else {
      return priority
    }
  },
}
