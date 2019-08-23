# Vue的响应机制采用了观察者模式 + 数据劫持(Object.defineProperty() + 依赖收集筐)。


# 数据劫持(Object.defineProperty)
	对于纯对象和数组，采用不同的数据劫持方法：
	1.数组：
		1.首先创建一个由数组变异方法作为属性组成的对象(arrayMethods)，属性值为一个方法，在方法的内部会调用原生数组的方法求值，然后调用该数组的observer的notify通知数组的依赖。如果数组有新增项，则会把每一项定义成响应式属性。

		2.如果环境支持__proto__，则把该属性的原型__proto__指向数组方法对象arrayMethods。这样访问数组变异方法时，实际上访问的是数组方法对象arrayMethods上的同名属性，所以就可以进行依赖的通知。

		3.如果环境不支持__proto__,则会在改属性上定义数组变异方法同名的方法，这些方法就是对应的arrayMethods上的方法，这样访问数组变异方法时，实际上访问的是数组方法对象arrayMethods上的同名属性，所以就可以进行依赖的通知。

	2.对象：
		1.对于对象的每一个属性使用Object.defineProperty设置成存储器属性，即设置getter/setter拦截。
		2.在getter方法的内部会进行依赖的收集。
		3.在setter方法内会进行依赖的通知。
	
	响应式数据的定义(观测数据), 即观测vm._data属性:
		1.对于值为纯对象或者数组时，定义一个__ob__属性，该属性值为一个observer实例。
		2.对于对象的每一个属性，闭包引用着一个dep收集筐实例和子属性的__ob__(observer实例)。

		如果data选项为：
		{
			a: {
				c: {
					d: 1
				}
			},
			b: [
				{
					e: 2
				}
			],
		}
		则经过响应式定义以后，变成：
		{
			// a,b,c,d,e都闭包引用一个dep
			a: {
				c: {
					d: 1,
					__ob__:observer
				},
				__ob__: observer
			},
			b: [
				{
					e: 2,
					__ob__:observer
				},
				__ob__:observer
			],
			__ob__: observer
		}
		
		依赖的收集和通知：
		当我们访问a属性时，如this.a,会把依赖加入a闭包引用的dep收集筐中。同时会把依赖也加进a.__ob__.dep的收集
		筐中。
		当我们访问b属性时，如this.b,会把依赖加入b闭包引用的dep收集筐中。同时会把依赖收集进b的__ob__的dep中。
		当我们设置a属性时，this.a = 'xx',则会通知a闭包引用的dep中的依赖。
		当我们使用set来设置a属性时，如set(this.a, 'k', 'xxx'),则会通知a.__ob__.dep中的依赖。
		当我们设置b属性时，this.b = 'xx',则会通知b闭包引用的dep中的依赖。
		当我们调用数组变异方法设置b数组项时(使用set修改数组项时，本质上也是使用数组的变异方法)，如this.b.push('xxx'),则会通知b.__ob__.dep中的依赖。

# 观察者模式
	上面所说的依赖即为一个观察者(Watcher实例对象)。
	观察者watcher一般可分为：渲染函数观察者renderWatcher,计算属性观察者computedWatcher,watch观察者watchWatcher.
	