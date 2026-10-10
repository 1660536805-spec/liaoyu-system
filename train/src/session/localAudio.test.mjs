import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalAudioPlayer } from './localAudio.js'

function fakeAudio() {
  return {
    src: '', currentTime: 0, paused: true, calls: [],
    async play() { this.calls.push('play'); this.paused = false },
    pause() { this.calls.push('pause'); this.paused = true },
    load() { this.calls.push('load') },
    removeAttribute(name) { if (name === 'src') this.src = '' },
  }
}

test('audio is only created on an explicit play call and a blocked start can be retried', async () => {
  const audio = fakeAudio()
  let creations = 0
  const player = createLocalAudioPlayer({ audioFactory: () => { creations++; return audio } })
  assert.equal(creations, 0)
  audio.play = async () => { audio.calls.push('play'); throw Object.assign(new Error('gesture required'), { name: 'NotAllowedError' }) }
  assert.equal(await player.play('zuiyu.mp3'), false)
  assert.equal(creations, 1)
  assert.equal(player.snapshot().state, 'blocked')
  assert.match(player.snapshot().error, /点击播放/)
  audio.play = async () => { audio.calls.push('play'); audio.paused = false }
  assert.equal(await player.play('zuiyu.mp3'), true)
  assert.equal(player.snapshot().state, 'playing')
  player.dispose()
})

test('changing tracks and leaving the route pause and release audio sources', async () => {
  const audios = []
  const player = createLocalAudioPlayer({ audioFactory: () => { const audio = fakeAudio(); audios.push(audio); return audio } })
  await player.play('zuiyu.mp3')
  const first = audios[0]
  await player.play('meihua.mp3')
  assert.equal(first.paused, true)
  assert.equal(first.src, '')
  assert.equal(player.snapshot().source, '/audio/meihua.mp3')
  const second = audios[1]
  player.dispose()
  assert.equal(second.paused, true)
  assert.equal(second.src, '')
  assert.equal(player.snapshot().state, 'disposed')
})
