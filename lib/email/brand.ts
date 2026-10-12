export const emailSenders = {
  auth: "Tidelight <no-reply@tidelight.app>",
  alerts: "Tidelight Nightwatch <alerts@tidelight.app>",
  security: "Tidelight Security <security@tidelight.app>",
} as const;

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function safeEmailUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "tidelight.app" ? url.toString() : "https://tidelight.app";
  } catch {
    return "https://tidelight.app";
  }
}

export function emailFrame(input: { eyebrow: string; title: string; body: string; action?: { label: string; url: string }; footer?: string }) {
  const body = input.body
    .split("\n")
    .map((line) => `<p style="margin:0 0 16px;color:#596a64;font:16px/1.65 Arial,Helvetica,sans-serif">${escapeEmailHtml(line)}</p>`)
    .join("");
  const action = input.action
    ? `<p style="margin:28px 0"><a href="${escapeEmailHtml(safeEmailUrl(input.action.url))}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#08785b;color:#fff;text-decoration:none;font:700 15px Arial,Helvetica,sans-serif">${escapeEmailHtml(input.action.label)}</a></p>`
    : "";
  const footer = escapeEmailHtml(input.footer ?? "Tidelight · Evidence first. Decisions with care.");
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${escapeEmailHtml(input.title)}</title>
  </head>
  <body style="margin:0;background:#f2f2e9;padding:28px 12px">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeEmailHtml(input.eyebrow)} · Tidelight</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:auto;background:#fffefa;border:1px solid #deded2;border-radius:24px;overflow:hidden">
      <tr>
        <td style="padding:24px 30px;border-bottom:1px solid #e6e6dd">
          <table role="presentation"><tr>
            <td style="width:42px;height:42px;border-radius:13px;background:#062a26;text-align:center;vertical-align:middle"><img src="https://tidelight.app/tidelight-icon-192.png" alt="Tidelight" width="30" height="30" style="display:block;margin:6px"></td>
            <td style="padding-left:12px;color:#17342d;font:700 19px Arial,Helvetica,sans-serif;letter-spacing:-.4px"><span class="tidelight-wordmark">tidelight</span><span style="color:#43c7af">.</span></td>
          </tr></table>
        </td>
      </tr>
      <tr><td style="padding:32px 30px 24px">
        <div style="margin-bottom:14px;color:#178c77;font:700 11px Arial,Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase">${escapeEmailHtml(input.eyebrow)}</div>
        <h1 style="margin:0 0 20px;color:#152a24;font:700 30px/1.15 Arial,Helvetica,sans-serif;letter-spacing:-1px">${escapeEmailHtml(input.title)}</h1>
        ${body}${action}
        <p style="margin:24px 0 0;color:#87928b;font:12px/1.6 Arial,Helvetica,sans-serif">${footer}</p>
      </td></tr>
      <tr><td class="email-footer" style="padding:17px 30px;background:#f6f5ee;color:#77837d;font:11px/1.6 Arial,Helvetica,sans-serif">© ${new Date().getUTCFullYear()} Tidelight Research · <a href="https://tidelight.app" style="color:#08785b">tidelight.app</a></td></tr>
    </table>
    <div style="max-width:600px;margin:14px auto 0;color:#87928b;text-align:center;font:11px/1.5 Arial,Helvetica,sans-serif">A calmer way to read the market.</div>
    <style>@media(prefers-color-scheme:dark){body{background:#071310!important}table[role=presentation]{background:#10201c!important;border-color:#263b34!important}.tidelight-wordmark{color:#eaf4ef!important}.email-footer{background:#162b25!important;color:#9aaca3!important}h1{color:#ecf4ef!important}p{color:#b5c6be!important}}</style>
  </body>
</html>`;
}

