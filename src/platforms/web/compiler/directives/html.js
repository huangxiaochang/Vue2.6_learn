/* @flow */

import { addProp } from 'compiler/helpers'

export default function html (el: ASTElement, dir: ASTDirective) {
  if (dir.value) {
  	// 在el的props属性中添加指令相关的属性
    addProp(el, 'innerHTML', `_s(${dir.value})`, dir)
  }
}
