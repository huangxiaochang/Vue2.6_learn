/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {
        // 如果没有传第二个参数，则返回对应id的全局相关的component/filter/directive
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        // 注册全局组件：使用Vue.extend方法来注册，返回的是子类构造函数
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
          definition = this.options._base.extend(definition)
        }
        // 注册指令时，规范化成拥有bind，update的方法
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        // 注册全局的component/filter/directive，即在在使用Vue.component等注册的全局组件、指令和过滤器，
        // 会添加到Vue.options中相应的对象的相应的属性中
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
