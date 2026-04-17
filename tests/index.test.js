import test from 'ava'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { app, db } from '../src/app.js'
import { todosTable } from '../src/schema.js'

test.before('migrate database', async () => {
  await migrate(db, { migrationsFolder: './drizzle' })
})

test('it shows proper title', async (t) => {
  const response = await app.request('/')
  const html = await response.text()

  t.assert(html.includes('<title>Todo seznam</title>'))
})

test('it shows todos', async (t) => {
  await db.insert(todosTable).values({
    title: 'Moje todočko',
    priority: 'medium',
    done: false,
  })

  const response = await app.request('/')
  const html = await response.text()

  t.assert(html.includes('Moje todočko'))
})

test('it allows creating todos', async (t) => {
  const formData = new FormData()
  formData.set('title', 'Testovací todočko')
  formData.set('priority', 'medium')

  const response = await app.request('/add-todo', {
    method: 'POST',
    body: formData,
  })

  // Ověřím že proběhl redirect
  t.is(response.status, 302)

  // Získám si lokaci kam mě redirect posílá
  const location = response.headers.get('location')

  // Udělám druhý request
  const response2 = await app.request(location, {
    method: 'GET',
  })

  const text = await response2.text()

  // Ověřím že todočko z formuláře se nachází v HTML
  t.assert(text.includes('Testovací todočko'))
})
