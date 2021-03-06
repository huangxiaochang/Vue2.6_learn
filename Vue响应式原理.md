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
			// a,c,b都闭包引用一个childOb属性，分别指向a.__ob__,b.__ob__,b.__ob__
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
	1.观察者watcher一般可分为：渲染函数观察者renderWatcher,计算属性观察者computedWatcher,watch观察者watchWatcher.

	2.观察者的作用只要是在响应式属性中添加依赖，和响应式数据发生变化时，进行依赖的更新。即是一种view层和model层的中间桥梁。watcher的deps收集着依赖的响应式属性的dep,所以当watcher不再依赖该属性时，只需要从相应属性的
	dep中移除自己即可达到以数据的脱离。

	3.watcher的更新一般会放在一个watcher队列中，会在下一次的事件循环中进行更新操作（即执行watcher.run方法进行重新求值和执行相应的回调），并且在同一次事件循环中，同一个watcher只会加入队列一次。

	4.避免重复添加watcher和响应式属性dep收集无效watcher的方法：
		在watcher中维护两个属性deps和newDeps,deps收集的值前一次依赖的响应式dep，newDeps收集的是当前的响应式dep,
		只需对比deps和newDeps即可找出watcher不再依赖的属性，然后移除即可。然后在收集watcher过程中，
		只有newDeps中还没存在该watcher时，才加入newDeps中，这样便可避免了重复添加watcher。

	5.计算属性进行懒求值的原理：
		计算属性的watcher是通过dirty(初始值为true)标记来达到懒求值的，只有dirty的值为true的时候，访问计算属性时，才会调用
		getter来进行重新求值，每次求完值后，会把dirty设置成false，所以下一次访问计算属性时，不会进行重新的求值，会直接返回上一次的值。只有当计算属性依赖的响应式属性发生变化时，会调用watcher的update方法，把dirty值
		设置成true，这样就可以在下一次访问计算属性时，进行重新求值。
	
# 父组件传给子组件prop改变时，子组件会进行更新的原理:
	1.父组件prop的数据改变时，会进行重新的render.
	2.在render重新生成vnode时，对于子组件占位vnode，它也会发生相应的变化，如propsData属性会发生变化。
	3.在父组件进行patch时，对于相似的vnode，会进行patchVnode。
	4.对于组件的占位vnode进行patchVnode时候，会进行更新组件的vnode,listeners,props等操作，其中因为
	组件的props是响应式的属性，所以在更新重新赋值组件的prop时候，会导致prop属性的setter，所以会依赖该prop属性的依赖的update，所以如果子组件的render中有依赖该prop时，那么会进行子组件的rerender.


