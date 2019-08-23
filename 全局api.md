# 在核心Vue构建时，定义了一些全局api，即在Vue的构造函数上定义了一些静态的方法：

#1. Vue.set(target,pro, value): 
		用于设置响应式目标的属性：
		1.如果设置的是数组项，则使用数组的splice方法来设置，这样既可触发依赖。
		2.如果设置的是已经存在的对象属性，则直接赋值，也可以触发依赖。
		3.如果设置的是对象中还没有的属性，则把它设置成响应式的属性，并且手动通知依赖。

#2. Vue.delete(target,prop):
		用于删除响应式对象的属性
		1.如果删除的是数组的项，则使用数组的splice来删除，这样可以触发依赖通知。
		2.如果删除的是纯对象的属性，则使用delete删除，然后手动触发依赖通知。

#3. Vue.nextTick(cb:function):
		1.Vue在更新dom的时候，是异步执行的。只要监听到数据变化，Vue将会开启一个队列，会把在同一个
		事件循环中的数据变更的更新的同一个watcher只推入队列一次，然后会在下一次的事件循环中进行更新。
		2.6版本的Vue在内部对于异步队列，会尝试按照以下顺序来实现：原生的Promise.then,MutationObserver(IE),
		setImmediate,setTimeout。
		2.同时，对于在同一事件循环中多次调用nextTick时，会把所有的回调压成一个同步任务，在下一次事件循环中执行
		，而不是开启多个异步队列。

#4. Vue.observable(object):
		1.2.6新增的api, 作用： 让一个对象变成可响应的。

#5. 定义Vue.options.components/filters/directives。并把内置组件keep-alive混入Vue.options.components

#6. Vue.use(plugin):
		用于注册Vue的插件, 原理：
		把Vue作为参数调用插件的install方法(插件为对象时，必须要实现改方法)
		或者如果传给use方法是一个函数时，把Vue作为参数直接调用该函数

#7. Vue.mixin(object)：
		用于全局混入
		1.使用相应的合并策略，把Vue.mixin参数options和合并到Vue.options中。
		2.因为在使用Vue.extend创建子类的时候，会把Vue.options合并到子类的options选项，所以在子类中
		也可以或者到这些全局的mixin。

#8. Vue.extend(options)：
		用于创建一个Vue的子类，即子组件。原理：
		1.首先如果有缓存，即返回缓存的结果。
		2.子类继承父类，采用的是组合寄生式继承，即在子类构造函数内调用父类的_init方法，子类的原型指向父类的原型
		3.进行组件名字有效性检查，合并父类的options到子类的options，所以我们能够在组件中使用全局的组件，指令，过滤器等。
		4.子类extend/use/mixin/componetn/filter/directive引用父类的相应方法。所以子类也可以使用这些静态方法。
		5.初始化prop，计算属性：即定义他们的getter代理，这样可以避免在每一个实例创建的时候，都会调用Object.defineProperty方法。

#9. Vue.component/filter/directive(id,[definition]):
		用于注册全局的组件，过滤器，指令。原理：
		1.使用这样方法来注册全局组件，过滤器，指令时，即在Vue.options.components/filters/directives上定义相应
		组件、过滤器和指令。
		2.因为在子组件创建的时候，会合并Vue上的options选项，所以就可以在组件中使用全局的组件、过滤器和指令。
