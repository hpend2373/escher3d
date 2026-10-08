import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { extname, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const argumentsList = process.argv.slice(2)
const appRootArgumentIndex = argumentsList.indexOf('--app-root')
const appRoot = appRootArgumentIndex >= 0
  ? resolve(argumentsList[appRootArgumentIndex + 1])
  : resolve(projectRoot, 'release/escher-carbon-path')
const portArgumentIndex = argumentsList.indexOf('--port')
const port = portArgumentIndex >= 0
  ? Number(argumentsList[portArgumentIndex + 1])
  : 4173
const hostArgumentIndex = argumentsList.indexOf('--host')
const host = hostArgumentIndex >= 0
  ? argumentsList[hostArgumentIndex + 1]
  : '127.0.0.1'
const accessTokenArgumentIndex = argumentsList.indexOf('--access-token')
const requestedAccessToken = accessTokenArgumentIndex >= 0
  ? argumentsList[accessTokenArgumentIndex + 1]
  : null
const accessToken = requestedAccessToken === 'auto'
  ? randomBytes(24).toString('hex')
  : requestedAccessToken
const shouldOpen = argumentsList.includes('--open')
const openPathArgumentIndex = argumentsList.indexOf('--open-path')
const requestedOpenPath = openPathArgumentIndex >= 0
  ? argumentsList[openPathArgumentIndex + 1]
  : '/'
const openPath = (
  typeof requestedOpenPath === 'string' &&
  requestedOpenPath.startsWith('/') &&
  !requestedOpenPath.startsWith('//')
) ? requestedOpenPath : '/'
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('올바른 포트 번호가 아닙니다. 0은 자동 선택입니다.')
  process.exit(1)
}

if (!host || typeof host !== 'string') {
  console.error('올바른 호스트 주소가 아닙니다.')
  process.exit(1)
}

if (accessTokenArgumentIndex >= 0 && !accessToken) {
  console.error('--access-token에는 토큰 문자열 또는 auto가 필요합니다.')
  process.exit(1)
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
}

function filePathForRequest (requestUrl) {
  const url = new URL(requestUrl || '/', 'http://127.0.0.1')
  const pathname = decodeURIComponent(url.pathname)
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1)
  const filePath = resolve(appRoot, relativePath)
  const isInsideApp = (
    filePath === appRoot ||
    filePath.startsWith(`${appRoot}${sep}`)
  )
  return isInsideApp ? filePath : null
}

function requestHasAccess (request, response) {
  if (!accessToken) return true

  const url = new URL(request.url || '/', 'http://127.0.0.1')
  const suppliedToken = url.searchParams.get('access_token')
  if (suppliedToken === accessToken) {
    url.searchParams.delete('access_token')
    response.writeHead(302, {
      'Cache-Control': 'no-store',
      'Location': `${url.pathname}${url.search}`,
      'Set-Cookie': `escher_remote_access=${encodeURIComponent(accessToken)}; Path=/; HttpOnly; SameSite=Strict`
    })
    response.end()
    return false
  }

  const cookies = Object.fromEntries(
    String(request.headers.cookie || '')
      .split(';')
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => {
        const separator = value.indexOf('=')
        if (separator < 0) return [value, '']
        return [
          value.slice(0, separator),
          decodeURIComponent(value.slice(separator + 1))
        ]
      })
  )
  if (cookies.escher_remote_access === accessToken) return true

  response.writeHead(401, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8'
  })
  response.end('접속 토큰이 필요합니다. 런처가 출력한 원격 주소를 사용하세요.\n')
  return false
}

const server = createServer(async (request, response) => {
  if (!requestHasAccess(request, response)) return

  const filePath = filePathForRequest(request.url)
  if (!filePath || !['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(404)
    response.end('Not found')
    return
  }

  try {
    const fileStats = await stat(filePath)
    if (!fileStats.isFile()) throw new Error('Not a file')

    response.writeHead(200, {
      'Content-Length': fileStats.size,
      'Content-Type': contentTypes[extname(filePath)] ||
        'application/octet-stream',
      'Cache-Control': 'no-cache'
    })
    if (request.method === 'HEAD') {
      response.end()
    } else {
      createReadStream(filePath).pipe(response)
    }
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
})

function openBrowser (url) {
  const command = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
      ? 'cmd'
      : 'xdg-open'
  const commandArguments = process.platform === 'win32'
    ? ['/c', 'start', '', url]
    : [url]
  const child = spawn(command, commandArguments, {
    detached: true,
    stdio: 'ignore'
  })
  child.unref()
}

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `포트 ${port}가 이미 사용 중입니다. 기존 Escher 실행 창을 종료해 주세요.`
    )
  } else {
    console.error(error)
  }
  process.exit(1)
})

server.listen(port, host, () => {
  const address = server.address()
  const activePort = (
    address &&
    typeof address === 'object'
  )
    ? address.port
    : port
  const browserHost = host === '0.0.0.0' ? '127.0.0.1' : host
  const localUrl = new URL(openPath, `http://${browserHost}:${activePort}/`)
  if (accessToken) localUrl.searchParams.set('access_token', accessToken)
  console.log('')
  console.log('Escher iMM1865 Pathway Editor')
  console.log(`로컬 주소: ${localUrl.toString()}`)
  if (host === '0.0.0.0') {
    const remoteAddresses = Object.values(networkInterfaces())
      .flat()
      .filter(address => (
        address &&
        address.family === 'IPv4' &&
        !address.internal
      ))
      .map(address => address.address)
    for (const address of remoteAddresses) {
      const remoteUrl = new URL(openPath, `http://${address}:${activePort}/`)
      if (accessToken) remoteUrl.searchParams.set('access_token', accessToken)
      console.log(`원격 주소: ${remoteUrl.toString()}`)
    }
    if (!accessToken) {
      console.log('경고: 원격 서버가 접속 토큰 없이 열려 있습니다.')
    }
  }
  console.log('종료하려면 이 터미널에서 Ctrl+C를 누르세요.')
  console.log('')
  if (shouldOpen) openBrowser(localUrl.toString())
})

function shutdown () {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
