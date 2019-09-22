/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    // 计算属性watcher，该值即为计算属性的getter。
    // renderWatcher时，为updateComponent函数
    expOrFn: string | Function, 
    cb: Function, // 计算属性该cb值为空
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      // vm实例的_watcher属性保存着渲染函数观察者
      vm._watcher = this
    }
    // 在vm实例设置_watchers属性收集该vm实例所有观察者
    vm._watchers.push(this)
    // options
    // 观察者配置项
    if (options) {
      this.deep = !!options.deep // 是否深度观测
      this.user = !!options.user // 是否是用户定义的依赖，一般开发者watch选项时，都为t该属性rue
      this.lazy = !!options.lazy // 计算属性观察者时，该值为true
      this.sync = !!options.sync // 是否同步求值
      // 可以理解为Watcher实例的钩子，当数据变化之后触发更新之前调用，对于渲染函数watcher有用
      this.before = options.before 
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = [] // 用于收集该watcher已经被加入的依赖收集筐
    this.newDeps = [] // 用于收集该watcher已经被新加入的依赖收集筐
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      // 计算属性时，expOrFn为函数
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 如果是计算属性，初始值为undefined
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   * 计算值，并且重新收集依赖
   */
  get () {
    // 设置Dep.target为当前观察者
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 进行求值，会触发相应式的getter，然后响应式属性就可以收集了改观察者依赖
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        // 进行深度依赖收集
        traverse(value)
      }
      popTarget()
      // 移除已经不存在的watcher
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   * 往依赖的响应式数据dep中添加自己，并且在自己的dep中收集该响应式的dep
   */
  addDep (dep: Dep) {
    const id = dep.id
    // 避免一次求值收集重复依赖
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      // 避免多次求值收集重复依赖
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   * 如：我们有v-if条件渲染，当我们满足条件渲染a模板时，访问a模板中数据，进行了依赖的收集，
      然后我们改变渲染的条件，去渲染b模板，会对b模板中依赖的数据进行依赖的收集，
      如果不进行失效依赖的移除的话，当我们去修改a模板中数据，会通知a数据的订阅的回调，这会造成浪费，
      所以在这里进行了无效依赖的移除。
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      // 响应式数据发生变化时，把dirty标记成true,表明下一次有访问该计算属性时，需要进行重新的求值。
      this.dirty = true
    } else if (this.sync) {
      // 进行同步求值
      this.run()
    } else {
      // 否则把观察者添加到异步队列，会在下一次事件循环中执行
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   * 该方法会在watcher队列中刷新watcher时被执行。
   * 正常情况下，会在下一次事件循环中执行。
   */
  run () {
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   * 这里只有计算属性才会调用该方法来进行求值。
   */
  evaluate () {
    this.value = this.get()
    // 把dirty设置成false，表明已经进行求值过
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   * 计算属性watcher会调用该方法，即会把依赖该计算属性的watcher添加到计算属性依赖的
   * 响应式数据的dep中。
   */
  depend () {
    // 因为在访问计算属性时，首先会调用watcher.evaluate()，这样计算属性watcher会添加进响应式属性的
    // dep中，同时也会在该计算属性watcher的dep属性中收集了响应式属性的dep。所以当调用watcher.depend()
    // 时，this.deps中的dep即为计算属性依赖的响应式属性的dep.
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   * 用于把该观察者从所有的依赖收集筐中移除
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}
