import { NextResponse } from "next/server";

// Force Node runtime so request.body streaming (duplex) works reliably.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleProxy(request) {
  const { searchParams } = new URL(request.url);
  const apiParam = searchParams.get("api");

  if (!apiParam) {
    return NextResponse.json(
      { message: "Missing 'api' parameter in query." },
      { status: 400 },
    );
  }

  try {
    // Resolve upstream base URL (server-only var preferred; keep the public one
    // as a fallback for parity with the rest of the app).
    let baseUrlString =
      process.env.PROXY_BASE_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://35.226.245.206:9092/JarvisV3/";
    if (!baseUrlString.endsWith("/")) baseUrlString += "/";

    const cleanApiPath = apiParam.startsWith("/")
      ? apiParam.slice(1)
      : apiParam;
    const targetUrl = new URL(cleanApiPath, baseUrlString);

    // Forward every incoming query param except our control ones.
    searchParams.forEach((value, key) => {
      if (key !== "api" && key !== "bodyType") {
        targetUrl.searchParams.append(key, value);
      }
    });

    // Clone request headers; drop host (routing) and hop-by-hop request headers.
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("connection");
    // Let fetch negotiate/handle encoding itself.
    headers.delete("accept-encoding");

    const fetchOptions = {
      method: request.method,
      headers,
    };

    if (!["GET", "HEAD"].includes(request.method)) {
      if (searchParams.get("bodyType") === "form") {
        // Let fetch set the multipart boundary + length itself.
        headers.delete("content-length");
        headers.delete("content-type");
      }
      fetchOptions.body = request.body;
      fetchOptions.duplex = "half";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 min
    fetchOptions.signal = controller.signal;

    const response = await fetch(targetUrl.toString(), fetchOptions);
    clearTimeout(timeout);

    if (response.status === 403) {
      return NextResponse.json({ message: "403 Forbidden" }, { status: 403 });
    }

    // Rebuild response headers, stripping hop-by-hop + already-consumed ones.
    // fetch decompresses the body, so forwarding content-encoding/length would
    // make the browser fail to decode it (ERR_CONTENT_DECODING_FAILED).
    const outHeaders = new Headers(response.headers);
    outHeaders.delete("content-encoding");
    outHeaders.delete("content-length");
    outHeaders.delete("transfer-encoding");
    outHeaders.delete("connection");

    return new Response(response.body, {
      status: response.status,
      headers: outHeaders,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return NextResponse.json(
        {
          message:
            "504 Gateway Timeout: Upstream server took too long to respond.",
        },
        { status: 504 },
      );
    }
    console.error("[App Proxy Error]:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
