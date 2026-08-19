import { describe, expect, test } from 'bun:test'
import { parseInserts } from './mysqldump-parse'

describe('parseInserts', () => {
  test('basic multi-row insert', () => {
    const rows = parseInserts(
      "insert into donations(donor,donee,amount) values ('A','B',10),('C','D',20.5);",
      'donations'
    )
    expect(rows).toEqual([
      { donor: 'A', donee: 'B', amount: 10 },
      { donor: 'C', donee: 'D', amount: 20.5 },
    ])
  })

  test('escaped quotes, doubled quotes, NULL, comments', () => {
    const sql = `
      /* leading comment with 'quotes' and (parens) */
      insert into donations(donor,notes,amount) values
        ('O\\'Brien','said ''hi'', then left',NULL)
        -- trailing comment
        ,('X','a,b)c',5);
    `
    const rows = parseInserts(sql, 'donations')
    expect(rows[0]).toEqual({ donor: "O'Brien", notes: "said 'hi', then left", amount: null })
    expect(rows[1]).toEqual({ donor: 'X', notes: 'a,b)c', amount: 5 })
  })

  test('skips other statements and tables', () => {
    const sql = `
      create table donations (x int);
      insert into other_table(a) values ('nope');
      insert into donations(donor) values ('yes');
    `
    expect(parseInserts(sql, 'donations')).toEqual([{ donor: 'yes' }])
  })

  test('multiple insert statements accumulate', () => {
    const sql = `
      insert into donations(donor) values ('one');
      insert into donations(donor) values ('two'),('three');
    `
    expect(parseInserts(sql, 'donations').length).toBe(3)
  })
})
