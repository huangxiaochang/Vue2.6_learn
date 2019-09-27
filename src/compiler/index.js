/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions // 平台相关的编译选项和基础编译选项
): CompiledResult {
  // 主要的编译工作由该函数进行
  
  // 解析模板，生成模板的ast树，ast树中的节点是一个js对象，该对象描述了节点的相关信息
  const ast = parse(template.trim(), options)

  if (options.optimize !== false) {
    // 优化生成的ast树，即标记静态节点和静态根节点，因为静态的节点生成的dom不需要改变
    optimize(ast, options)
  }

  // 由模板的ast树生成render函数的函数体代码,
  // 使用new Function来创建函数，在函数内部使用with来绑定执行的数据代理
  const code = generate(ast, options)

  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
