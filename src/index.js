const { isArray } = Array
const protoOf = Object.getPrototypeOf
const isFunc = z => typeof z === 'function'
const isObject = z => !!z && typeof z === 'function' || typeof z === 'object'

const isProps = (x) => {
  if (!x || typeof x !== 'object') {
    return false
  }
  const proto = protoOf(x)
  return proto && !protoOf(proto)
}

const clone = data => isArray(data) ? data.slice() : Object.assign({}, data)
const toPathParts = path => isArray(path) ? path : (path || '').split('.')

//---------------------------------------------------------

const PropMatcher = (key, value) => data => !!data && data[key] === value

const PropsMatcher = props => (data) => {
  if (!data) {
    return false
  }
  for (const key in props) {
    if (props[key] !== data[key]) {
      return false
    }
  }
  return true
}

const Matcher = spec => {
  if (isFunc(spec)) return spec
  const keys = Object.keys(spec)
  return keys.length === 1
    ? PropMatcher(keys[0], spec[keys[0]])
    : PropsMatcher(spec)
}

//---------------------------------------------------------

// const findLastIndex = (array, check) => {
//   let i = array.length
//   while (i--) {
//     if (check(array[i])) {
//       return i
//     }
//   }
//   return null
// }

// const findKey = (obj, check) => {
//   for (const key in obj) {
//     if (check(obj[key])) {
//       return key
//     }
//   }
//   return null
// }

// export default function find (data, check) {
//   return Array.isArray(data) ? findLastIndex(data, check) : findKey(data, check)
// }

//---------------------------------------------------------

export const REMOVE = () => REMOVE

const change = (key, val, data, original) => {
  if (val === data[key] || (val === REMOVE && !(key in data))) {
    return data
  }

  const target = data !== original ? data : clone(original)

  if (val !== REMOVE) {
    target[key] = val

  } else if (isArray(data)) {
    target.splice(key, 1)

  } else {
    delete target[key]
  }

  return target
}


const mapArray = (array, f) => {
  const n = array.length
  let cloned
  let toRemove = false

  for (let i = 0; i < n; ++i) {
    const newVal = f(array[i], i, array)
    if (newVal !== array[i]) {
      if (!cloned) cloned = array.slice()
      cloned[i] = newVal
      toRemove = toRemove || newVal === REMOVE
    }
  }

  if (toRemove) {
    return cloned.filter(it => it !== REMOVE)
  }

  return cloned || array
}

const mapProps = (obj, f) => {
  let ret = obj

  for (const key in obj) {
    const newVal = f(obj[key], key, obj)
    ret = change(key, newVal, ret, obj)
  }

  return ret
}

export const map = (data, f) => isArray(data) ? mapArray(data, f) : mapProps(data, f)

//---------------------------------------------------------

const patch = (data, props) => {
  if (isFunc(props)) return props(data)
  if (!isProps(props)) return props

  let ret = data

  for (const key in props) {
    const val = patch(ret[key], props[key])
    ret = change(key, val, ret, data)
  }

  return ret
}

const updatePath = (data, pathParts, update) => {
  if (pathParts.length === 0) return patch(update, data)
  if (!data) return data

  const [part, ...otherParts] = pathParts

  if (part === '*' || isObject(part)) {
    const f = (otherParts.length === 0 && isFunc(update))
      ? update
      : it => updatePath(it, otherParts, update)

    if (part === '*') {
      return map(data, f)
    }

    const check = Matcher(part)
    return map(data, (v, k, obj) => check(v) ? f(v, k, obj) : v)
  }

  const val = updatePath(data[part], otherParts, update)
  return change(part, val, data, data)
}

export default function update (data, ...args) {
  let path, update

  if (args.length === 1) {
    [update] = args
  } else {
    [path, update] = args
  }

  if (!path) {
    return patch(data, update)
  }

  return updatePath(data, toPathParts(path), update)
}

export const remove = (data, path) => updatePath(data, toPathParts(path), REMOVE)

//---------------------------------------------------------

const fp = f => (...args) => data => f(data, ...args)

update._ = fp(update)
remove._ = fp(remove)
