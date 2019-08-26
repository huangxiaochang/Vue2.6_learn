# Vue构造函数的实例：
	1.只能使用new来创建Vue实例
	2.在构造函数内调用原型上的_init方法进行初始化vm实例。


# vm实例的初始化：_init(options):
	1.合并options选项。(合并策略详见options合并.md)。

	2.设置渲染函数的代理：即代理渲染函数的作用域为vm实例的$data和全局的属性和方法。

	3.初始化生命周期：建组件的父子关系。然后设置一些与生命周期相关的属性,如：_isMounted，_isDestroyed等。

	4.初始化事件：定义_events属性来收集组件的自定义事件。同时更新组件的父监听器：
		即会把在父级监听组件的事件(在组件标签上定义的监听)更新到组件的事件中心。

	5.初始化渲染：定义与渲染相关的属性和方法：如$slots，$scopedSlots，$createElement，_c等。

	6.调用beforeCreate生命周期钩子。从该钩子调用时机可以看出，在该钩子中访问不到data,props,methods等选项。

	7.解析获取inject定义的provide的值，然后再vm实例上定义同名的属性。(inject选项的属性不是响应式的，不过如果
		它的provide本身就是响应式的，那么它也是响应式的)。

	8.初始化props选项：把props选项的属性定义到vm实例的_props属性上，并设置这些属性成响应式属性。
		同时在vm实例上定义_props代理，即访问vm与_props同名属性时，实际访问的是_props同名属性。
	9.初始化methods选项：在vm实例上定义metho同名属性，并绑定执行上下文为vm实例。

	10.初始化data选项：把data选项的属性定义到vm实例的_data属性上，同时在vm定义代理，即访问vm上与data
		选项同名属性，实际访问的是vm的_data上的同名属性。然后再观测_data(详情见Vue响应式原理.md)。

	11.初始化计算属性：
		1.为计算属性创建一个watcher观察者,并在vm上定义_computedWatchers属性来存储所有的计算属性的观察者。
		2.在vm上定义与计算属性同名的属性，并且该属性设置了computedGetter。
		3.该computedGetter内部会调用计算属性watcher进行惰性求值和收集依赖，并返回计算属性的值。

		2.5版本的原理：
		1.把依赖计算属性的依赖收集进对象的计算属性的观察者watcher.
		2.在计算属性初始求值时，会访问依赖的响应式属性，所以这些依赖的响应式属性便收集了计算属性依赖.
		3.当计算属性依赖的响应式属性发生变化时，便会通知计算属性依赖。然后进行重新求值，如果计算属性的值
		发生了改变，则会再去通知依赖该计算属性的依赖。

		本质上，计算属性是作为响应式属性和依赖计算属性的依赖的中间桥梁。只有计算属性真正发生变化时，才会通知
		依赖计算属性的依赖，而不是响应式属性发生变化时，因为响应式属性发生变化时，计算属性不一定也会变化。

		2.6版本的原理:
			依赖的收集：
			1.访问计算属性时(如渲染函数中访问，所以此时的Dep.target为renderWatcher,即targetStack的栈顶为
				renderWatcher)，触发计算属性的gettercomputedGetter),在computedGetter中先判断watcher.dirty为true时，
				会调用watcher.evaluate()进行求计算属性的求值。

			2.调用watcher.evaluate()时，会先把Dep.target设置为计算属性的watcher，然后调用开发者定义的getter
			进行求值，这样会发响应式属性的getter，从而把计算属性的watcher收集进响应式属性dep中，同时会把响应式的dep,收集到计算属性watcher的deps中。然后再把Dep.target设置成renderWatcher(targetStack的栈顶target),然后执行watcher.depend()，同时会把watcher.dirty设置为false。

			3.执行watcher.depend()时，遍历计算属性的deps(响应式属性的dep)，调用响应式属性dep的depend方法，
			把Dep.target(renderWatcher),添加到响应式属性的dep中，同时renderWatcher的deps也收集了响应式属性的dep.
			
			依赖的响应：
			1.当响应式属性发生变化时，会通知它的依赖（计算属性的watcher，renderWatcher，计算属性的watcher都会先于
			renderWatcher,即计算属性的依赖执行的），执行update方法。
			2.计算属性的update方法只是把watcher.dirty设置为true。
			3.renderWatcher会重新执行render，进行视图的更新，在这过程中，会在此访问到计算属性，此时计算属性的watcher.dirty已经为true，所以会进行重新求值。

			所以对于2.6版本的计算属性来说，会把计算属性的watcher，和依赖该计算属性的watcher都会加入到依赖的响应式属性的dep中，当响应式属性发生变化时，都会通知watcher进行update，所以计算属性的watcher和依赖计算属性的
			watcher都会得到通知。
			对于使用watch来监听一个计算属性的watchWatcher来说，同样是会和计算属性watcher一起加入响应式属性的dep中的，响应式属性变化时，同时会得到通知，进行update,只不过watWatcher在update时，重新求计算属性的值，只有
			在新旧值不等的时候才会执行开发者定义的watch回调。但是对于依赖计算属性的renderWatcher来说，在update时，都会执行render函数的(下阶段在深入渲染函数)。

	12.初始化watch选项：为每一个watch属性创建一个watcher实例(创建watcher实例时，会进行初始的求值，这样
		即可触发依赖的响应式属性，然后添加该watchWatcher到响应式属性的dep中)。

	13.初始化provide选项：在vm实例上定义一个_provided属性引用provide。

	14.调用created生命周期钩子函数。

	15.如果存在el选项，则调用$mount方法进行组件的挂载(详情见下面的vm的$mount挂载)。

	watcher观察者详情见Vue响应式原理.md


# vm的$mount挂载：
	vm的$mount挂载是和平台，运行版本相关的(运行时版本或者完整版)，在这里只分析web平台的$mount:
	运行时版本的$mount，是直接调用mountComponent方法去挂载组件的，完整版$mount会先把模板编译处理成render函数（模板编译成渲染函数render详情见Vue模板编译.md），然后再调用运行时版本的$mount去进行挂载操作。

	1.执行beforeMount生命周期钩子函数。（完整版在这之前，会先把模板编译成render函数）

	2.先定义updateComponent方法，然后把该方法作为watcher的表达式参数去创建一个renderWatcher。
		真正的挂载操作会在创建renderWatcher的过程中进行。

	3.调用mounted生命周期钩子函数。

	渲染函数renderWatcher的创建：
	1.调用pushTarget，把renderWatcher加到targetstack栈顶，即Dep.target为renderWatcher.
	2.调用this.getter(即updateComponent)参数和执行上下文都为当前vm实例对象。
	3.所以挂载的具体实现是updateComponent方法中实现。在执行updateComponent时，会访问依赖的响应式属性，
	所以会把renderWatcher添加到响应式属性的dep中。
	
	updateComponent的实现：
	updateComponent = () => {vm._update(vm._rebder(), hydrating)}
	详情见组件挂载.md





