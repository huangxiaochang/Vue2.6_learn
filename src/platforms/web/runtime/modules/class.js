/* @flow */

import {
  isDef,
  isUndef
} from 'shared/util'

import {
  concat,
  stringifyClass,
  genClassForVnode
} from 'web/util/index'

function updateClass (oldVnode: any, vnode: any) {
  const el = vnode.elm
  const data: VNodeData = vnode.data
  const oldData: VNodeData = oldVnode.data
  if (
    isUndef(data.staticClass) &&
    isUndef(data.class) && (
      isUndef(oldData) || (
        isUndef(oldData.staticClass) &&
        isUndef(oldData.class)
      )
    )
  ) {
    // 没有使用class时，直接返回
    return
  }
  // 生成vnode节点的class属性，会合并组件的class属性和处理数组或者纯对象形式成字符串形式
  let cls = genClassForVnode(vnode)

  // handle transition classes
  // 处理应用了 transition 的class属性
  const transitionClass = el._transitionClasses
  if (isDef(transitionClass)) {
    cls = concat(cls, stringifyClass(transitionClass))
  }

  // set the class
  // 如果标签上的class不相同，则更新标签上的class属性
  if (cls !== el._prevClass) {
    el.setAttribute('class', cls)
    el._prevClass = cls
  }
}

// 会在vnode创建或者更新成真实dom节点时，为该Dom添加上class属性
export default {
  create: updateClass,
  update: updateClass
}
