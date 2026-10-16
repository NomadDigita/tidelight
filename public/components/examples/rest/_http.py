"""Small credential-safe HTTP transport shared by the Python REST examples."""

from urllib.request import HTTPRedirectHandler, Request, build_opener


class _RejectRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        # API bearer credentials must never be forwarded to a redirect target.
        return None


def open_api_url(request: Request, timeout: float = 15):
    """Open one URL and reject redirects instead of forwarding Authorization."""
    return build_opener(_RejectRedirects()).open(request, timeout=timeout)
