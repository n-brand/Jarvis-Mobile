import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readProfile, writeProfile } from './profile.mjs'

test('readProfile returns {} when the file does not exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jarvis-profile-'))
  const path = join(dir, 'profile.json')
  assert.deepEqual(readProfile(path), {})
  rmSync(dir, { recursive: true })
})

test('readProfile returns {} when the file is corrupted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jarvis-profile-'))
  const path = join(dir, 'profile.json')
  writeFileSync(path, '{ not valid json')
  assert.deepEqual(readProfile(path), {})
  rmSync(dir, { recursive: true })
})

test('writeProfile then readProfile round-trips', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jarvis-profile-'))
  const path = join(dir, 'profile.json')
  writeProfile(path, { headphones: false, persona: 'edith' })
  assert.deepEqual(readProfile(path), { headphones: false, persona: 'edith' })
  rmSync(dir, { recursive: true })
})

test('writeProfile merges into the existing file rather than replacing it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jarvis-profile-'))
  const path = join(dir, 'profile.json')
  writeProfile(path, { headphones: false })
  writeProfile(path, { persona: 'edith' })
  assert.deepEqual(readProfile(path), { headphones: false, persona: 'edith' })
  rmSync(dir, { recursive: true })
})
