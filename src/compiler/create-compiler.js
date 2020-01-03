/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

// 创建编译器的类
export function createCompilerCreator (baseCompile: Function): Function { 
  return function createCompiler (baseOptions: CompilerOptions) {
    // 该方法作用为，把模板编译成render函数。主要的编译工作是有baseCompile函数来进行。
    // 该函数主要是为了合并编译的选项和一些编译错误的提示，同时调用baseCompile编译模板。
    function compile (
      template: string,
      options?: CompilerOptions // 平台的编译选项
    ): CompiledResult {
      const finalOptions = Object.create(baseOptions)
      const errors = []
      const tips = []

      let warn = (msg, range, tip) => {
        (tip ? tips : errors).push(msg)
      }

      // 合并平台编译的选项到基础的编译选项中
      if (options) {
        // outputSourceRange开发环境下为true,即是否输出错误信息获取提示信息的源位置
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          // $flow-disable-line
          const leadingSpaceLength = template.match(/^\s*/)[0].length

          warn = (msg, range, tip) => {
            const data: WarningMessage = { msg }
            if (range) {
              if (range.start != null) {
                data.start = range.start + leadingSpaceLength
              }
              if (range.end != null) {
                data.end = range.end + leadingSpaceLength
              }
            }
            (tip ? tips : errors).push(data)
          }
        }
        // merge custom modules
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // copy other options
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      finalOptions.warn = warn
      // 进行编译模板
      const compiled = baseCompile(template.trim(), finalOptions)

      if (process.env.NODE_ENV !== 'production') {
        detectErrors(compiled.ast, warn)
      }
      compiled.errors = errors
      compiled.tips = tips
      return compiled
    }

    return {
      compile,
      // createCompileToFunctionFn返回一个函数，该函数就是把模板编译成render的函数。
      // 因为不同平台，拥有不同的compile函数，所以这里使用了柯里化进行不同的预先传参.
      // 在$mount时，实际上是调用该compileToFunctions来得到render函数的
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
