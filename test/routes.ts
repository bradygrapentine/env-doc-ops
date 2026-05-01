export function jsonReq(method: string, body?: unknown): Request {
  return new Request("http://test.local", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function textReq(method: string, body: string, contentType = "text/csv"): Request {
  return new Request("http://test.local", {
    method,
    headers: { "content-type": contentType },
    body,
  });
}

export function emptyReq(method: string): Request {
  return new Request("http://test.local", { method });
}

import { NextRequest } from "next/server";

export function nextJsonReq(
  method: string,
  body?: unknown,
  url = "http://test.local",
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function nextEmptyReq(method: string, url = "http://test.local"): NextRequest {
  return new NextRequest(url, { method });
}
