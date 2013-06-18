
var Result = require('result-core')
  , chai = require('./chai')
  , lazy = require('..')
  , LazyResult = lazy.Class

function delay(value){
	var result = new Result
	setTimeout(function () {
		if (value instanceof Error) result.error(value)
		else result.write(value)
	}, Math.random() * 10)
	return result
}

describe('lazy-result', function(){
	var spy
	var result
	beforeEach(function(){
		result = new LazyResult
		spy = chai.spy()
	})
	describe('then()', function(){
		it('should not execute children till `read` is called', function(){
			result = result.write(1).then(spy)
			spy.should.not.have.been.called(1)
			result.read()
			spy.should.have.been.called(1)
		})

		it('should propagate values down several levels', function(){
			result = result.write(1).then(spy).then(spy)
			spy.should.not.have.been.called(1)
			result.read()
			spy.should.have.been.called(2).with(1)
		})

		it('should propagate errors down several levels', function(){
			var error = new Error(this.test.title)
			result = result.error(error).then(spy).then(spy)
			spy.should.not.have.been.called(1)
			result.read(null, spy)
			spy.should.have.been.called(1).with(error)
		})

		it('should handle succeeding Results', function(done){
			result.write(1).then(function(val){
				return delay(val + 1)
			}).read(function(val){
				val.should.equal(2)
			}).node(done)
		})

		it('should handle failing Results', function(done){
			var error = new Error(this.test.title)
			result.write(1).then(function(val){
				return delay(error)
			}).read(null, function(reason){
				reason.should.equal(error)
				done()
			})
		})
	})

	describe('wrapper', function(){
		describe('error handling', function(){
			it('should catch sync errors', function(){
				var error = new Error(this.test.title)
				lazy(function(){
					throw error
				}).read(null, spy)
				spy.should.have.been.called.with(error)
			})

			it('should catch async errors', function(done){
				var error = new Error(this.test.title)
				lazy(function(){
					return delay(error)
				}).read(null, function(reason){
					reason.should.equal(error)
					done()
				})
			})
		})
	})
})