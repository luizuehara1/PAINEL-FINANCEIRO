import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export const ALLOWED_EMAILS = [
  "luiz.uehara1@gmail.com",
  "edson.menta@hotmail.com",
];

export function isAllowedEmail(email?: string | null) {
  if (!email) return false;
  return ALLOWED_EMAILS.includes(email.toLowerCase());
}

export async function logoutUser() {
  await signOut(auth);
}
