/* @flow */

import { extend, warn, isObject } from 'core/util/index'

/**
 * Runtime helper for rendering <slot>
 * 生成slot标签内容的render代码
 */
export function renderSlot (
  name: string, // slot name
  fallback: ?Array<VNode>, // slot children, 即没有传递slotdom时，使用children作为渲染的内容
  props: ?Object, // 一般的属性
  bindObject: ?Object // 使用v-bind绑定的属性
): ?Array<VNode> {
  // 获取作用域插槽函数，该函数是在父组件中render代码生成时生成的
  const scopedSlotFn = this.$scopedSlots[name]
  let nodes
  if (scopedSlotFn) { // scoped slot
    // 如果是作用域插槽
    props = props || {}
    if (bindObject) {
      if (process.env.NODE_ENV !== 'production' && !isObject(bindObject)) {
        warn(
          'slot v-bind without argument expects an Object',
          this
        )
      }
      props = extend(extend({}, bindObject), props)
    }
    // 传入插槽的作用域props执行作用域插槽函数，得到作用域插槽vnode
    nodes = scopedSlotFn(props) || fallback
  } else {
    // 普通插槽的话，直接获取已经在父级中生成vnode或者默认的插槽dom
    nodes = this.$slots[name] || fallback
  }

  const target = props && props.slot
  if (target) {
    return this.$createElement('template', { slot: target }, nodes)
  } else {
    return nodes
  }
}
