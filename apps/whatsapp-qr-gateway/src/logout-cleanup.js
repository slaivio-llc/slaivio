export async function logoutWithCleanup(session, { clearAuth, removeSession, timeoutMs = 8000 }) {
  let remoteError;
  let timer;
  if (session) session.status = "LOGGED_OUT";
  try {
    if (session?.socket) {
      await Promise.race([
        session.socket.logout(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("logout_timeout")), timeoutMs); }),
      ]);
    }
  } catch {
    remoteError = new Error("whatsapp_qr_remote_logout_unconfirmed");
    remoteError.statusCode = 503;
  } finally {
    clearTimeout(timer);
    try { session?.socket?.end(new Error("intentional_logout")); } catch { /* Already closed. */ }
    // Clear only this connection, even when the remote socket was closed.
    // Keep the failure visible: local cleanup is not remote confirmation.
    try { await clearAuth(); } finally { removeSession(); }
  }
  if (remoteError) throw remoteError;
  return { status: "LOGGED_OUT", remote_logout_confirmed: Boolean(session?.socket) };
}
