
var Result = require('result-core')
  , nextTick = require('next-tick')
  , inherit = require('inherit')

module.exports = function(ƒ){
	var result = new LazyResult
	result._onValue = ƒ
	return result
}

module.exports.Class = LazyResult

inherit(LazyResult, Result)

function LazyResult(){
	this.i = 0
}

LazyResult.prototype.then = function(onValue, onError){
	var result = new LazyResult
	result._parent = this
	result._onValue = onValue
	result._onError = onError
	return result
}

LazyResult.prototype.read = function(onValue, onError){
	switch (this.state) {
		case 'awaiting':
			this[this.i++] = {
				write: onValue || noop,
				error: onError || thrower
			}
			break
		case 'pending':
			this[this.i++] = {
				write: onValue || noop,
				error: onError || thrower
			}
			pulldown.call(this)
			break
		case 'done':
			onValue && onValue(this.value)
			break
		case 'fail':
			if (onError) onError(this.value)
			else throw this.value
	}
	return this
}

function thrower(e){
	nextTick(function(){ throw e })
}
function noop(){}

function pulldown(){
	this.state = 'awaiting'
	var parent = this._parent
	// top level
	if (!parent) {
		if (this._onValue) propagate(this, this._onValue)
		return
	}
	switch (parent.state) {
		case 'awaiting':
			// TODO: test this state
			parent[parent.i++] = this
			break
		case 'pending':
			parent[parent.i++] = this
			pulldown.call(parent)
			break
		case 'done':
			if (!this._onValue) this.write(parent.value)
			else propagate(this, this._onValue, parent.value)
			break
		case 'fail':
			if (!this._onError) this.error(parent.value)
			else propagate(this, this._onError, parent.value)
	}
}

/**
 * Give the LazyResult it's value
 *
 * @param  {x} value
 * @return {this}
 */

LazyResult.prototype.write = function(value){
	if (this.state === 'pending') {
		this.state = 'done'
		this.value = value
		return this
	}
	if (this.state === 'awaiting') {
		this.state = 'done'
		this.value = value
		var child
		var i = 0
		while (child = this[i++]) {
			if (!child._onValue) child.write(value)
			else propagate(child, child._onValue, value)
		}
	}
	return this
}

/**
 * put the LazyResult into a failed state
 * 
 * @param  {x} reason
 * @return {this}
 */

LazyResult.prototype.error = function(reason){
	if (this.state === 'pending') {
		this.state = 'fail'
		this.value = reason
		return this
	}
	if (this.state === 'awaiting') {
		var child = this[0]
		if (!child) throw reason
		var i = 1
		do {
			if (!child._onError) child.error(reason)
			else propagate(child, child._onError, reason)
		} while (child = this[i++])
	}
	return this
}

/**
 * Handle the processing of `child`
 * 
 * @param {LazyResult} child
 * @param {Function} fn
 * @param {x} value
 * @api private
 */

function propagate(child, fn, value){
	try { value = fn(value) } 
	catch (e) { return child.error(e) }

	// auto lift one level
	if (value instanceof Result) {
		return value.read(
			function(val){ child.write(val) },
			function(err){ child.error(err) }
		)
	}

	child.write(value)
}

/**
 * read using a node style function
 *
 *   result.node(function(err, value){})
 * 
 * @param  {Function} callback(error, value)
 * @return {this}
 */

Result.prototype.node = function(fn){
	return this.read(function(v){ fn(null, v) }, fn)
}