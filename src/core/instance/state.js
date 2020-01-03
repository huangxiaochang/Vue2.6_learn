/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

// 在target上定义与key同名的属性，访问该属性时，代理成访问sourceKey上的同名属性
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  // 用来收集该组件实例的所有的watcher对象
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

// 初始化props选项：把props选项的属性定义到vm实例的_props属性上，并设置这些属性成响应式属性。
// 同时在vm实例上定义_props代理，即访问vm与_props同名属性时，实际访问的是vm_props同名属性。
function initProps (vm: Component, propsOptions: Object) {
  // $options.propsData存储着外界传递进来的props的值。$options.propsData属性是在_init合并子组件
  // options时定义，合并时的来源组件占位vnode的componentOptions，componentOptions是生成vnode时提供，
  // 而其中的propsData是在模板解析代码生成时提供的，即解析组件占位标签上的属性得来
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  // 缓存prop的key,这样在未来props更新的时候，可以使用数组来遍历而不是使用动态对象键的枚举遍历。
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    // 不把props的值转换成响应式的数据，注意：该属性是响应的，只是它的值不是相应的
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    // prop的数据是否符合预期的类型
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      // prop 键的有效性检查，把key转换成连字符加小写的形式
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      // 定义_props成响应式属性，但是它的值的响应性依赖提供的值本来的响应性
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    // 只有key不在实例对象上以及它的原型上时，才进行代理，这个一个针对子组件的优化，因为子组件来说，
    // 这个代理工作是在创建子组件构造函数时就完成了。这样有助提升性能
    if (!(key in vm)) {
      // 代理_props
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

// 初始化data选项：把data选项的属性定义到vm实例的_data属性上，同时在vm定义代理，即访问vm上与data
// 选项同名属性，实际访问的是vm的_data上的同名属性。然后再观测_data，即转换成响应式属性。
function initData (vm: Component) {
  let data = vm.$options.data
  // 合并的时候，data选项最终都会被规范化成一个函数，因为可能在beforeCreate钩子中改变它，所以此处
  // 进行了判断
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  // 最终的data选项要是一个纯对象
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  // 遍历data选项中所有的属性进行名称冲突判断和设置代理
  while (i--) {
    const key = keys[i]
    // 属性不能和method同名
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    // 属性不能和prop同名
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      // 设置_data代理，只代理不是$,_开头的属性，即非内部的属性。
      // 即访问vm[key] -> vm._data[key],这也就是我们可以在this.xxx访问this._data.xxx的原因
      proxy(vm, `_data`, key)
    }
  }
  // 观测数据，即把_data转换成响应式
  // observe data: _data
  observe(data, true /* asRootData */)
}

// 执行data选项函数，获取真正data对象
export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  // 防止使用props初始化data时收集冗余的依赖,因为在初始化的时候，此时的Dep.target会为父组件的
  // render watcher，这样当在data选项中使用prop,inject时，会把父组件的render watcher收集到prop,
  // inject等的dep中
  pushTarget()
  try {
    // data函数的执行上下文为组件实例对象vm
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

// 初始化计算属性：为计算属性创建一个watcher观察者,并在vm上定义_computedWatchers属性
// 来存储所有的计算属性的观察者。
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  // 定义_computedWatchers属性收集该组件实例宿友的计算属性观察者
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 为每一个计算属性创建一个观察者
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      // 定义一个计算属性，即在组件vm实例对象上，定义一个同名的属性，并且该属性是一个访问器属性(定义了getter/setter)
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      // 计算属性键不能与data,props选项键同名
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

// 定义一个计算属性：即在vm上定义与计算属性同名的属性，并且该属性设置了getter。
// 该getter内部会调用计算属性watcher进行惰性求值和通知依赖，并返回计算属性的值。
export function defineComputed (
  target: any, // one case may be vm
  key: string,
  userDef: Object | Function
) {
  // 只有在非服务器端渲染才会缓存计算属性
  const shouldCache = !isServerRendering()

  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    // 在没有定义计算属性set的时候，尝试修改计算属性的值时，会进行错误提示
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  // 在vm上定义计算属性同名的存储器属性
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 创建计算属性的getter：返回一个函数，调用该函数时，计算属性观察者会进行求值和通知依赖，然后返回
// 计算属性的值
function createComputedGetter (key) {
  // 访问计算属性时，会调用该函数
  return function computedGetter () {
    // 计算属性观察者
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      // watcher.dirty首次为true或者每次响应式数据变化时也会设置成true
      if (watcher.dirty) {
        // 计算属性求值,只会在首次访问该计算属性或者响应式数据变化之后才会进行重新求值。
        watcher.evaluate()
      }
      if (Dep.target) {
        // 收集依赖计算属性的依赖，如renderWatcher。因为如果在渲染函数中访问计算属性时，
        // 此时的Dep.target即为renderWatcher
        watcher.depend()
      }
      // 返回计算属性的值，watcher.dirty为false时，返回的是上一次计算的值
      return watcher.value
    }
  }
}

function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}

// 初始化methods选项：在vm实例上定义metho同名属性，并绑定执行上下文为vm实例。
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      // method只能是函数
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      // 不能和prop同名
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      // 不能以$,_框架内部保留字符开头
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

// 初始化watch选项：为每一个watch属性创建一个watcher实例
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

// 创建watcher: 调用vm.$watch方法返回一个watcher
function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    // watch的处理函数可以是一个method
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  // 用于创建一个观察者watcher
  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true // 代表是开发者watch选项，或者使用$watch创建的观察者
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) {
      try {
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
