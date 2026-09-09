---
name: sigap-backend-prisma
description: "Backend architecture for SIGAP: Prisma 6 ORM with PostgreSQL (Neon), Next.js 15 App Router Route Handlers, Server-Sent Events (SSE) streaming (/api/events), and internal edge agent webhooks."
---

# SIGAP: Backend & Database Architecture

Panduan arsitektur backend Next.js 15 App Router, Prisma ORM v6, basis data PostgreSQL (Neon Serverless), dan mekanisme Server-Sent Events (SSE) untuk platform **SIGAP**.

---

## 1. Arsitektur Komponen Backend

```
   [Kamera YOLOv8 / Edge Vision]       [AWS Bedrock Agent]
                 │                              │
                 │ POST (x-api-key)             │ POST (Bearer Token)
                 ▼                              ▼
      /api/internal/inspection-result    /api/internal/agent-decision
                 │                              │
                 └──────────────┬───────────────┘
                                ▼
                    ┌───────────────────────┐
                    │ Next.js Route Handler │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌──────────────────┐                         ┌────────────────────┐
│ Neon Postgres DB │                         │ SSE Event Streamer │
│  (Prisma 6 ORM)  │                         │    (/api/events)   │
└──────────────────┘                         └─────────┬──────────┘
                                                       │ Live Stream
                                                       ▼
                                             React 19 Dashboard UI
```

---

## 2. Skema Entitas Prisma (`prisma/schema.prisma`)

### A. `Batch` (Lot Produksi Manufaktur)
- **Field Kunci**: `lotId` (unique, e.g. `#B-2026-0730`), `productType`, `supplierName`, `inspectionCount`, `defectCount`, `escalationScore`, `status` (`pending`, `held`, `released`, `rejected`), `storageZone` (`standard`, `quarantine`), `pendingApproval`, `slaSeconds`.
- **Relasi**: 1-to-many ke `Inspection` dan `DispatchRecord`.

### B. `Inspection` (Frame Kamera Optik Konveyor)
- **Field Kunci**: `batchId`, `imageUrl`, `defectDetected`, `defectClass`, `confidence`, `severity`, `agentReasoningTrace` (JSON array), `status`.
- **Relasi**: Belongs to `Batch`, 1-to-many ke `AgentLog`.

### C. `DispatchRecord` (Integrasi Outbound SAP ERP)
- **Field Kunci**: `batchId`, `triggerReason`, `consumer` (`SAP QM`, `SAP MM`, `SAP PP`, `Human Notification`), `payload` (JSON), `status` (`Dispatched`, `Pending Approval`, `Rejected`), `sapTicketId`.
- **Relasi**: Belongs to `Batch`.

### D. `AgentLog` (Audit Log Langkah Penalaran AI)
- **Field Kunci**: `inspectionId`, `step` (`01`–`05`), `stepName` (`DETECT`, `MEMORY`, `FORMULA`, `DECISION`, `DISPATCH`), `input`, `output`, `decision`, `latencyMs`.

### E. `Setting` (Konfigurasi Runtime & Ambang Batas AI)
- **Field Kunci**: `detectionConfidenceThreshold` (default 85%), `escalationWindowMinutes` (default 8m), `escalationCountTrigger` (default 3), `autoDispatchMode` (`autonomous` | `human_approval`), `mockMode`, `rtspUrl`.

---

## 3. Real-Time Streaming: Server-Sent Events (SSE)

SIGAP menggunakan Server-Sent Events di `/api/events` untuk mendorong telemetri langsung tanpa beban koneksi bidirectional WebSocket:

```typescript
// Header standar SSE pada Next.js Route Handler
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // Mencegah buffering pada reverse proxy (Nginx/Vercel)
  },
});
```

### Event Payload Format:
- `inspection_created`: Data frame inspeksi baru + hasil inferensi deteksi.
- `batch_updated`: Perubahan status batch (misal: masuk zona karantina).
- `dispatch_created`: Tiket mutasi baru ke SAP.
- `heartbeat`: Ping berkala (tiap 15 detik) untuk menjaga koneksi tetap hidup.

---

## 4. Keamanan & Verifikasi Webhook Internal

Route internal tidak boleh diakses sembarang klien publik:

1. **Edge Camera Ingestion** (`/api/internal/inspection-result`):
   - Wajib memverifikasi header `x-api-key: process.env.EDGE_CAMERA_API_KEY`.
2. **Agent Reasoning Ingestion** (`/api/internal/agent-decision`):
   - Wajib memverifikasi header `Authorization: Bearer process.env.AGENT_SECRET_KEY`.
3. **Pemberian Respons Konsisten**:
   - Jika kunci salah/tidak ada: Return HTTP 401 Unauthorized dengan JSON `{ error: "Unauthorized access" }`.

---

## 5. Pola Prisma Client Singleton (`lib/prisma.ts`)

Untuk mencegah kehabisan koneksi PostgreSQL (*connection pool exhaustion*) saat hot-reload di Next.js:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```
