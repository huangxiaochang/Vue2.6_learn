/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

// 初始化provide选项：在vm实例上定义一个_provided属性引用provide
export function initProvide (vm: Component) {
  const provide = vm.$options.provide
  if (provide) {
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

// 初始化inject: 解析获取inject定义的provide的值，然后再vm实例上定义同名的属性。
export function initInjections (vm: Component) {
  // 解析获取inject定义的provide的值
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    toggleObserving(false)
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          // 避免直接改变inject的值，因为当provide组件重渲染的时候，该值会被重写。
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        // 在组件实例上定义inject同名的属性，在定义之前，会先关掉观测，所以inject不是响应式的属性，
        // 不过如果provide本来就是响应式的，那么它也是响应式的。
        defineReactive(vm, key, result[key])
      }
    })
    toggleObserving(true)
  }
}

// 解析组件中的inject选项: 即从组件的所有父级中，找到第一个provide,并获取其中的值。如果没有找到，
// 并且提供了默认值，则使用默认值，否者错误提示。
export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    const result = Object.create(null)
    const keys = hasSymbol
      ? Reflect.ownKeys(inject)
      : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 in case the inject object is observed...
      if (key === '__ob__') continue
      const provideKey = inject[key].from
      let source = vm
      // 在该组件所有父级找到第一个provide,并获取key对应的值
      while (source) {
        if (source._provided && hasOwn(source._provided, provideKey)) {
          result[key] = source._provided[provideKey]
          break
        }
        source = source.$parent
      }
      if (!source) {
        // 如果没有找到并提供默认值，则使用默认值
        if ('default' in inject[key]) {
          const provideDefault = inject[key].default
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}
