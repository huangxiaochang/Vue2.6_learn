/* @flow */

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import { genStaticKeys } from 'shared/util'
import { isUnaryTag, canBeLeftOpenTag } from './util'

export const baseOptions: CompilerOptions = {
  expectHTML: true,
  modules,
  directives,
  isPreTag, // 是否是pre标签
  isUnaryTag, // 是否是一元标签
  mustUseProp, // 必须使用prop绑定的属性，如input的value，checked属性,video的muted属性等等。
  canBeLeftOpenTag, // 是否是不用闭合的标签，如p,li,td,tr等等标签
  isReservedTag, // 是否是保留的标签。即所有的html。svg标签。
  getTagNamespace, // 标签的命名空间，svg,math
  staticKeys: genStaticKeys(modules) // staticStyle, staticClass
}
