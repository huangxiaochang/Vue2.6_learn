import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

initMixin(Vue) // 在Vue原型上定义_init方法
stateMixin(Vue) // 在Vue原型上定义$data,$props分别代理_data,_props,定义$set,$delete,$watch方法
eventsMixin(Vue) // 原型上定义$on，$emit,$once,$off方法
lifecycleMixin(Vue) // 原型上定义_update，$forceUpdate， $destroy
renderMixin(Vue) // 原型上定义$nextTick，_render

export default Vue
