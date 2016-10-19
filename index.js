;(function(exports) {
  'use strict'

  var runtime = {
    VERSION: '0.3.0',
    IS_DEBUG: false,
    IS_LOGGER: false
  }

  var hook = (typeof window !== 'undefined' && window.__VUE_DEVTOOLS_GLOBAL_HOOK__)

  var deepProp = function(obj, path) {
    return path.split('.').reduce(function(o, p) { return o[p] }, obj)
  }

  var deepCopy = function deepCopy(target, source) {
    for(var prop in source) {
      var _val = null
      if (Array.isArray(source[prop])) {
        _val = []
        source[prop].forEach(function(item) { _val.push(deepCopy({}, item)) })
      } else if (typeof source[prop] === 'object') {
        _val = deepCopy({}, source[prop])
      } else {
        _val = source[prop]
      }
      target[prop] = _val
    }
    return target
  }

  var _info = function() {
    console.log('Vuelm version: ', runtime.VERSION)
    console.log('Vuelm debug mode:', runtime.IS_DEBUG)
    console.log('Vuelm logger mode:', runtime.IS_LOGGER)
  }

  var _enableDebug = function(flag) {
    runtime.IS_DEBUG = flag
    Vue.config.debug = flag
    Vue.config.devtools = flag
  }

  var _enableLog = function(flag) {
    runtime.IS_LOGGER = flag
  }

  var Model = function(state, updates, actions) {
    this._options = {
      state: state,
      updates: updates
    }

    this._subscriber_id = 100
    this._subscribers = {}

    if (actions !== undefined || actions !== null) {
      for (var key in actions) {
        this[key] = actions[key]
      }
    }
  }

  Model.prototype = {
    _notify: function() {
      var $state = deepCopy(this._options.state)
      for(var id in this._subscribers) {
        this._subscribers[id]($state)
      }
      $state = null
    },

    state: function() {
      return deepCopy({}, this._options.state)
    },

    get: function(prop) {
      return deepProp(this._options.state, prop)
    },

    update: function(type, data) {
      var prop = null
        , state = {}
        , prev = deepCopy(this._options.state)
        , next = {}

      if (runtime.IS_LOGGER && console.group) console.group(type)
      if (runtime.IS_LOGGER) console.log('Old State:', prev)

      if (typeof this._options.updates[type] === 'function') {
        next = this._options.updates[type].call(this, prev, data)
        this._options.state = next
      } else {
        next = prev
      }

      if (runtime.IS_DEBUG && hook) { hook.emit('vuex:mutation', { type: type, payload: data || {} }, next) }
      if (runtime.IS_LOGGER) console.log('New State:', next)
      if (runtime.IS_LOGGER && console.groupEnd) console.groupEnd()
      this._notify()
      prev = null; next = null
    },

    observe: function(fn) {
      var self = this, $sid = this._subscriber_id++
      self._subscribers[$sid] = function(state) {
        fn.call(self, state)
      }
      return function() {
        var _sid = $sid
        delete self._subscribers[_sid]
      }
    }
  }

  var _model = function model(state, updates, actions) {
    var $model = new Model(state, updates, actions)
    if (hook) { hook.emit('vuex:init', this) }
    return $model
  };

  var _connect = function connect(component, models) {
    var _ready = component.ready
      , _bdestroy = component.beforeDestroy

    if (typeof models !== 'object') {
      console.warn('\"models\" object must be defined.')
      return
    }

    component.created = function() {
      var _state = {}
      for (var key in models) {
        _state = Object.assign(_state, models[key].state())
      }
      this.$options.state = _state
    }

    component.mounted = function() {
      var _disposes = [], _state = this.$options.state

      var watcher = function(newState) {
        this.$options.state = Object.assign(_state, newState)
        for(var prop in this.$options.state) {
          this.$set(this, prop, deepProp(this.$options.state, prop))
        }
      }.bind(this)

      for (var key in models) {
        _disposes.push(models[key].observe(watcher))
      }

      if (_ready !== undefined) _ready()
      component.$disposes = _disposes
      this.$options.state = _state
    }

    component.beforeDestroy = function() {
      if (_bdestroy !== undefined) _bdestroy()
      component.$disposes.forEach(function(dispose) { dispose() })
    }

    return component
  };

  var _createTypes = function() {
    var result = {}
    if (!arguments) return result
    var len = arguments.length
    for(var idx=0; idx < len; idx++) {
      result[arguments[idx]] = arguments[idx].toUpperCase()
    }
    return result
  }

  exports.info = _info
  exports.types = _createTypes
  exports.version = runtime.VERSION
  exports.isDebug = runtime.IS_DEBUG
  exports.logger = _enableLog
  exports.debug = _enableDebug
  exports.model = _model
  exports.connect = _connect
})(typeof exports === 'undefined' ? (this.Vuelm = {}) : exports)
