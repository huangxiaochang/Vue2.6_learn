/* @flow */

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'

// createCompiler函数：create-compiler返回的函数。用于创建一个编译器
// 调用compileToFunctions方法可以返回render函数
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
