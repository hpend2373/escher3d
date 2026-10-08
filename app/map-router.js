// The bundled editor has two original map slots. Redirect only the merged-map
// request so map00240 and map00410 remain independently editable.
(() => {
  const requestedMap = new URLSearchParams(window.location.search).get('map')
  if (requestedMap !== 'merged') return

  const redirect = value => {
    if (typeof value !== 'string') return value
    return value.replace(
      './maps/map00410_backbone.json',
      './maps/iMM1865.Pyrimidine and beta-Alanine metabolism (2).json'
    )
  }

  const originalFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    if (typeof input === 'string') return originalFetch(redirect(input), init)
    if (input instanceof Request) {
      return originalFetch(new Request(redirect(input.url), input), init)
    }
    return originalFetch(input, init)
  }

  const originalOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    return originalOpen.call(this, method, redirect(url), ...rest)
  }
})()
