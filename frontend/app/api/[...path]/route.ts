import { NextRequest, NextResponse } from 'next/server'

// Default to internal Docker service name if BACKEND_URL is not provided
const BACKEND_URL = process.env.BACKEND_URL || 'http://server:8000'

async function handleProxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path ? params.path.join('/') : ''
  const search = req.nextUrl.search || ''
  const targetUrl = `${BACKEND_URL}/api/${path}${search}`

  const headers = new Headers()
  req.headers.forEach((value, key) => {
    // Strip headers that interfere with internal HTTP proxying
    if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
      headers.set(key, value)
    }
  })

  try {
    const hasBody = !['GET', 'HEAD'].includes(req.method)
    const body = hasBody ? await req.blob() : undefined

    const backendRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      // @ts-expect-error duplex is required for streaming body in fetch
      duplex: 'half',
      cache: 'no-store',
    })

    const resHeaders = new Headers()
    backendRes.headers.forEach((value, key) => {
      if (!['content-encoding', 'content-length'].includes(key.toLowerCase())) {
        resHeaders.set(key, value)
      }
    })

    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: resHeaders,
    })
  } catch (err: any) {
    console.error(`[API Proxy Error] Failed to proxy ${req.method} ${targetUrl}:`, err)
    return NextResponse.json(
      { error: 'Failed to connect to backend server', details: err?.message },
      { status: 502 }
    )
  }
}

export const GET = handleProxy
export const POST = handleProxy
export const PUT = handleProxy
export const DELETE = handleProxy
export const PATCH = handleProxy
export const HEAD = handleProxy
export const OPTIONS = handleProxy
