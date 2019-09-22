/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    // 使用Object.definProperty在value上定义__ob__为数据属性，同时设置为不可遍历
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      // 进行数组的响应式定义
      if (hasProto) {
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 观测数组的每一项
      this.observeArray(value)
    } else {
      // 进行对象的响应式定义
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   * 定义对象成响应式
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      // 把对象的每个属性设置gettter/setter
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   * 观测数组的每一项
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * 该方法主要用于观测一个数据：即会为值创建一个observer实例（值的__ob__属性指向了observer实例）。
 * 并且对属性设置getter/setter拦截。
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    // 如果已经观测
    ob = value.__ob__
  } else if (
    shouldObserve && // 该值希望呗观测
    !isServerRendering() && // 不是服务器端渲染
    (Array.isArray(value) || isPlainObject(value)) && // 为数组或者纯对象
    Object.isExtensible(value) && // 数据对象必须为可拓展, Object.preventExtensions/freeze/seal可设置成不可拓展
    !value._isVue // 避免Vue实例对象被观测
  ) {
    // 否则如果希望数据被观测，是数组或者对象，并且是可拓展时，同时不是Vue实例时，则创建一个observer
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    // 如果是根数据
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 * 定义对象的响应式属性，即为对象的每一个属性设置getter、setter拦截
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean // 是否深度观测，默认为true
) {
  const dep = new Dep()

  // 如果该属性不可配置，直接返回
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 保存属性本来的getter/setter
  const getter = property && property.get
  const setter = property && property.set
  // 保证定义响应式数据时行为的一致性
  // 1.如果数据对象的某个属性原本拥有自己的getter函数，那么这个属性不会被深度观测
  // 2.当属性拥有setter时，要进行取值，进行深度观测
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  // 需要深度观测时，先深度观测该属性的值。顺序为先子后父。
  // 深度观测的条件：
  //  1.shallow=false,即希望深度观测
  //  2.val不为undefined，即要触发上面val = obj[key]取值操作
  let childOb = !shallow && observe(val)

  // 把该对象的该属性设置成存取性属性，即设置getter/setter拦截。
  // 如果key对应的值是一个数组，那么使用数组的方法时，也会触发getter.如：this.arr.push()
  // 会触发arr属性的getter。
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        dep.depend()
        // 如果该属性值是一个响应式数据（数组/对象），则把watcher添加到该属性值的__ob__.dep中，
        // 这里也是为了使用$set/$del设置该属性值时，也能触发依赖
        if (childOb) {
          // 把该属性的该依赖加入到属性值的依赖收集筐中(__ob__)，这样属性值发生变化时，该属性的依赖也会得到通知
          childOb.dep.depend()
          if (Array.isArray(value)) {
            // 如果属性值是数组的话，把数组依赖加进数组项的依赖框中，这样数组项变化时，数组的依赖
            // 也会得到通知
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // 只有值前后不相等时，才会触发通知依赖,(newVal !== newVal && value !== value)判断NaN
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        // 打印一些辅助信息，如不可set等
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 * 用于在对象上设置一个属性，如果该属性还没有存在，则会设置成响应式属性并且触发依赖通知
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // 设置数组的长度，因为当key的长度大于数组原本的长度时，splice会无效
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    // 如果原本就是不响应的，则简单的赋值，然后返回，并没有触发通知依赖
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 * 用来删除对象的属性，并且触发依赖通知
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 * 把数组的依赖增加到数组项的依赖框中，这样当数组项发生变化时，数组的依赖也可以得到更新
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
