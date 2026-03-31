import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import ejs from 'ejs'
import { drizzle } from 'drizzle-orm/libsql'
import { todosTable } from './src/schema.js'
import { eq } from 'drizzle-orm'

const db = drizzle({
  connection: 'file:db.sqlite',
  logger: true,
})

const app = new Hono()

app.get(async (c, next) => {
  console.log(c.req.method, c.req.url)

  await next()
})

app.get('/', async (c) => {
  const todos = await db.select().from(todosTable).all()

  const html = await ejs.renderFile('views/index.html', {
    name: 'Todos',
    todos,
  })

  return c.html(html)
})

app.get('/todo/:id', async (c, next) => {
  const id = Number(c.req.param('id'))

  const todo = await db.select().from(todosTable).where(eq(todosTable.id, id)).get()

  if (!todo) return await next()

  const html = ejs.renderFile('views/todo-detail.html', {
    todo,
  })

  return c.html(html)
})

app.post('/add-todo', async (c) => {
  const body = await c.req.formData()
  const title = body.get('title')

  await db.insert(todosTable).values({
    title,
    done: false,
  })

  return c.redirect('/')
})

app.get('/remove-todo/:id', async (c) => {
  const id = Number(c.req.param('id'))

  await db.delete(todosTable).where(eq(todosTable.id, id))

  return c.redirect('/')
})

app.get('/toggle-todo/:id', async (c) => {
  const id = Number(c.req.param('id'))

  const todo = await db.select().from(todosTable).where(eq(todosTable.id, id)).get()

  await db.update(todosTable).set({ done: !todo.done }).where(eq(todosTable.id, id))

  return redirectBack(c, '/')
})

app.post('/update-todo/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.formData()
  const title = body.get('title')
  const priority = body.get('priority')

  await db.update(todosTable).set({ title, priority }).where(eq(todosTable.id, id))

  return redirectBack(c, '/')
})

app.notFound(async (c) => {
  const html = await ejs.renderFile('views/404.html')

  c.status(404)

  return c.html(html)
})

serve(app, (info) => {
  console.log(`Server started on http://localhost:${info.port}`)
})

const redirectBack = (c, fallbackUrl) => {
  const referer = c.req.header('Referer')
  return c.redirect(referer || fallbackUrl)
}
