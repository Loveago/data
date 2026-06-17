"use client";

import Link from "next/link";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-6">{title}</h2>
      {children}
    </section>
  );
}

function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
  return (
    <pre className={`rounded-xl bg-zinc-950 dark:bg-zinc-900 text-zinc-100 p-4 text-xs overflow-x-auto leading-relaxed border border-zinc-800 lang-${language}`}>
      <code>{code.trim()}</code>
    </pre>
  );
}

function EndpointBadge({ method, path }: { method: string; path: string }) {
  const colors: Record<string, string> = {
    GET: "bg-blue-600",
    POST: "bg-emerald-600",
    PATCH: "bg-amber-600",
    DELETE: "bg-red-600",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl bg-zinc-950 px-4 py-3 font-mono text-sm mb-4 border border-zinc-800">
      <span className={`${colors[method] || "bg-zinc-600"} rounded-md px-2 py-0.5 text-xs font-bold text-white`}>{method}</span>
      <span className="text-zinc-200">{path}</span>
    </div>
  );
}

function ParamRow({ name, type, required, description }: { name: string; type: string; required?: boolean; description: string }) {
  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="py-3 pr-4">
        <code className="text-xs font-mono text-violet-700 dark:text-violet-400">{name}</code>
        {required && <span className="ml-1.5 text-[10px] font-bold text-red-500">required</span>}
      </td>
      <td className="py-3 pr-4 text-xs text-zinc-500 dark:text-zinc-400">{type}</td>
      <td className="py-3 text-sm text-zinc-700 dark:text-zinc-300">{description}</td>
    </tr>
  );
}

