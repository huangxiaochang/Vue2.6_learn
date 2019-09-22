/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
export function traverse (val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  const isA = Array.isArray(val)
  // 只对数组或者纯对象，并且不是冻结或者vnode对象进行深度观测
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  // 解决循环引用导致死循环
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      // 如果已经进行了观测，则直接返回
      return
    }
    seen.add(depId)
  }
  if (isA) {
    // 如果是数组，则对数组每一项进行深度观测
    i = val.length
    // val[i]时，即读取子属性，这将触发子属性的getter，从而进行依赖的收集
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    // val[keys[i]]时，会触发getter，从而收集依赖
    while (i--) _traverse(val[keys[i]], seen)
  }
}
