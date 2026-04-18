import test from 'ava'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { app, db } from '../src/app.js'
import { todosTable } from '../src/schema.js'
import { eq } from 'drizzle-orm'

test.before('migrate database', async () => {
  await migrate(db, { migrationsFolder: './drizzle' })
})

test.beforeEach('database cleanup', async () => {
  await db.delete(todosTable)
})

test.serial('it shows proper title', async (t) => {
  const response = await app.request('/')
  const html = await response.text()

  t.assert(html.includes('<title>Todo seznam</title>'))
})

test.serial('it shows todos', async (t) => {
  await db.insert(todosTable).values({
    title: 'Moje todočko',
    priority: 'medium',
    done: false,
  })

  const response = await app.request('/')
  const html = await response.text()

  t.assert(html.includes('Moje todočko'))
})

test.serial('it allows creating todos', async (t) => {
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

// test 1 - vytvoření nového todo a jeho smazání
test.serial('it allows to create todo and then delete it', async (t) => {

  const test_todo = `test_todo_${Math.round(Math.random() * 999).toString().padStart(3, '0')}`

  const formData = new FormData()
  formData.set('title', test_todo)
  formData.set('priority', 'medium')

  const response = await app.request('/add-todo', {
    method: 'POST',
    body: formData,
  })

  const response1 = await app.request('/')
  const html1 = await response1.text()

  await db.delete(todosTable).where(eq(todosTable.title, test_todo))

  const response2 = await app.request('/')
  const html2 = await response2.text()

  t.assert(html1.includes(test_todo) && !html2.includes(test_todo))

})

// test 2 - vytvoření nového todo a zobrazení jeho detailu
test.serial('it allows to create todo and see its detail', async (t) => {

  const test_todo = `test_todo_${Math.round(Math.random() * 999).toString().padStart(3, '0')}`

  const formData = new FormData()
  formData.set('title', test_todo)
  formData.set('priority', 'medium')

  const response = await app.request('/add-todo', {
    method: 'POST',
    body: formData,
  })

  const todo = await db.select().from(todosTable).where(eq(todosTable.title, test_todo)).get()

  const response2 = await app.request(`/todo/${todo.id}`)
  const html = await response2.text()

  t.assert(html.includes(`<title>${test_todo} – Todo detail</title>`))

})

// test 3 - vytvoření nového todo a jeho přejmenování
test.serial('it allows to create todo and rename it', async (t) => {

  const test_todo = `test_todo_${Math.round(Math.random() * 999).toString().padStart(3, '0')}`
  const test_todo_2 = `test_todo_${Math.round(Math.random() * 999).toString().padStart(3, '0')}`

  const formData = new FormData()
  formData.set('title', test_todo)
  formData.set('priority', 'medium')

  const response = await app.request('/add-todo', {
    method: 'POST',
    body: formData,
  })

  const todo = await db.select().from(todosTable).where(eq(todosTable.title, test_todo)).get()

  const response2 = await app.request(`/todo/${todo.id}`)
  const html2 = await response2.text()

  await db.update(todosTable).set({ title:test_todo_2, priority:todo.priority }).where(eq(todosTable.id, todo.id))

  const response3 = await app.request(`/todo/${todo.id}`)
  const html3 = await response3.text()

  t.assert(html2.includes(`<title>${test_todo} – Todo detail</title>`) && html3.includes(`<title>${test_todo_2} – Todo detail</title>`))

})

// test 4 - vytvoření nového todo a přepnutí stavu
test.serial('it allows to create todo and toggle it', async (t) => {

  const test_todo = `test_todo_${Math.round(Math.random() * 999).toString().padStart(3, '0')}`

  const formData = new FormData()
  formData.set('title', test_todo)
  formData.set('priority', 'medium')

  const response = await app.request('/add-todo', {
    method: 'POST',
    body: formData,
  })

  const todo = await db.select().from(todosTable).where(eq(todosTable.title, test_todo)).get()

  const response2 = await app.request(`/todo/${todo.id}`)
  const html2 = await response2.text()

  const response3 = await app.request(`/toggle-todo/${todo.id}`)

  const response4 = await app.request(`/todo/${todo.id}`)
  const html4 = await response4.text()

  t.assert(
    html2.includes(`<title>${test_todo} – Todo detail</title>`) &&
    html2.includes("Čeká na splnění") &&
    html4.includes(`<title>${test_todo} – Todo detail</title>`) &&
    html4.includes("Hotovo")
  )

})

// test 4 - vytvoření nového todo a přepnutí priority
test.serial('it allows to create todo and switch priority', async (t) => {

  const test_todo = `test_todo_${Math.round(Math.random() * 999).toString().padStart(3, '0')}`

  const formData = new FormData()
  formData.set('title', test_todo)
  formData.set('priority', 'medium')

  const response = await app.request('/add-todo', {
    method: 'POST',
    body: formData,
  })

  const todo = await db.select().from(todosTable).where(eq(todosTable.title, test_todo)).get()

  const response2 = await app.request(`/todo/${todo.id}`)
  const html2 = await response2.text()

  const formData2 = new FormData()
  formData2.set('id', todo.id)
  formData2.set('title', todo.title)
  formData2.set('priority', 'high')

  const response3 = await app.request(`/update-todo/${todo.id}`, {
    method: 'POST',
    body: formData2,
  })

  const response4 = await app.request(`/todo/${todo.id}`)
  const html4 = await response4.text()

  t.assert(
    html2.includes(`<title>${test_todo} – Todo detail</title>`) &&
    html2.includes("<td>Střední</td>") &&
    html4.includes(`<title>${test_todo} – Todo detail</title>`) &&
    html4.includes("<td>Vysoká</td>")
  )

})