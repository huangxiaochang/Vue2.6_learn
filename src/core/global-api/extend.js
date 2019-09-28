/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

export function initExtend (Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   * 用于创建一个Vue的子类。即子组件。
   * 创建子组件的方式见：vdom/create-component.js
   */
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {}
    const Super = this
    const SuperId = Super.cid
    // 缓存
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    // 组件名字有效性检查
    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name)
    }

    // 子类的构造函数
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // 子类原型指向父类原型
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub

    Sub.cid = cid++
    // 子类的options：父类的options和子类的extendOptions合并
    Sub.options = mergeOptions(
      Super.options, // componets, filters, directives, base等
      extendOptions
    )
    // 设置静态属性super指向父类
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    // 我们在拓展子类的时候，对于props和计算属性，我们在Vue的实例上定义了代理getter。
    // 这样可以避免在每个实例创建的时候都会调用Object.defineProperty方法
    if (Sub.options.props) {
      // 定义_props属性代理
      initProps(Sub)
    }
    if (Sub.options.computed) {
      // 定义计算属性的getter代理
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    // 定义子类的extend/mixin/use静态方法
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    // 定义子类的component,filter,directive静态方法
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    // 递归子查找，循环组件有用
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    // 保存父类的options选项，在子类实例化的时候，会检查父类的options是否已经改变
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

// 在子类的原型上定义_props属性代理子类props的同名属性
function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

// 定义计算属性的getter代理
function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
