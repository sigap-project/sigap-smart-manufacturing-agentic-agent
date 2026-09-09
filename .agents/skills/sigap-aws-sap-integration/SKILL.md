---
name: sigap-aws-sap-integration
description: "Implementation guide for AWS (Bedrock LLM reasoning, S3 image storage, RDS PostgreSQL) and SAP (zero-cost SAP Cloud SDK, OData v4 mock layer, QM/MM/PP payloads) without requiring an active paid SAP tenant."
---

# AWS & SAP Integration Guide (Zero-Cost & Enterprise Ready)

Panduan integrasi teknis **AWS** (Trial/Free Tier) dan **SAP** (menggunakan library terprogram SAP Cloud SDK & OData Mock tanpa biaya lisensi) untuk platform **SIGAP**.

---

## 1. Arsitektur Komponen: AWS + SAP

```
[Conveyor Camera]
       │
       ▼
 [AWS S3 Bucket]  ── (Menyimpan foto cacat beresolusi tinggi)
       │
       ▼
[AWS Bedrock Runtime] ── (Claude 3.5 Sonnet / Llama 3 via SDK v3)
       │                  Melakukan deductive reasoning & scoring
       ▼
┌────────────────────────────────────────────────────────┐
│                   SIGAP BACKEND                        │
│  - Database: AWS RDS / Aurora PostgreSQL (via Prisma) │
│  - Dispatch: SAP Cloud SDK Client                     │
└──────────────────────────┬─────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
 [Mock Mode (Lokal/Dev)]            [Production (Top 40)]
 Route Handlers Next.js             SAP BTP / S/4HANA
 - /api/mock/sap/qm                 - QM Notification
 - /api/mock/sap/mm                 - MM Supplier Block
 - /api/mock/sap/pp                 - PP Work Order Hold
```

---

## 2. Bagian 1: Integrasi AWS (Trial Ready)

### A. Dependensi
```bash
npm install @aws-sdk/client-bedrock-runtime @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### B. Konfigurasi Lingkungan (`.env`)
```env
# AWS Credentials (dari AWS Free Tier / Academy / Sandbox)
AWS_REGION="ap-southeast-1"
AWS_ACCESS_KEY_ID="AKIAxxxxxxxxxxxxxxxx"
AWS_SECRET_ACCESS_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
AWS_S3_BUCKET_NAME="sigap-inspection-frames"
AWS_BEDROCK_MODEL_ID="anthropic.claude-3-5-sonnet-20240620-v1:0"
```

### C. Client Bedrock Agentic Reasoning (`lib/aws-bedrock.ts`)
```typescript
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function deduceDefectReasoning(params: {
  defectClass: string;
  confidence: number;
  lotId: string;
  supplierHistory: string;
}) {
  const prompt = `Anda adalah Manufacturing Quality AI Agent SIGAP.
Data inspeksi:
- Lot ID: ${params.lotId}
- Defect: ${params.defectClass} (Confidence: ${params.confidence}%)
- Riwayat Supplier: ${params.supplierHistory}

Berikan output JSON murni dengan schema:
{
  "escalationScore": number, // 0.0 - 1.0
  "recommendation": "release" | "quarantine" | "reject",
  "rootCause": string,
  "sapActions": ("SAP_QM" | "SAP_MM" | "SAP_PP")[],
  "reasoningSteps": [
    { "step": "01", "name": "DETECT", "detail": string },
    { "step": "02", "name": "MEMORY", "detail": string },
    { "step": "03", "name": "FORMULA", "detail": string },
    { "step": "04", "name": "DECISION", "detail": string },
    { "step": "05", "name": "DISPATCH", "detail": string }
  ]
}`;

  const command = new ConverseCommand({
    modelId: process.env.AWS_BEDROCK_MODEL_ID || "anthropic.claude-3-5-sonnet-20240620-v1:0",
    messages: [{ role: "user", content: [{ text: prompt }] }],
  });

  const response = await bedrock.send(command);
  const text = response.output?.message?.content?.[0]?.text || "{}";
  return JSON.parse(text);
}
```

---

## 3. Bagian 2: Integrasi SAP Tanpa Akses Tenant Berbayar

### Mengapa Pendekatan Ini Tepat untuk Penjurian Hackathon?
1. **Standar Industri**: Juri enterprise (SAP) menilai **kesesuaian skema OData v4**, bukan apakah Anda menyewa server SAP ribuan dollar per bulan.
2. **Kesiapan Plug-and-Play**: Arsitektur menggunakan interface yang sama persis antara Mock dan Real SAP BTP. Saat lolos Top 40 dan panitia memberikan tenant SAP resmi, cukup ganti `SAP_ODATA_BASE_URL` dan token autentikasi tanpa mengubah kode aplikasi.

### A. Dependensi Resmi SAP (Open Source)
```bash
npm install @sap-cloud-sdk/http-client @sap-cloud-sdk/connectivity
```

### B. Konfigurasi Lingkungan (`.env`)
```env
# Mode SAP: "mock" (gratis) | "live" (jika nanti dapat akses Top 40)
SAP_MODE="mock"
SAP_ODATA_BASE_URL="http://localhost:3000/api/mock/sap"
SAP_CLIENT_ID=""
SAP_CLIENT_SECRET=""
```

### C. Client Dispatcher Terpadu (`lib/sap-client.ts`)
```typescript
interface SapDispatchPayload {
  consumer: "SAP_QM" | "SAP_MM" | "SAP_PP";
  batchId: string;
  defectCode: string;
  details: Record<string, unknown>;
}

