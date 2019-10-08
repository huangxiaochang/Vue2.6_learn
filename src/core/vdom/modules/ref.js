/* @flow */

import { remove, isDef } from 'shared/util'

export default {
  create (_: any, vnode: VNodeWithData) {
    registerRef(vnode)
  },
  update (oldVnode: VNodeWithData, vnode: VNodeWithData) {
    if (oldVnode.data.ref !== vnode.data.ref) {
      // 移除旧的ref
      registerRef(oldVnode, true)
      // 添加新的ref
      registerRef(vnode)
    }
  },
  destroy (vnode: VNodeWithData) {
    // 移除ref
    registerRef(vnode, true)
  }
}

export function registerRef (vnode: VNodeWithData, isRemoval: ?boolean) {
  // 在vnode的创建的时候，会把标签上的ref属性作为vnode.data.ref属性
  const key = vnode.data.ref
  if (!isDef(key)) return

  const vm = vnode.context
  // ref绑定在组件上时，为组件实例对象，否者为绑定的元素
  const ref = vnode.componentInstance || vnode.elm
  const refs = vm.$refs
  // 在组件vm实例对象上定义refs属性，指向ref绑定的值
  if (isRemoval) {
    if (Array.isArray(refs[key])) {
      remove(refs[key], ref)
    } else if (refs[key] === ref) {
      refs[key] = undefined
    }
  } else {
    if (vnode.data.refInFor) {
      if (!Array.isArray(refs[key])) {
        refs[key] = [ref]
      } else if (refs[key].indexOf(ref) < 0) {
        // $flow-disable-line
        refs[key].push(ref)
      }
    } else {
      refs[key] = ref
    }
  }
}
