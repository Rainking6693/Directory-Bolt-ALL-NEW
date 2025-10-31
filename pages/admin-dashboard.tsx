import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AdminDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin').catch(() => {
      /* ignore */
    });
  }, [router]);

  return <p className="p-8 text-center">Redirecting to the admin dashboard...</p>;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/admin',
      permanent: false,
    },
  };
}
