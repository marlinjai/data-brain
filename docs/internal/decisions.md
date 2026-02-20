---
title: Architecture Decisions
description: Key technical decisions and rationale
order: 2
---

# Architecture Decisions

Key technical decisions made during Data Brain development, with rationale for each choice.

## Why Hono

**Decision:** Use Hono as the API framework.

**Rationale:**
- **Lightweight** -- Minimal bundle size, built for edge runtimes
- **Cloudflare Workers native** -- First-class support, no compatibility shims needed
- **Middleware support** -- Clean middleware pattern for auth, error handling, CORS
- **TypeScript-first** -- Full type inference for routes, context, and environment bindings
- **Familiar API** -- Express-like routing with modern ergonomics

**Alternatives considered:** itty-router (too minimal), Express (not edge-compatible), raw fetch handler (no middleware support).

## Why D1Adapter Internally

**Decision:** Reuse the existing `@marlinjai/data-table-adapter-d1` inside the API worker.

**Rationale:**
- **Code reuse** -- The D1Adapter already implements all 43 DatabaseAdapter methods with tested SQL
- **Consistency** -- Same adapter used by apps that run D1 directly, ensuring identical behavior
- **Maintenance** -- Bug fixes and features in the adapter benefit both direct and API usage
- **No abstraction gap** -- The API is a thin HTTP layer over the adapter, not a reimplementation

**Trade-off:** The adapter creates a new instance per request (stateless), which is acceptable for Cloudflare Workers where each request is isolated.

## Why Tenant Isolation via API Key Hash

**Decision:** Authenticate tenants by SHA-256 hashing the API key and looking up the hash in D1.

**Rationale:**
- **Stateless** -- No session management, tokens, or refresh flows
- **Simple** -- One middleware, one database lookup per request
- **Secure** -- Plaintext keys never stored; hashes are non-reversible
- **Fast** -- SHA-256 via Web Crypto API is sub-millisecond, suitable for per-request auth

**Why not bcrypt?** Bcrypt is designed for password hashing with intentional slowness. For API key auth where we need per-request lookup, SHA-256 is fast enough and the keys are high-entropy (48 hex characters), making brute force infeasible.

**Why not JWT?** JWTs add complexity (signing keys, expiration, refresh tokens) without clear benefit for server-to-server API key auth. Can be added later for user-facing auth.

## Why No Batch Endpoint Yet

**Decision:** Disable the batch RPC endpoint in v0.1.0.

**Rationale:**
- The batch endpoint calls adapter methods directly without per-operation ownership verification
- Each operation in a batch could reference resources from different tables, requiring individual ownership checks
- Enabling it without proper isolation would allow a tenant to potentially access another tenant's resources in a single batch
- The endpoint exists in code but is commented out with a security note (issue I3)

**Plan:** Re-enable after implementing per-operation tenant isolation within the batch handler.

## Why SHA-256 for API Key Hashing

**Decision:** Use SHA-256 (Web Crypto API) instead of bcrypt for hashing API keys.

**Rationale:**
- **Performance** -- SHA-256 is sub-millisecond via `crypto.subtle.digest`, while bcrypt takes 100-300ms per hash
- **Per-request requirement** -- Every API request hashes the key for lookup; bcrypt's intentional slowness would add unacceptable latency
- **Key entropy** -- API keys are 48 hex characters (192 bits of entropy), making rainbow tables and brute force infeasible even with a fast hash
- **Web Crypto availability** -- `crypto.subtle` is natively available in Cloudflare Workers, no external dependencies needed

**Trade-off:** If API keys were low-entropy (like user passwords), SHA-256 would be insufficient. For high-entropy generated keys, it provides adequate security.

## Why Separate SDK from Adapter

**Decision:** Publish the SDK (`@marlinjai/data-brain-sdk`) separately from the Data Table adapter (`@marlinjai/data-table-adapter-data-brain`).

**Rationale:**
- **Different audiences** -- The SDK is a generic HTTP client for any app; the adapter implements the `DatabaseAdapter` interface for `@marlinjai/data-table-react`
- **Different dependencies** -- The SDK has zero dependencies; the adapter depends on `@marlinjai/data-table-core`
- **Composability** -- Apps that don't use Data Table can use the SDK directly without pulling in the adapter

**Relationship:**
- `DataBrain` (SDK) -- Generic HTTP client with typed methods
- `DataBrainAdapter` (adapter) -- Wraps `DataBrain` to implement the `DatabaseAdapter` interface

---

## Summary

All decisions prioritize **simplicity and correctness for v0.1.0** while maintaining flexibility to evolve. The architecture is:

1. **Edge-native** -- Cloudflare Workers + D1, sub-50ms global latency
2. **Secure** -- Per-request auth, ownership verification, timing-safe admin comparison
3. **Type-safe** -- Full TypeScript coverage from SDK to database
4. **Reusable** -- Built on the same D1Adapter used by direct integrations
5. **Extensible** -- Batch endpoint, JWT auth, and self-service signup can be added later