const BASE_URL = "https://api.yourdomain.com/api/v1";

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                ← Back
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">API Documentation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">v1</span>
              <Link
                href="/dashboard?tab=api-access"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-700 transition-all"
              >
                Get API Key →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          <nav className="hidden lg:block">
            <div className="sticky top-24 space-y-1 text-sm">
              {[
                ["#overview", "Overview"],
                ["#authentication", "Authentication"],
                ["#rate-limits", "Rate Limits"],
                ["#errors", "Errors"],
                ["#networks", "GET Networks"],
                ["#packages", "GET Packages"],
                ["#place-order", "POST Orders"],
                ["#get-order", "GET Order"],
                ["#balance", "GET Balance"],
                ["#webhooks", "Webhooks"],
                ["#changelog", "Changelog"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="flex h-9 items-center rounded-xl px-3 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors"
                >
                  {label}
                </a>
              ))}
            </div>
          </nav>

          <main className="space-y-16 min-w-0">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 dark:border-violet-800/40 dark:bg-violet-950/30 dark:text-violet-300 mb-4">
                Developer Reference
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Data Bundle API
              </h1>
              <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl">
                Integrate our data bundle platform directly into your website or application. Place orders, check status, and query available products — all via a simple REST API.
              </p>
            </div>

            <Section id="overview" title="Overview">
              <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
                <p>
                  The Data Bundle API allows your website to programmatically place data bundle orders on behalf of your customers. Orders are fulfilled automatically using our fulfillment pipeline.
                </p>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Base URL</div>
                  <code className="font-mono text-sm text-violet-700 dark:text-violet-400">{BASE_URL}</code>
                </div>
                <p>All requests and responses use <strong>JSON</strong>. All monetary values are in <strong>GHS (Ghanaian Cedis)</strong>.</p>
              </div>
            </Section>

            <Section id="authentication" title="Authentication">
              <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
                <p>
                  Every API request must include your API key in the <code className="font-mono text-violet-700 dark:text-violet-400">x-api-key</code> HTTP header. To obtain an API key:
                </p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Log in to your dashboard at <Link href="/dashboard?tab=api-access" className="text-blue-600 underline dark:text-blue-400">dashboard → API Access</Link>.</li>
                  <li>Submit an API access request.</li>
                  <li>Once approved by an admin, your API key will appear in the API Access tab.</li>
                </ol>
                <CodeBlock language="bash" code={`# Include your API key in every request
curl -H "x-api-key: YOUR_API_KEY" \\
     ${BASE_URL}/packages`} />
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-950/30">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">Security</div>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    Never expose your API key in client-side code or public repositories. Treat it like a password. If compromised, contact support immediately.
                  </p>
                </div>
              </div>
            </Section>

            <Section id="rate-limits" title="Rate Limits">
              <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
                <p>API requests are rate-limited to protect service availability. The current limits are:</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        <th className="py-3 pr-4">Endpoint</th>
                        <th className="py-3 pr-4">Limit</th>
                        <th className="py-3">Window</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="py-3 pr-4"><code className="text-xs font-mono text-violet-700 dark:text-violet-400">POST /orders</code></td>
                        <td className="py-3 pr-4">60 requests</td>
                        <td className="py-3">per minute</td>
                      </tr>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="py-3 pr-4"><code className="text-xs font-mono text-violet-700 dark:text-violet-400">GET /orders/:ref</code></td>
                        <td className="py-3 pr-4">120 requests</td>
                        <td className="py-3">per minute</td>
                      </tr>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="py-3 pr-4">All other endpoints</td>
                        <td className="py-3 pr-4">200 requests</td>
                        <td className="py-3">per minute</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p>When the rate limit is exceeded, you will receive a <code className="font-mono text-red-500">429 Too Many Requests</code> response. Implement exponential backoff in your integration.</p>
              </div>
            </Section>

            <Section id="errors" title="Error Handling">
              <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
                <p>All errors return a JSON object with a <code className="font-mono text-violet-700 dark:text-violet-400">status</code> of <code className="font-mono text-red-500">&quot;error&quot;</code> and a human-readable <code className="font-mono text-violet-700 dark:text-violet-400">message</code> field.</p>
                <CodeBlock code={`{
  "status": "error",
  "message": "Insufficient stock. Available: 2"
}`} />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        <th className="py-3 pr-4">HTTP Status</th>
                        <th className="py-3">Meaning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["200 OK", "Request succeeded"],
                        ["201 Created", "Resource created (new order placed)"],
                        ["400 Bad Request", "Invalid request body or missing required fields"],
                        ["401 Unauthorized", "Missing or invalid x-api-key"],
                        ["404 Not Found", "Resource does not exist"],
                        ["409 Conflict", "Duplicate request (e.g. already has an API access request)"],
                        ["429 Too Many Requests", "Rate limit exceeded"],
                        ["500 Internal Server Error", "Unexpected server error"],
                      ].map(([code, meaning]) => (
                        <tr key={code} className="border-b border-zinc-100 dark:border-zinc-800">
                          <td className="py-3 pr-4 font-mono text-xs text-zinc-800 dark:text-zinc-200">{code}</td>
                          <td className="py-3 text-sm text-zinc-600 dark:text-zinc-400">{meaning}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>

            <Section id="networks" title="List Networks">
              <EndpointBadge method="GET" path="/api/v1/networks" />
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">Returns all available networks (MTN, Telecel, AirtelTigo, etc.).</p>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Example Request</h4>
              <CodeBlock language="bash" code={`curl -H "x-api-key: YOUR_API_KEY" \\
     ${BASE_URL}/networks`} />
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mt-5 mb-2">Example Response</h4>
              <CodeBlock code={`{
  "status": "success",
  "message": "Networks retrieved successfully",
  "networks": [
    { "id": "clxyz001", "name": "MTN", "slug": "mtn" },
    { "id": "clxyz002", "name": "Telecel", "slug": "telecel" },
    { "id": "clxyz003", "name": "AirtelTigo", "slug": "airteltigo" }
  ]
}`} />
            </Section>

            <Section id="packages" title="List Packages">
              <EndpointBadge method="GET" path="/api/v1/packages" />
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">Returns available data bundle packages. Optionally filter by network.</p>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Query Parameters</h4>
              <div className="overflow-x-auto mb-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      <th className="py-2 pr-4">Parameter</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ParamRow name="network" type="string" description="Filter by network slug or name (e.g. mtn, telecel). Optional." />
                  </tbody>
                </table>
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Example Request</h4>
              <CodeBlock language="bash" code={`curl -H "x-api-key: YOUR_API_KEY" \\
     "${BASE_URL}/packages?network=mtn"`} />
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mt-5 mb-2">Example Response</h4>
              <CodeBlock code={`{
  "status": "success",
  "message": "Packages retrieved successfully",
  "packages": [
    {
      "id": "prod_001",
      "name": "MTN 1GB Data Bundle",
      "slug": "mtn-1gb",
      "network": "MTN",
      "network_slug": "mtn",
      "price": "12.00",
      "stock": 500
    },
    {
      "id": "prod_002",
      "name": "MTN 2GB Data Bundle",
      "slug": "mtn-2gb",
      "network": "MTN",
      "network_slug": "mtn",
      "price": "22.00",
      "stock": 350
    }
  ]
}`} />
            </Section>

            <Section id="place-order" title="Place an Order">
              <EndpointBadge method="POST" path="/api/v1/orders" />
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">
                Places a new data bundle order. The order is fulfilled automatically. Returns the order reference which you can use to check status.
              </p>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Request Body</h4>
              <div className="overflow-x-auto mb-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      <th className="py-2 pr-4">Field</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ParamRow name="package_id" type="string" required description="The ID of the data package to purchase (from GET /packages)." />
                    <ParamRow name="recipient_number" type="string" required description="The mobile number to deliver the data to (e.g. 0241234567)." />
                    <ParamRow name="quantity" type="integer" description="Number of units to purchase. Defaults to 1. Maximum 20." />
                    <ParamRow name="customer_reference" type="string" description="Your own reference for this order (up to 100 chars). Optional but recommended for reconciliation." />
                  </tbody>
                </table>
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Example Request</h4>
              <CodeBlock language="bash" code={`curl -X POST \\
     -H "x-api-key: YOUR_API_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{
       "package_id": "prod_001",
       "recipient_number": "0241234567",
       "quantity": 1,
       "customer_reference": "myapp-order-99"
     }' \\
     ${BASE_URL}/orders`} />
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mt-5 mb-2">Example Response — 201 Created</h4>
              <CodeBlock code={`{
  "status": "success",
  "message": "Order placed successfully",
  "order": {
    "reference": "API-20260617-3A9F2B1C",
    "external_reference": "myapp-order-99",
    "status": "pending",
    "recipient_number": "0241234567",
    "package": {
      "id": "prod_001",
      "name": "MTN 1GB Data Bundle",
      "network": "MTN"
    },
    "quantity": 1,
    "unit_price": "12.00",
    "total": "12.00",
    "created_at": "2026-06-17T10:23:45.000Z"
  }
}`} />
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/40 dark:bg-blue-950/30">
                <div className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1">Note</div>
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  Save the <code className="font-mono">order.reference</code> value. Use it to poll <code className="font-mono">GET /orders/:reference</code> for fulfillment status updates.
                </p>
              </div>
            </Section>

            <Section id="get-order" title="Get Order Status">
              <EndpointBadge method="GET" path="/api/v1/orders/:reference" />
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">
                Retrieves the current status of an order by its reference. Poll this endpoint after placing an order to track fulfillment.
              </p>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Path Parameters</h4>
              <div className="overflow-x-auto mb-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      <th className="py-2 pr-4">Parameter</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ParamRow name="reference" type="string" required description="The order reference returned when the order was placed." />
                  </tbody>
                </table>
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Order Status Values</h4>
              <div className="overflow-x-auto mb-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2">Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["pending", "Order received and queued for fulfillment"],
                      ["processing", "Order is being submitted to the network provider"],
                      ["delivered", "Data has been successfully delivered to the recipient"],
                      ["failed", "Delivery failed. Contact support with the order reference"],
                    ].map(([s, m]) => (
                      <tr key={s} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="py-3 pr-4"><code className="text-xs font-mono text-violet-700 dark:text-violet-400">{s}</code></td>
                        <td className="py-3 text-sm text-zinc-600 dark:text-zinc-400">{m}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Example Request</h4>
              <CodeBlock language="bash" code={`curl -H "x-api-key: YOUR_API_KEY" \\
     ${BASE_URL}/orders/API-20260617-3A9F2B1C`} />
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mt-5 mb-2">Example Response</h4>
              <CodeBlock code={`{
  "status": "success",
  "message": "Order retrieved successfully",
  "order": {
    "reference": "API-20260617-3A9F2B1C",
    "status": "delivered",
    "api_status": "success",
    "recipient_number": "0241234567",
    "package": {
      "id": "prod_001",
      "name": "MTN 1GB Data Bundle",
      "network": "MTN"
    },
    "quantity": 1,
    "unit_price": "12.00",
    "total": "12.00",
    "created_at": "2026-06-17T10:23:45.000Z",
    "updated_at": "2026-06-17T10:25:12.000Z"
  }
}`} />
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/40 dark:bg-blue-950/30">
                <div className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1">Polling Recommendation</div>
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  Poll every <strong>5–10 seconds</strong> for up to 2 minutes after placing an order. Most orders are delivered within 30 seconds. If still <code className="font-mono">pending</code> or <code className="font-mono">processing</code> after 2 minutes, poll every 30 seconds for up to 10 minutes before raising a support ticket.
                </p>
              </div>
            </Section>

            <Section id="balance" title="Get Balance">
              <EndpointBadge method="GET" path="/api/v1/balance" />
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">Returns the current wallet balance associated with your API key account.</p>
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Example Request</h4>
              <CodeBlock language="bash" code={`curl -H "x-api-key: YOUR_API_KEY" \\
     ${BASE_URL}/balance`} />
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mt-5 mb-2">Example Response</h4>
              <CodeBlock code={`{
  "status": "success",
  "message": "Balance retrieved successfully",
  "balance": {
    "available": "250.00",
    "currency": "GHS"
  }
}`} />
            </Section>

            <Section id="webhooks" title="Webhooks">
              <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
                <p>
                  Webhooks allow our platform to proactively notify your server when an order status changes, eliminating the need for polling. Webhook support is available on request — contact support to configure a webhook URL for your API account.
                </p>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Payload Format</h4>
                <p>When an order is delivered or fails, we will send a <code className="font-mono">POST</code> request to your webhook URL with the following payload:</p>
                <CodeBlock code={`{
  "event": "order.delivered",
  "order": {
    "reference": "API-20260617-3A9F2B1C",
    "status": "delivered",
    "recipient_number": "0241234567",
    "package": {
      "id": "prod_001",
      "name": "MTN 1GB Data Bundle",
      "network": "MTN"
    },
    "total": "12.00",
    "delivered_at": "2026-06-17T10:25:12.000Z"
  }
}`} />
                <p>Event types: <code className="font-mono text-violet-700 dark:text-violet-400">order.delivered</code>, <code className="font-mono text-violet-700 dark:text-violet-400">order.failed</code>.</p>
                <p>Your webhook endpoint must respond with HTTP <code className="font-mono">200 OK</code> within 5 seconds. If delivery fails, we will retry up to 3 times with exponential backoff.</p>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-950/30">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">Security</div>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    Validate webhook payloads using the shared secret header <code className="font-mono">x-webhook-signature</code>. Contact support for your webhook secret.
                  </p>
                </div>
              </div>
            </Section>

            <Section id="changelog" title="Changelog">
              <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
                <div className="flex items-start gap-4">
                  <div className="text-xs font-mono text-zinc-400 mt-0.5 shrink-0 w-24">2026-06-17</div>
                  <div>
                    <div className="font-semibold text-zinc-900 dark:text-white">v1.0.0 — Initial Release</div>
                    <ul className="mt-1 space-y-1 list-disc list-inside text-zinc-600 dark:text-zinc-400">
                      <li>GET /networks — list available networks</li>
                      <li>GET /packages — list data bundle packages</li>
                      <li>POST /orders — place an order</li>
                      <li>GET /orders/:reference — check order status</li>
                      <li>GET /balance — retrieve wallet balance</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Section>

            <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800">
              <p className="text-xs text-zinc-400">
                Need help? Contact our support team or{" "}
                <Link href="/dashboard?tab=api-access" className="text-blue-600 underline dark:text-blue-400">
                  request API access
                </Link>
                .
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
