import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = { matcher: "/arena/join" };

// Browsers ask for text/html. curl and most agent fetchers send Accept: */*
// and get the plain-text join page at the same link.
export function middleware(request: NextRequest) {
  if (request.method !== "GET") return NextResponse.next();
  if (request.headers.has("rsc") || request.headers.has("next-router-prefetch")) return NextResponse.next();
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/arena/join/text";
  return NextResponse.rewrite(url);
}
