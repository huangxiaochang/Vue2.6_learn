/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    // 合并options选项：内部组件的合并和动态options的合并做不同的逻辑，
    // 因为动态的options合并很慢并且内置组件的合并，需要一些特殊的处理。
    // options._isComponent标志会在创建子组件的vnode时添加，标记为这是Vue的组件(vdom/create-component)
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 内部组件的合并策略
      initInternalComponent(vm, options)
    } else {
      // 在下面的组件初始化中，会用到vm.$options属性
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor), // 获取构造函数上的options选项
        options || {},
        vm
      )
    }
    // 设置渲染函数的代理: 即代理到Vue实例的$data选项和全局属性和方法，这样当我们在模板中访问
    // 不存在的属性时，会给出友好的错误提示
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm) // 建立组件的父子关系和定义一些生命周期相关的属性
    initEvents(vm) // 定义收集组件自定义事件_events属性，和把组件的父监听器更新到组件中(收集到_events)
    initRender(vm) // 定义渲染函数相关的属性和方法，如$vnode，$slots，$scopedSlots，_c,$createElement,$attrs,$listeners
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm) // 初始化props,methods,data,computed,watch
    initProvide(vm) // resolve provide after data/props，在vm上定义_provided属性指向options.provide
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }
    // 创建子组件时，不传进el选项，所以子组件的挂载是自己接管的。会在组件vnode的init钩子中进行挂载。
    // (vdom/create-component.js)
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

// 子组件合并策略: 即把在子组件占位vnode上定义的propsData，listeners，children，tag等合并
// 到子组件的$options选项中
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent // 子组件的父组件vm
  opts._parentVnode = parentVnode // 子组件的占位vnode

  // componentOptions：子组件的一些选项，在创建子组件vnode时定义(vdom/create-component)。
  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData // 在子组件标签中v-bind的数据，在创建组件vnode时生成
  opts._parentListeners = vnodeComponentOptions.listeners // 在子组件标签中绑定的事件监听器
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

// 解析构造函数上的静态属性options选项:
// 一般为Vue构造函数的options,即全局的混入，组件，指令，过滤器等的配置项。
// 因为子类也实现了相关的注册方法，所以如果使用了子类的相关方法进行注册了混入，组件，指令，
// 过滤器等，那么调用该子类去实例化时，这些注册的内容也会在options选项中进行合并。
export function resolveConstructorOptions (Ctor: Class<Component>) {
  // Vue或者子类Sub上的options静态属性，定义在global-api,即Vue内置的组件，指令，过滤器等选项
  let options = Ctor.options
  // 只有是子类Sub时，才会执行if内代码
  if (Ctor.super) {
    // 递归获取父级构造函数的
    const superOptions = resolveConstructorOptions(Ctor.super)
    // 获取子类构造函数上缓存的父级的options选项
    const cachedSuperOptions = Ctor.superOptions
    // 如果父级的options发生了变化，则需要解析新的options
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
