import { NextApiRequest, NextApiResponse } from "next";
import { clearSessionCookie, ADMIN_SESSION_COOKIE } from "../../../lib/auth/constants";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const cookie = clearSessionCookie(ADMIN_SESSION_COOKIE);

    res.setHeader("Set-Cookie", cookie);

    return res.status(200).json({
      success: true,
      message: "Logout successful",
      redirectTo: "/admin-login",
    });
  } catch (error) {
    console.error("[admin.logout] unexpected error", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Logout failed",
    });
  }
}
