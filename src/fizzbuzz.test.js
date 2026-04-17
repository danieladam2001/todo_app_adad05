import test from 'ava'
import { fizzbuz } from './fizzbuzz.js'

test('it returns fizz on 3', (t) => {
  const result = fizzbuz(3)
  t.is(result, 'fizz')
})

test('it returns buzz on 5', (t) => {
  const result = fizzbuz(5)
  t.is(result, 'buzz')
})

test('it returns buzz on 10', (t) => {
  const result = fizzbuz(10)
  t.is(result, 'buzz')
})

test('it returns fizz on 2', (t) => {
  const result = fizzbuz(2)
  t.is(result, 2)
})

test('it returns fizz on 15', (t) => {
  const result = fizzbuz(15)
  t.is(result, 'fizzbuzz')
})

test('it returns fizz on 30', (t) => {
  const result = fizzbuz(30)
  t.is(result, 'fizzbuzz')
})
