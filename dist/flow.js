(function () {
  'use strict'

  var KEY = 'xianyang.records.v1'
  var FEELINGS = ['更放松', '没变化', '不舒服', '说不清', '暂不评价']
  var session = null
  var router = null
  var observer = null
  var pendingDialog = null
  var lastRecord = null
  var notice = null

  function el(tag, attrs, text) {
    var node = document.createElement(tag)
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'className') node.className = attrs[key]
      else node.setAttribute(key, attrs[key])
    })
    if (text !== undefined) node.textContent = String(text)
    return node
  }

  function storageError() {
    if (notice && notice.isConnected) return
    notice = el('div', { className: 'xf-notice', role: 'alert' })
    notice.appendChild(el('span', {}, '本浏览器存储不可用或记录损坏，保存未成功。请检查浏览器存储权限；不要清除已有数据。'))
    notice.appendChild(button('关闭提示', function () { notice.remove() }))
    document.body.appendChild(notice)
  }

  function readRecords() {
    try {
      var raw = localStorage.getItem(KEY)
      var records = raw ? JSON.parse(raw) : []
      if (!Array.isArray(records)) throw new Error('记录格式无效')
      return records
    } catch (error) {
      storageError()
      return null
    }
  }

  function writeRecords(records) {
    try {
      localStorage.setItem(KEY, JSON.stringify(records.slice(-60)))
      window.dispatchEvent(new CustomEvent('xianyang:records-changed'))
      return true
    } catch (error) {
      storageError()
      return false
    }
  }

  function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '时长未记录'
    var seconds = Math.round(ms / 1000)
    return Math.floor(seconds / 60) + ' 分 ' + String(seconds % 60).padStart(2, '0') + ' 秒'
  }

  function modeLabel(mode) {
    return ({ camera: '摄像头跟练', manual: '手动点按 / 演示跟练', mixed: '摄像头 + 手动 / 演示' })[mode] || '方式未记录'
  }

  function begin(getProgress, savePartial, resume) {
    session = { startedAt: Date.now(), sources: new Set(), ended: false, getProgress: getProgress, savePartial: savePartial, resume: resume }
  }

  function mark(source) {
    if (!session || session.ended || pendingDialog) return
    if (source === 'camera' || source === 'manual') session.sources.add(source)
  }

  function withMeta(payload, completion) {
    var sources = session ? Array.from(session.sources) : []
    var mode = sources.length > 1 ? 'mixed' : sources[0] || 'unknown'
    return Object.assign({}, payload, {
      startedAt: session ? session.startedAt : null,
      durationMs: session ? Math.max(0, Date.now() - session.startedAt) : null,
      mode: mode,
      sources: sources,
      completion: completion,
      feedback: '暂不评价'
    })
  }

  function button(text, action, primary) {
    var node = el('button', { type: 'button', className: 'xf-button' + (primary ? ' xf-primary' : '') }, text)
    node.addEventListener('click', action)
    return node
  }

  // 原生模态 dialog 提供焦点约束，关闭后恢复触发控件焦点。
  function dialog(title, description, render, cancelValue) {
    if (pendingDialog) return Promise.resolve(cancelValue)
    return new Promise(function (resolve) {
      var previousFocus = document.activeElement
      var node = el('dialog', { className: 'xf-dialog', 'aria-labelledby': 'xf-title', 'aria-describedby': 'xf-description' })
      var panel = el('div', { className: 'xf-panel' })
      panel.appendChild(el('h2', { id: 'xf-title' }, title))
      panel.appendChild(el('p', { id: 'xf-description' }, description))
      node.appendChild(panel)
      pendingDialog = node
      var settled = false
      function finish(value) {
        if (settled) return
        settled = true
        pendingDialog = null
        node.close()
        node.remove()
        if (previousFocus && previousFocus.isConnected) previousFocus.focus()
        resolve(value)
      }
      node.addEventListener('cancel', function (event) { event.preventDefault(); finish(cancelValue) })
      render(panel, finish)
      document.body.appendChild(node)
      node.showModal()
      var first = node.querySelector('input, button, select')
      if (first) first.focus()
    })
  }

  function actions(panel) {
    var row = el('div', { className: 'xf-actions' })
    panel.appendChild(row)
    return row
  }

  function beforeTrain() {
    return dialog('练前安全确认', '轻松跟练即可，无需追求动作幅度或完成整套。', function (panel, finish) {
      var list = el('ul', { className: 'xf-safety' })
      ;['音量已调低，保持环境安静。', '当前没有疼痛；练习时若疼痛或不适，立即停下。', '可以随时退出，不必勉强完成。', '这只是日常跟练工具，不是医疗服务，不提供诊断或治疗。'].forEach(function (text) {
        list.appendChild(el('li', {}, text))
      })
      panel.appendChild(list)
      var label = el('label', { className: 'xf-check' })
      var check = el('input', { type: 'checkbox' })
      label.appendChild(check)
      label.appendChild(el('span', {}, '我已阅读，音量较低且当前无疼痛'))
      panel.appendChild(label)
      var row = actions(panel)
      row.appendChild(button('暂不练习', function () { finish(false) }))
      var start = button('确认，开始跟练', function () { if (check.checked) finish(true) }, true)
      start.disabled = true
      check.addEventListener('change', function () { start.disabled = !check.checked })
      row.appendChild(start)
    }, false)
  }

  async function leave() {
    if (!session || session.ended) return true
    var active = session
    var progress = active.getProgress ? active.getProgress() : { moves: [] }
    if (!progress.moves.length) { active.ended = true; return true }
    var confirmed = await dialog('退出本次跟练？', '已完成的进度会保存为「中途结束」，不计为完整打卡。', function (panel, finish) {
      panel.appendChild(el('p', {}, '已完成 ' + progress.moves.length + ' 式 · ' + formatDuration(Date.now() - active.startedAt)))
      var row = actions(panel)
      row.appendChild(button('继续练习', function () { finish(false) }, true))
      row.appendChild(button('保存进度并退出', function () { finish(true) }))
    }, false)
    if (!confirmed) { if (active.resume) active.resume(); return false }
    var record = active.savePartial()
    if (!record || !record.saved) {
      var exitUnsaved = await dialog('进度未保存成功', '本浏览器存储不可用。可以返回练习后重试，也可以现在退出，但本次进度可能丢失。', function (panel, finish) {
        var row = actions(panel)
        row.appendChild(button('返回练习，稍后重试', function () { finish(false) }, true))
        row.appendChild(button('不保存，仍然退出', function () { finish(true) }))
      }, false)
      if (!exitUnsaved) { if (active.resume) active.resume(); return false }
    }
    active.ended = true
    lastRecord = record
    return true
  }

  function summaryText(record) {
    return formatDuration(record.durationMs) + ' · 完成 ' + record.doneCount + ' 式 · ' + modeLabel(record.mode) + ' · 感受：' + (FEELINGS.indexOf(record.feedback) >= 0 ? record.feedback : '暂不评价')
  }

  function summary(record, isHistory) {
    return dialog('本次练习总结', '动作计数仅代表跟练进度，不代表识别准确度、质量评分或健康效果。', function (panel, finish) {
      panel.appendChild(el('p', { className: 'xf-summary' }, summaryText(record)))
      panel.appendChild(el('p', {}, record.saved ? '已保存，仅在本浏览器保存。' : '尚未保存成功，仅可查看本次摘要。'))
      var row = actions(panel)
      row.appendChild(button('听赏听轨', function () { finish('listen') }, true))
      row.appendChild(button('查看历史', function () { finish('history') }))
      row.appendChild(button('回到首页', function () { finish('home') }))
      row.appendChild(button('再练一次', function () { finish('again') }))
      row.appendChild(button('关闭', function () { finish('close') }))
    }, 'close').then(function (target) { navigate(target === 'close' && !isHistory ? 'home' : target) })
  }

  function saveFeedback(record, feedback) {
    var records = readRecords()
    if (!records) return false
    var stored = records.find(function (item) { return item && (record.id ? item.id === record.id : item.ts === record.ts) })
    if (!stored) { storageError(); return false }
    var updated = Object.assign({}, stored, { feedback: feedback })
    records[records.indexOf(stored)] = updated
    if (!writeRecords(records)) return false
    record.feedback = feedback
    record.saved = true
    return true
  }

  function retryRecord(record) {
    var records = readRecords()
    if (!records) return false
    if (!records.some(function (item) { return item && item.id === record.id })) {
      var persisted = Object.assign({}, record)
      delete persisted.saved
      records.push(persisted)
    }
    if (!writeRecords(records)) return false
    record.saved = true
    return true
  }

  function feedbackDialog(record, isHistory) {
    return dialog(isHistory ? '补填练后感受' : '一曲结束，感受如何？', '感受是你的主观记录，没有对错，也可以暂不评价。', function (panel, finish) {
      panel.appendChild(el('p', { className: 'xf-summary' }, summaryText(record)))
      var fieldset = el('fieldset', { className: 'xf-feelings' })
      fieldset.appendChild(el('legend', {}, '练后感受'))
      var selected = FEELINGS.indexOf(record.feedback) >= 0 ? record.feedback : '暂不评价'
      var advice = el('p', { className: 'xf-advice', role: 'status' })
      function updateAdvice() {
        advice.textContent = selected === '不舒服' ? '请停止练习并休息。如不适持续或加重，请寻求专业医疗帮助。' : ''
      }
      FEELINGS.forEach(function (feeling, index) {
        var label = el('label', { className: 'xf-option' })
        var input = el('input', { type: 'radio', name: 'xf-feeling', value: String(index) })
        input.checked = feeling === selected
        input.addEventListener('change', function () { selected = feeling; updateAdvice() })
        label.appendChild(input)
        label.appendChild(el('span', {}, feeling))
        fieldset.appendChild(label)
      })
      panel.appendChild(fieldset)
      panel.appendChild(advice)
      updateAdvice()
      panel.appendChild(el('p', { className: 'xf-local' }, '仅在本浏览器保存；清除浏览器数据或换浏览器会丢失记录。手动 / 演示计数不是准确识别，不生成评分。'))
      var status = el('p', { role: 'status' })
      panel.appendChild(status)
      var row = actions(panel)
      function save(target) {
        if (!record.saved && !retryRecord(record)) { status.textContent = '保存失败，请检查浏览器存储后重试。'; return }
        if (!saveFeedback(record, selected)) { status.textContent = '感受未保存，请重试。'; return }
        finish(target)
      }
      row.appendChild(button('保存后看总结', function () { save('summary') }, true))
      if (!isHistory) {
        row.appendChild(button('保存后看历史', function () { save('history') }))
        row.appendChild(button('保存后再练', function () { save('again') }))
      } else row.appendChild(button('取消', function () { finish('close') }))
    }, 'close').then(function (target) {
      if (target === 'summary') return summary(record, isHistory)
      navigate(target)
    })
  }

  function navigate(target) {
    if (!router) return
    if (target === 'history') router.push('/record')
    if (target === 'home') router.push('/')
    if (target === 'listen') router.push('/listen')
    if (target === 'again') {
      // 先回体验选择，离开训练会卸载旧相机和计时状态；再次进入仍须安全确认。
      router.push('/explore')
    }
  }

  function completed(record) {
    if (session) session.ended = true
    lastRecord = record
    window.dispatchEvent(new CustomEvent('xianyang:complete', { detail: record }))
  }

  function installRouter(instance) {
    router = instance
    router.beforeEach(async function (to, from) {
      if (from.path === '/train' && to.path !== '/train' && !(await leave())) return false
      if (to.path === '/train' && from.path !== '/train') {
        var accepted = await beforeTrain()
        return accepted ? true : from.matched.length ? false : '/'
      }
      return true
    })
    router.afterEach(function (to, from, failure) {
      if (!failure && to.path !== '/train') session = null
      if (!failure) queueEnhance()
    })
  }

  async function restart(proceed) {
    if (!(await beforeTrain())) { if (session && session.resume) session.resume(); return }
    if (!(await leave())) return
    proceed()
  }

  var queued = false
  function queueEnhance() {
    if (queued) return
    queued = true
    queueMicrotask(function () { queued = false; enhance() })
  }

  function enhance() {
    var app = document.getElementById('app')
    if (!app || !router || router.currentRoute.value.path !== '/record') return
    if (observer) observer.disconnect()
    try {
      var list = app.querySelector('.body.list')
      if (!list) return
      if (!app.querySelector('[data-xf-local]')) {
        var local = el('p', { className: 'xf-record-note', 'data-xf-local': 'true' }, '仅在本浏览器保存，最多保留最近 60 次。中途结束不算完整打卡；手动 / 演示进度不代表准确识别，不提供评分。旧记录未保存的时长、方式与感受不会推测补全。')
        list.insertBefore(local, list.firstChild)
      }
      var records = readRecords()
      if (!records) return
      app.querySelectorAll('.rec[data-flow-record]').forEach(function (card) {
        var key = card.getAttribute('data-flow-record')
        var record = records.find(function (item) { return item && String(item.id || item.ts) === key })
        if (!record) return
        var signature = JSON.stringify([record.durationMs, record.mode, record.feedback, record.completion, record.doneCount])
        var old = card.querySelector('[data-xf-details]')
        if (old && old.getAttribute('data-xf-signature') === signature) return
        if (old) old.remove()
        var details = el('div', { className: 'xf-record-details', 'data-xf-details': 'true', 'data-xf-signature': signature })
        details.appendChild(el('p', {}, (record.completion === 'partial' ? '中途结束 · ' : '') + summaryText(record)))
        details.appendChild(button('补填 / 修改感受', function () { feedbackDialog(Object.assign({}, record, { saved: true }), true) }))
        card.appendChild(details)
      })
    } finally {
      if (observer) observer.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-flow-record'] })
    }
  }

  window.XianyangFlow = {
    readRecords: readRecords,
    writeRecords: writeRecords,
    storageError: storageError,
    begin: begin,
    mark: mark,
    withMeta: withMeta,
    completed: completed,
    installRouter: installRouter,
    restart: restart,
    canAdvance: function () { return !!session && !session.ended && !pendingDialog },
    showLastSummary: function () {
      if (!lastRecord) return
      if (lastRecord.saved) summary(lastRecord)
      else feedbackDialog(lastRecord, false)
    }
  }

  window.addEventListener('xianyang:complete', function (event) { feedbackDialog(event.detail, false) })
  window.addEventListener('xianyang:records-changed', queueEnhance)
  window.addEventListener('storage', function (event) {
    if (event.key === KEY || event.key === null) {
      window.dispatchEvent(new CustomEvent('xianyang:records-changed'))
    }
  })
  document.addEventListener('DOMContentLoaded', function () {
    observer = new MutationObserver(queueEnhance)
    var app = document.getElementById('app')
    if (app) observer.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-flow-record'] })
    queueEnhance()
  })
})()
