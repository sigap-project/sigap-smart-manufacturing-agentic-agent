export type DefectClass = 
  | "DEFECT"
  | "OK"
  | "defect"
  | "ok"
  | "def_front"
  | "ok_front";

export type DefectSeverity = "low" | "medium" | "high";

export type BatchStatus = "pending_review" | "pending" | "held" | "released" | "rejected";

export type DispatchConsumer = "SAP_QM" | "SAP_MM" | "SAP_PP" | "Human_Notification";

export interface AgentReasoningStep {
  step: number;
  stepName: string;
  title: string;
  status: "idle" | "analyzing" | "completed" | "flagged";
  description: string;
  timestamp: string;
  telemetry?: {
    label: string;
    value: string | number;
  }[];
}

export interface DefectDetection {
  id: string;
  className: DefectClass;
  displayName: string;
  confidence: number;
  box: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface LiveInspectionItem {
  id: string;
  lotId: string;
  partName: string;
  timestamp: string;
  fps: number;
  latencyMs: number;
  defectDetected: boolean;
  detections: DefectDetection[];
  escalationScore: number;
}
