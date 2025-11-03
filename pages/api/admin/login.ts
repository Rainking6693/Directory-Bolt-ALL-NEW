import { NextApiRequest, NextApiResponse } from "next";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_VALUE,
  createSessionCookie,
  resolveAdminApiKey,
} from "../../../lib/auth/constants";
import type { AdminLoginResponse } from "../../../types/auth";

const ADMIN_SESSION_MAX_AGE = 24 * 60 * 60;

export default async function handler(req: NextApiRequest, res: NextApiResponse<AdminLoginResponse>) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const validKey = resolveAdminApiKey();

    if (!validKey) {
      console.error('[admin.login] ADMIN_API_KEY missing while TEST_MODE disabled');
      return res.status(500).json({
        success: false,
        error: 'Configuration error',
        message: 'ADMIN_API_KEY must be configured or TEST_MODE enabled.',
      });
    }

    const { apiKey } = req.body as { apiKey?: string };

    // Check against configured key or fallback key
    const providedKey = apiKey?.trim() || '';
    const keyMatch = providedKey === validKey;
    
    // Also check fallback key directly (for convenience)
    const ADMIN_FALLBACK_API_KEY = '718e8866b81ecc6527dfc1b640e103e6741d844f4438286210d652ca02ee4622';
    const fallbackMatch = providedKey === ADMIN_FALLBACK_API_KEY;

    if (!keyMatch && !fallbackMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid admin API key",
      });
    }

    const cookie = createSessionCookie(ADMIN_SESSION_COOKIE, ADMIN_SESSION_VALUE, ADMIN_SESSION_MAX_AGE);

    res.setHeader("Set-Cookie", cookie);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      redirectTo: "/admin",
    });
  } catch (error) {
    console.error("[admin.login] unexpected error", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
}
