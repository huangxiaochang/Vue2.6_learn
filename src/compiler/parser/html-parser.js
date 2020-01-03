/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson (MPL-1.1 OR Apache-2.0 OR GPL-2.0-or-later)
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeRegExp } from 'core/util/lang'

// Regular Expressions for parsing tags and attributes
// 匹配标签的属性 即匹配 xx xx="xx" xx='' xx=xx, 其中xx为[^\s"'=<>`]+
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// 匹配动态参数属性，即 v-aa:[xx]xx = "xx" v-aa:[xx]xx = xx :[xx]xx = "xx" @[xx]xx = "xx"
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// 匹配不包含前缀的xml标签名称
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
// 匹配标签名称
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
// 匹配开始标签
const startTagOpen = new RegExp(`^<${qnameCapture}`)
// 匹配开始标签的闭合字符: > 或者 />
const startTagClose = /^\s*(\/?)>/
// 匹配结束标签
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
// 匹配文档的DOCTYPE标签
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being passed as HTML comment when inlined in page
// 匹配注释节点
const comment = /^<!\--/
// 匹配条件注释节点
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
// 检查是否是纯文本标签
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

// 用于解码html实体
function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

export function parseHTML (html, options) {
  // 用来判断匹配标签对
  const stack = []

  const expectHTML = options.expectHTML
  // 检测是否是一元标签
  const isUnaryTag = options.isUnaryTag || no
  // 用来检测一个标签是否可以省略闭合标签的非一元标签
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    // 确保解析的内容不是在纯文本标签内
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      if (textEnd === 0) {
        // Comment:
        // 有可能是条件注释节点
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            if (options.shouldKeepComment) {
              // 如果需要保留注释节点，那么获取注释节点中的内容并进行处理（不包含注释节点的开始和结束标签）
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        // 可能是条件注释节点，如果是，简单跳过，即忽略
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            // 对于条件注释节点，只是单纯从html字符串中剔除，并没有相应的处理，则说明Vue模板永远不会
            // 保留条件注释节点的内容
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        // 有可能是doctype标签，如果是，简单的跳过，即忽略
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          // vue同样不会保留doctype标签的内容，只是简单从html字符串中剔除
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag: 有可能是结束标签
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          // endTagMatch[0]匹配的整个结束标签
          advance(endTagMatch[0].length)
          // 解析结束标签，endTagMatch[1]标签名
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag: 是开始标签
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          // 处理开始标签解析的结果
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next

      if (textEnd >= 0) {
        // 截取<后面的字符串
        rest = html.slice(textEnd)

        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // 截取后的字符串不能匹配到标签的情况下，说明<存在于普通的文本中
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        text = html.substring(0, textEnd)
      }

      if (textEnd < 0) {
        // 将整个html字符串作为文本处理
        text = html
      }

      if (text) {
        advance(text.length)
      }

      if (options.chars && text) {
        // 处理普通字符串
        options.chars(text, index - text.length, index)
      }
    } else {
      // 要解析的内容在纯文本标签内
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      // 匹配纯文本内容和纯文本结束标签
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          // 纯文本标签中的内容会当成纯文本对待
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }
    // 将整个字符串作为文本对待，html已经解析完成
    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()
  // 将已经解析完毕的字符串从html中剔除
  function advance (n) {
    index += n
    html = html.substring(n)
  }

  // 解析开始标签，返回标签名，属性集合等信息
  function parseStartTag () {
    const start = html.match(startTagOpen)
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      // 解析开始标签中的属性
      while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
        attr.start = index
        advance(attr[0].length)
        attr.end = index
        match.attrs.push(attr)
      }
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  // 处理开始标签解析的结果
  function handleStartTag (match) {
    const tagName = match.tagName // 开始标签的标签名
    const unarySlash = match.unarySlash // 为'/'或者undefined

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    // 是否是一元标签
    const unary = isUnaryTag(tagName) || !!unarySlash
    // 处理开始标签中的属性，即进行格式化match.attrs,并将格式化后的数据存储到常量attrs中，格式化：
    // 1.格式化后数据只包含name和value两个字段
    // 2.对属性值进行html实体解码
    const l = match.attrs.length
    const attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      const value = args[3] || args[4] || args[5] || ''
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }
    // 如果不是一元标签，则加入到栈中
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })
      lastTag = tagName
    }

    if (options.start) {
      // 处理开始标签
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  // 解析结束标签：
  // 1.检查是否缺少闭合标签
  // 2.处理stack中剩余的标签
  // 3.解析</br>,</p>标签，与浏览器行为相同
  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`,
            { start: stack[i].start, end: stack[i].end }
          )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
