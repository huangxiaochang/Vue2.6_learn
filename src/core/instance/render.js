/* @flow */

import {
  warn,
  nextTick,
  emptyObject,
  handleError,
  defineReactive
} from '../util/index'

import { createElement } from '../vdom/create-element'
import { installRenderHelpers } from './render-helpers/index'
import { resolveSlots } from './render-helpers/resolve-slots'
import { normalizeScopedSlots } from '../vdom/helpers/normalize-scoped-slots'
import VNode, { createEmptyVNode } from '../vdom/vnode'

import { isUpdatingChildComponent } from './lifecycle'

// 定义与渲染相关的属性和方法：如$slots，$scopedSlots，$createElement，_c等
export function initRender (vm: Component) {
  vm._vnode = null // the root of the child tree
  vm._staticTrees = null // v-once cached trees
  const options = vm.$options
  // 添加$vnode，$slots，$scopedSlots属性到组件实例vm上
  const parentVnode = vm.$vnode = options._parentVnode // the placeholder node in parent tree
  const renderContext = parentVnode && parentVnode.context
  // renderContext 父组件vm, _renderChildren来源子组件初始化合并选项时的占位vnode的componentOptions
  // 属性，在创建组件占位vnode时，把children作为了vnode中componentOptions属性的属性
  vm.$slots = resolveSlots(options._renderChildren, renderContext)
  vm.$scopedSlots = emptyObject
  // bind the createElement fn to this instance
  // so that we get proper render context inside it.
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates
  // 经过模板编译的render函数时
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // normalization is always applied for the public version, used in
  // user-written render functions.
  // 开发者自己定义的render函数时
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  // $attrs & $listeners are exposed for easier HOC creation.
  // they need to be reactive so that HOCs using them are always updated
  const parentData = parentVnode && parentVnode.data

  // 定义响应式属性$attrs, $listeners
  /* istanbul ignore else */
  if (process.env.NODE_ENV !== 'production') {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
      // isUpdatingChildComponent在更新组件时设置为true，因为更新组件时，会更新该属性，所以不需要提示
      !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
    }, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
    }, true)
  } else {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
  }
}

export let currentRenderingInstance: Component | null = null

// for testing only
export function setCurrentRenderingInstance (vm: Component) {
  currentRenderingInstance = vm
}

export function renderMixin (Vue: Class<Component>) {
  // install runtime convenience helpers
  // 安装一些渲染函数的中用到的帮助函数，如渲染列表，slot,toString的方法等。
  installRenderHelpers(Vue.prototype)

  Vue.prototype.$nextTick = function (fn: Function) {
    return nextTick(fn, this)
  }

  Vue.prototype._render = function (): VNode {
    const vm: Component = this
    const { render, _parentVnode } = vm.$options

    if (_parentVnode) {
      // 处理作用域插槽，并定义实例上的$scopedSlots属性。该属性会在组件render中被用到。
      // 该属性为插槽名为键，函数为值的对象，执行相应的函数，会得到插槽中相应的vnode
      vm.$scopedSlots = normalizeScopedSlots(
        _parentVnode.data.scopedSlots,
        vm.$slots,
        vm.$scopedSlots
      )
    }

    // set parent vnode. this allows render functions to have access
    // to the data on the placeholder node.
    // 设置组件的$vnode指向父级组件占位的vnode，这样子组件就可以拿到子组件占位node的data
    vm.$vnode = _parentVnode
    // render self
    let vnode
    try {
      // There's no need to maintain a stack because all render fns are called
      // separately from one another. Nested component's render fns are called
      // when parent component is patched.
      // 在这里不需要维护一个栈，因为所有的渲染函数调用时相互分离的。嵌套组件渲染函数会在
      // 父组件patch过程中被调用。
      currentRenderingInstance = vm
      // 调用render渲染函数返回vnode,执行render时，会触发模板中响应式数据属性的getter，从而
      // 进行了render watcher的收集
      vnode = render.call(vm._renderProxy, vm.$createElement)
    } catch (e) {
      // 处理执行渲染函数过程中的报错
      handleError(e, vm, `render`)
      // return error render result,
      // or previous vnode to prevent render error causing blank component
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production' && vm.$options.renderError) {
        try {
          vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
        } catch (e) {
          handleError(e, vm, `renderError`)
          vnode = vm._vnode
        }
      } else {
        vnode = vm._vnode
      }
    } finally {
      currentRenderingInstance = null
    }
    // if the returned array contains only a single node, allow it
    if (Array.isArray(vnode) && vnode.length === 1) {
      vnode = vnode[0]
    }
    // return empty vnode in case the render function errored out
    if (!(vnode instanceof VNode)) {
      if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
        warn(
          'Multiple root nodes returned from render function. Render function ' +
          'should return a single root node.',
          vm
        )
      }
      // 空的vnode,即vnode的属性一般都是undefined，或者空数组，false等值。
      vnode = createEmptyVNode()
    }
    // set parent
    // 在这里，vnode的parent，$vnode属性都指向了_parentVnode
    vnode.parent = _parentVnode
    return vnode
  }
}
