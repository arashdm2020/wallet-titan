"use client";

import Link from "next/link";

export function AuthRequired() {
  return (
    <div className="mx-5 mt-8 rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-amber-900">
      <p className="font-bold">Authentication required</p>
      <p className="mt-2 text-sm leading-6">Sign in or create a simulator wallet before opening wallet data.</p>
      <Link href="/" className="mt-4 inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white">
        Open Sign In
      </Link>
    </div>
  );
}
