/* @flow */

import { isObject, isDef, hasSymbol } from 'core/util/index'

/**
 * Runtime helper for rendering v-for lists.
 */
export function renderList (
  val: any, // for指令中表达式，如：item in arr,则val为arr
  render: (
    val: any, // 列表中的每一项，如item
    keyOrIndex: string | number, // 列表迭代中的每一项的索引或者key
    index?: number
  ) => VNode // render为v-for标签及它孩子节点的render函数
): ?Array<VNode> {
  let ret: ?Array<VNode>, i, l, keys, key
  if (Array.isArray(val) || typeof val === 'string') {
    ret = new Array(val.length)
    for (i = 0, l = val.length; i < l; i++) {
      ret[i] = render(val[i], i)
    }
  } else if (typeof val === 'number') {
    ret = new Array(val)
    for (i = 0; i < val; i++) {
      ret[i] = render(i + 1, i)
    }
  } else if (isObject(val)) {
    if (hasSymbol && val[Symbol.iterator]) {
      // 如果定义了iterator遍历接口，则使用该遍历接口进行遍历
      ret = []
      const iterator: Iterator<any> = val[Symbol.iterator]()
      let result = iterator.next()
      while (!result.done) {
        ret.push(render(result.value, ret.length))
        result = iterator.next()
      }
    } else {
      // 遍历对象
      keys = Object.keys(val)
      ret = new Array(keys.length)
      for (i = 0, l = keys.length; i < l; i++) {
        key = keys[i]
        ret[i] = render(val[key], key, i)
      }
    }
  }
  if (!isDef(ret)) {
    ret = []
  }
  (ret: any)._isVList = true
  return ret
}
