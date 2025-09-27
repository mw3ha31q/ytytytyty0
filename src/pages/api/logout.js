export function GET() {
  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': 'auth_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
      'Location': '/login'
    }
  });
}