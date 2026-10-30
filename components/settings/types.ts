export interface SettingsState {
  // Section 1: Hardware
  simulationMode: boolean;
  cameraSource: "mock" | "rtsp";
  rtspUrl: string;
  hardwareStatus: "connected" | "testing" | "disconnected";

  // Section 2: AI Model
  confidenceThreshold: number; // 50 - 95
  escalationWindow: number; // 2 - 30 minutes
  triggerCount: number; // e.g. 3
  monitoredProducts: string[];

  // Section 3: Agent Autonomy
  autoSaveBatchBoard: boolean;
  autoDispatchMode: "autonomous" | "human_approval";
  approvalTimeout: number; // in minutes
  customerProfile: "domestic_grade_ab" | "export_zero_defect";

  // Section 4: Export & Log
  autoExportCsv: boolean;
  logRetention: "7" | "14" | "30";
}

export const ALL_PRODUCTS = [
  "Bracket Motor A7",
  "Gearbox Housing C2",
  "Flange Pinion X1",
  "Rotor Casing D4",
  "Piston Base Ring 55",
];

export const DEFAULT_SETTINGS: SettingsState = {
  simulationMode: true,
  cameraSource: "mock",
  rtspUrl: "rtsp://192.168.1.120:8554/live/station-01",
  hardwareStatus: "connected",

  confidenceThreshold: 85,
  escalationWindow: 8,
  triggerCount: 3,
  monitoredProducts: [
    "Bracket Motor A7",
    "Gearbox Housing C2",
    "Flange Pinion X1",
    "Rotor Casing D4",
  ],

  autoSaveBatchBoard: true,
  autoDispatchMode: "autonomous",
  approvalTimeout: 15,
  customerProfile: "domestic_grade_ab",

  autoExportCsv: true,
  logRetention: "30",
};
