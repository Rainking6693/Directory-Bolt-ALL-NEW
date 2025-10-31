import { NextApiRequest, NextApiResponse } from "next";
import { authenticateAdminRequest } from "../../../lib/auth/guards";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = authenticateAdminRequest(req);

    if (!auth.ok) {
      const status = auth.reason === 'CONFIG' ? 500 : 401;
      return res.status(status).json({
        error: auth.reason === 'CONFIG' ? 'Configuration error' : 'Unauthorized',
        message: auth.message ?? 'Admin authentication required',
      });
    }

    return res.status(200).json({
      authenticated: true,
      via: auth.via,
      user: {
        id: "admin-user",
        username: "admin",
        email: "ben.stone@directorybolt.com",
        first_name: "Ben",
        last_name: "Stone",
        role: "super_admin",
        permissions: {
          system: true,
          users: true,
          analytics: true,
          billing: true,
          support: true,
        },
      },
    });
  } catch (error) {
    console.error("[admin.auth-check] unexpected error", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Authentication service temporarily unavailable",
    });
  }
}
