export function isAuthorizedEmail(email: string): boolean {
  const authorizedEmails = process.env.AUTHORIZED_EMAILS?.split(",").map((e) =>
    e.trim().toLowerCase()
  ) || [];
  return authorizedEmails.includes(email.toLowerCase().trim());
}
