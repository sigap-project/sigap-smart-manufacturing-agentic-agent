import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SETTINGS, SettingsState } from "@/components/settings/types";

// Helper formatter untuk menghasilkan response JSON yang cocok 100% dengan SettingsState frontend
function formatSettings(setting: any): SettingsState & { id: string; updatedAt: string } {
  return {
    id: setting.id || "default",
    simulationMode: setting.mockMode ?? true,
    cameraSource: (setting.cameraSource as "mock" | "rtsp") || "mock",
    rtspUrl: setting.rtspUrl || "rtsp://192.168.1.120:8554/live/station-01",
    hardwareStatus: "connected",

    confidenceThreshold: Math.round(setting.detectionConfidenceThreshold ?? 85),
    escalationWindow: setting.escalationWindowMinutes ?? 8,
    triggerCount: setting.escalationCountTrigger ?? 3,

    monitoredProducts:
      Array.isArray(setting.monitoredProducts) && setting.monitoredProducts.length > 0
        ? setting.monitoredProducts
        : [
            "Bracket Motor A7",
            "Gearbox Housing C2",
            "Flange Pinion X1",
            "Rotor Casing D4",
          ],

    autoSaveBatchBoard: setting.autoStoreEnabled ?? true,
    autoDispatchMode:
      (setting.autoDispatchMode as "autonomous" | "human_approval") || "autonomous",
    approvalTimeout: setting.approvalSlaMinutes ?? 15,

    autoExportCsv: setting.autoExportCsv ?? true,
    logRetention: String(setting.logRetentionDays ?? 30) as "7" | "14" | "30",
    updatedAt: setting.updatedAt ? new Date(setting.updatedAt).toISOString() : new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// GET /api/settings
// Mengambil konfigurasi aktif sistem. Jika belum ada di DB, otomatis membuat default.
// -----------------------------------------------------------------------------
export async function GET() {
  try {
    let setting = await prisma.setting.findUnique({
      where: { id: "default" },
    });

    // Buat default row di PostgreSQL jika belum tersedia
    if (!setting) {
      setting = await prisma.setting.create({
        data: {
          id: "default",
          detectionConfidenceThreshold: DEFAULT_SETTINGS.confidenceThreshold,
          escalationWindowMinutes: DEFAULT_SETTINGS.escalationWindow,
          escalationCountTrigger: DEFAULT_SETTINGS.triggerCount,
          autoStoreEnabled: DEFAULT_SETTINGS.autoSaveBatchBoard,
          autoDispatchMode: DEFAULT_SETTINGS.autoDispatchMode,
          approvalSlaMinutes: DEFAULT_SETTINGS.approvalTimeout,
          mockMode: DEFAULT_SETTINGS.simulationMode,
          cameraSource: DEFAULT_SETTINGS.cameraSource,
          rtspUrl: DEFAULT_SETTINGS.rtspUrl,
          autoExportCsv: DEFAULT_SETTINGS.autoExportCsv,
          logRetentionDays: parseInt(DEFAULT_SETTINGS.logRetention, 10) || 30,
          monitoredProducts: DEFAULT_SETTINGS.monitoredProducts,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: formatSettings(setting),
      source: "database",
    });
  } catch (error) {
    console.warn("Koneksi DB settings offline, menggunakan fallback data lokal:", error);
    return NextResponse.json({
      success: true,
      data: { ...DEFAULT_SETTINGS, id: "default", updatedAt: new Date().toISOString() },
      source: "mock_fallback",
      error: error instanceof Error ? error.message : "Database connection error",
    });
  }
}

// -----------------------------------------------------------------------------
// PUT /api/settings
// Memperbarui baris konfigurasi global dengan nilai yang dikirim dari UI
// -----------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const updated = await prisma.setting.upsert({
      where: { id: "default" },
      update: {
        detectionConfidenceThreshold:
          body.confidenceThreshold !== undefined
            ? parseFloat(body.confidenceThreshold)
            : body.detectionConfidenceThreshold !== undefined
            ? parseFloat(body.detectionConfidenceThreshold)
            : undefined,
        escalationWindowMinutes:
          body.escalationWindow !== undefined
            ? parseInt(body.escalationWindow, 10)
            : body.escalationWindowMinutes !== undefined
            ? parseInt(body.escalationWindowMinutes, 10)
            : undefined,
        escalationCountTrigger:
          body.triggerCount !== undefined
            ? parseInt(body.triggerCount, 10)
            : body.escalationCountTrigger !== undefined
            ? parseInt(body.escalationCountTrigger, 10)
            : undefined,
        autoStoreEnabled:
          body.autoSaveBatchBoard !== undefined
            ? Boolean(body.autoSaveBatchBoard)
            : body.autoStoreEnabled !== undefined
            ? Boolean(body.autoStoreEnabled)
            : undefined,
        autoDispatchMode: body.autoDispatchMode,
        approvalSlaMinutes:
          body.approvalTimeout !== undefined
            ? parseInt(body.approvalTimeout, 10)
            : body.approvalSlaMinutes !== undefined
            ? parseInt(body.approvalSlaMinutes, 10)
            : undefined,
        mockMode:
          body.simulationMode !== undefined
            ? Boolean(body.simulationMode)
            : body.mockMode !== undefined
            ? Boolean(body.mockMode)
            : undefined,
        cameraSource: body.cameraSource,
        rtspUrl: body.rtspUrl,
        autoExportCsv:
          body.autoExportCsv !== undefined
            ? Boolean(body.autoExportCsv)
            : undefined,
        logRetentionDays:
          body.logRetention !== undefined
            ? parseInt(body.logRetention, 10)
            : body.logRetentionDays !== undefined
            ? parseInt(body.logRetentionDays, 10)
            : undefined,
        monitoredProducts:
          Array.isArray(body.monitoredProducts)
            ? body.monitoredProducts
            : undefined,
      },
      create: {
        id: "default",
        detectionConfidenceThreshold:
          body.confidenceThreshold ?? DEFAULT_SETTINGS.confidenceThreshold,
        escalationWindowMinutes:
          body.escalationWindow ?? DEFAULT_SETTINGS.escalationWindow,
        escalationCountTrigger:
          body.triggerCount ?? DEFAULT_SETTINGS.triggerCount,
        autoStoreEnabled:
          body.autoSaveBatchBoard ?? DEFAULT_SETTINGS.autoSaveBatchBoard,
        autoDispatchMode:
          body.autoDispatchMode ?? DEFAULT_SETTINGS.autoDispatchMode,
        approvalSlaMinutes:
          body.approvalTimeout ?? DEFAULT_SETTINGS.approvalTimeout,
        mockMode:
          body.simulationMode ?? DEFAULT_SETTINGS.simulationMode,
        cameraSource:
          body.cameraSource ?? DEFAULT_SETTINGS.cameraSource,
        rtspUrl:
          body.rtspUrl ?? DEFAULT_SETTINGS.rtspUrl,
        autoExportCsv:
          body.autoExportCsv ?? DEFAULT_SETTINGS.autoExportCsv,
        logRetentionDays:
          body.logRetention
            ? parseInt(body.logRetention, 10)
            : 30,
        monitoredProducts:
          body.monitoredProducts ?? DEFAULT_SETTINGS.monitoredProducts,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Pengaturan sistem berhasil diperbarui dan diterapkan ke runtime.",
      data: formatSettings(updated),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal menyimpan konfigurasi pengaturan",
      },
      { status: 500 }
    );
  }
}

// POST alias untuk kompatibilitas
export async function POST(request: NextRequest) {
  return PUT(request);
}
