/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools,
  inBrowser,
  isIE
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
// 用来存储激活的keep-alive组件
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * Reset the scheduler's state.
 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

// Async edge case #6566 requires saving the timestamp when event listeners are
// attached. However, calling performance.now() has a perf overhead especially
// if the page has thousands of event listeners. Instead, we take a timestamp
// every time the scheduler flushes and use that for all event listeners
// attached during that flush.
// 保存当前的异步队列刷新的时间戳，因为解决一些异步边缘情况(bug6566)需要用到，
// 当添加事件监听器时。然而，调用performance.now api 会造成高的性能开销，特别是页面中拥有成千上万
// 的事件监听器的时候。所以我们在每次队列刷新时，使用一个时间戳来记录开始刷新的时间，然后在队列
// 刷新时添加事件监听器时会用到。
export let currentFlushTimestamp = 0

// Async edge case fix requires storing an event listener's attach timestamp.
// 存储事件监听器添加时的时间戳
let getNow: () => number = Date.now

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
// All IE versions use low-res event timestamps, and have problematic clock
// implementations (#9632)
// 根据不同的浏览器，选择不同的时间戳记录方式
if (inBrowser && !isIE) {
  const performance = window.performance
  if (
    performance &&
    typeof performance.now === 'function' &&
    getNow() > document.createEvent('Event').timeStamp
  ) {
    // if the event timestamp, although evaluated AFTER the Date.now(), is
    // smaller than it, it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listener timestamps as
    // well.
    getNow = () => performance.now()
  }
}

/**
 * Flush both queues and run the watchers.
 */
function flushSchedulerQueue () {
  // 记录队列开始刷新时的时间戳
  currentFlushTimestamp = getNow()
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  // 对队列进行排序，是为了：
  // 1.组件的更新是从父到子，因为父组件是先于子组件创建(不是挂载，是创建),所以子组件的renderid比父组件大
  // 2.组件的user watcher先于render watcher执行，因为在组件初始化时，user watcher是先于render watcher创建的
  // 3.如果一个组件的销毁是在父组件的watcher 执行时，那么它的watcher应该被跳过。
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  // 这里不缓存queue的长度，因为可能在执行现有的watcher的时候，还会有新的watcher被添加进来
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    // 执行watcher的before钩子，渲染函数watcher存在before选项，会在before钩子中，当组件已经挂载过时，
    // 调用beforeUpdate生命周期钩子函数。
    if (watcher.before) {
      watcher.before()
    }
    id = watcher.id
    has[id] = null
    // 执行watcher获取变化后的值，然后执行相应的回调，如更新视图，执行watch开发者回调等。
    watcher.run()
    // in dev build, check and stop circular updates.
    // 因为在上面执行watcher.run()前，已经has[id] = null，所以如果在watcher.run()再添加进队列，
    // ，此时has[id] != null，则是循环调用
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  // 重置异步更新队列的成初始化状态
  resetSchedulerState()

  // call component updated and activated hooks
  // 执行组件的actived钩子函数（keep-alive的组件）
  callActivatedHooks(activatedQueue)
  // 执行重新render的组件vm的updated生命钩子函数
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

// 执行rerender的组件的updated钩子函数
function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    // vm._watcher保存着渲染函数watcher
    if (vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 * 排队在patch过程中激活的keep-alive组件，该队列会在整个dom树patch完成后得到处理,
 * 处理的操作即为执行keep-alive组件的updated和activated钩子函数
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  // 把_inactive设置成false(激活状态)，这样渲染函数的执行就会依赖检查它是否处于失活的tree上。
  vm._inactive = false
  activatedChildren.push(vm)
}

// 执行keep-alive组件的updated和activated钩子函数
function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 * 这里添加的watcher一般为render watcher和异步的user watcher(watch watcher)
 */
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  if (has[id] == null) {
    // 避免收集重复watcher
    has[id] = true
    if (!flushing) {
      queue.push(watcher)
    } else {
      // 正在刷新队列
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      // 根据id把该watcher加入队列中相应的位置，如果错过它，那么会加到目前正在update的
      // watcher的后面，这样它会在下一个update时，立马得着update
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    // 保证在同一次事件循环中多次调用queueWatcher时，只执行if内代码一次
    if (!waiting) {
      waiting = true

      if (process.env.NODE_ENV !== 'production' && !config.async) {
        // 同步更新只在生产环境有效
        flushSchedulerQueue()
        return
      }
      nextTick(flushSchedulerQueue)
    }
  }
}