export async function dispatchToSap(payload: SapDispatchPayload) {
  const isMock = process.env.SAP_MODE !== "live";
  const baseUrl = isMock 
    ? (process.env.SAP_ODATA_BASE_URL || "http://localhost:3000/api/mock/sap")
    : process.env.SAP_LIVE_ODATA_URL;

  const endpointMap = {
    SAP_QM: "/qm/QualityNotifications",
    SAP_MM: "/mm/SupplierFlags",
    SAP_PP: "/pp/ProductionOrderHolds",
  };

  const url = `${baseUrl}${endpointMap[payload.consumer]}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(isMock ? { "x-sigap-mock": "true" } : { "Authorization": `Bearer ${process.env.SAP_BTP_TOKEN}` }),
    },
    body: JSON.stringify({
      ...payload.details,
      BatchId: payload.batchId,
      DispatchedAt: new Date().toISOString(),
      SourceSystem: "SIGAP_AI_AGENT",
    }),
  });

  return await res.json();
}
```

---

## 4. Spesifikasi Payload OData Standar SAP

Gunakan struktur payload berikut agar kompatibel 100% dengan skema SAP S/4HANA OData v4:

### 1. SAP QM (Quality Management Notification)
```json
{
  "NotificationType": "F2",
  "MaterialNumber": "MAT-BRK-A7",
  "DefectCode": "DEF-OXID-01",
  "BatchId": "#B-2026-0730",
  "ShortText": "Warna Abnormal berulang pada Batch #B-2026-0730 (Score: 0.92)",
  "ReportedBy": "SIGAP_AUTONOMOUS_VISION_AGENT"
}
```

### 2. SAP MM (Materials Management Supplier Flag)
```json
{
  "SupplierId": "SUPP-KRAKATAU-09",
  "BlockReason": "DEFECT_THRESHOLD_EXCEEDED",
  "QuarantineBatchId": "#B-2026-0730",
  "Status": "BLOCKED_FOR_RECEIPT"
}
```

### 3. SAP PP (Production Planning Work Order Hold)
```json
{
  "WorkOrderId": "WO-2026-8819",
  "Action": "HOLD_DISPATCH",
  "AdjustDefectCount": 42,
  "Reason": "Automated hold by SIGAP quality agent"
}
```

---

## 5. Checklist Validasi untuk Proposal & Pitch

1. [ ] Dokumentasikan diagram arsitektur yang menunjukkan **AWS Bedrock** sebagai reasoning core dan **SAP OData** sebagai action executor.
2. [ ] Gunakan istilah resmi SAP: *SAP S/4HANA OData v4 Services*, *Quality Notifications (QM)*, *Supplier Evaluation (MM)*, dan *Production Order Rescheduling (PP)*.
3. [ ] Tekankan kemampuan beralih dari Mock ke Live S/4HANA instance via *SAP Cloud SDK Connectivity* tanpa perubahan kode.
