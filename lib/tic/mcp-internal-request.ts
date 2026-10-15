const trustedRequests = new WeakSet<Request>();

export function createMcpInternalRequest(url: string, init: RequestInit) {
  const request = new Request(url, init);
  trustedRequests.add(request);
  return request;
}

export function isMcpInternalRequest(request: Request) {
  return trustedRequests.has(request);
}
