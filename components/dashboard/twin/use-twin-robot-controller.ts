"use client";

import { useEffect, useRef } from "react";

export type TwinState = "idle" | "scanning" | "ok" | "defect";

interface StationConfig {
  pos: [number, number, number];
  yaw: number; // in degrees
  label: string;
}

export const TWIN_STATIONS: Record<TwinState, StationConfig> = {
  idle:     { pos: [110, 14, 410], yaw: 45,  label: "Standby at AI Station" },
  scanning: { pos: [-10,  0,   0], yaw: -90, label: "Optical Inspection on Conveyor" },
  ok:       { pos: [140, 14,-220], yaw: 45,  label: "Verified OK at Release Container" },
  defect:   { pos: [140, 14, 110], yaw: 20,  label: "Alert Quarantine at Defect Container" },
};

function planRoute(fromPos: [number, number, number], toState: TwinState): [number, number, number][] {
  const toPos = TWIN_STATIONS[toState].pos;
  const pts: [number, number, number][] = [];

  // 1. Step out from platform onto floor Y = 0 at corridor X = 20
  if (Math.abs(fromPos[0] - 20) > 6) {
    pts.push([20, 0, fromPos[2]]);
  }
  // 2. Travel along corridor at floor level Y = 0 to target Z
  pts.push([20, 0, toPos[2]]);
  // 3. Step into target station at target Y
  pts.push([toPos[0], toPos[1], toPos[2]]);
  return pts;
}

const DEG2RAD = Math.PI / 180;

interface MeshMaterialState {
  mesh: any;
  colorHex: string;
  emissiveHex: string;
  emissiveIntensity: number;
}

const RGB_CACHE = new Map<string, { r: number; g: number; b: number }>();

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let cached = RGB_CACHE.get(hex);
  if (cached) return cached;
  let c = hex.replace(/^#/, "");
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const num = parseInt(c, 16);
  cached = {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
  RGB_CACHE.set(hex, cached);
  return cached;
}

function applyMaterialColor(mesh: any, colorHex: string, emissiveHex?: string, emissiveIntensity: number = 0) {
  if (!mesh || !mesh.material) return;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const rgb = hexToRgb(colorHex);

  for (const mat of mats) {
    if (!mat) continue;

    // Standard Three.js material
    if (mat.color && typeof mat.color.set === "function") {
      try { mat.color.set(colorHex); } catch {}
    }
    if (mat.colorNode?.value && typeof mat.colorNode.value.set === "function") {
      try { mat.colorNode.value.set(colorHex); } catch {}
    }
    if (emissiveHex && emissiveIntensity > 0 && mat.emissive && typeof mat.emissive.set === "function") {
      try {
        mat.emissive.set(emissiveHex);
        if (typeof mat.emissiveIntensity === "number") {
          mat.emissiveIntensity = emissiveIntensity;
        }
      } catch {}
    } else if (mat.emissive && typeof mat.emissive.set === "function") {
      try {
        mat.emissive.set("#000000");
        if (typeof mat.emissiveIntensity === "number") {
          mat.emissiveIntensity = 0;
        }
      } catch {}
    }

    // Spline NodeMaterial layers & uniform bindings (for container boxes and diorama meshes)
    if (mat.layers && Array.isArray(mat.layers)) {
      for (const layer of mat.layers) {
        if (layer.type === "color") {
          if (layer.params?.uniforms) {
            for (const key of Object.keys(layer.params.uniforms)) {
              const u = layer.params.uniforms[key];
              if (u && u.value && (u.value.isColor || key.toLowerCase().includes("color"))) {
                if (typeof u.value.set === "function") {
                  try { u.value.set(colorHex); } catch {}
                } else if (typeof u.value === "object") {
                  u.value.r = rgb.r;
                  u.value.g = rgb.g;
                  u.value.b = rgb.b;
                }
              }
            }
          }
          if (layer.data?.color) {
            layer.data.color.r = rgb.r;
            layer.data.color.g = rgb.g;
            layer.data.color.b = rgb.b;
          }
        } else if (layer.type === "light") {
          const emU = layer.params?.uniforms?.f0_emissive;
          if (emU && emU.value) {
            if (emissiveIntensity > 0 && emissiveHex) {
              const emRgb = hexToRgb(emissiveHex);
              emU.value.r = emRgb.r * emissiveIntensity;
              emU.value.g = emRgb.g * emissiveIntensity;
              emU.value.b = emRgb.b * emissiveIntensity;
            } else {
              emU.value.r = 0;
              emU.value.g = 0;
              emU.value.b = 0;
            }
          }
        }
      }
    }
  }
}

export function useTwinRobotController(
  splineApp: any,
  systemState: TwinState,
  isVisible: boolean = true
) {
  const animFrameRef = useRef<number | null>(null);
  const curPosRef = useRef<[number, number, number]>([110, 14, 410]);
  const curYawRef = useRef<number>(45);
  const isMovingRef = useRef<boolean>(false);
  const waypointsRef = useRef<[number, number, number][]>([]);
  const waypointIdxRef = useRef<number>(0);
  const targetStateRef = useRef<TwinState>(systemState);
  const currentStateRef = useRef<TwinState>(systemState);
  const stridePhaseRef = useRef<number>(0);
  const wheelRotRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const lastAntennaColorRef = useRef<string>("");
  const lastContainerStateRef = useRef<string>("neutral");
  const lastEyeScanningRef = useRef<boolean>(false);

  // Smooth interpolated angles (exponential lerp to prevent snap/stiff freeze)
  const curTorsoLeanRef = useRef<number>(0);
  const curTorsoSwayRef = useRef<number>(0);
  const curHeadTiltRef = useRef<number>(0);
  const curLegRRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const curLegLRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const curArmRRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const curArmLRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const curShieldScaleRef = useRef<number>(systemState === "ok" ? 1.0 : systemState === "defect" ? 1.1 : 0.0);

  // Cached object references in Spline scene
  const sceneObjectsRef = useRef<{
    root?: any;
    body?: any;
    head?: any;
    legR?: any;
    legL?: any;
    armR?: any;
    armL?: any;
    wheelR?: any;
    wheelL?: any;
    shield?: any;
    shieldFrame?: any;
    laser?: any;
    symbolHazard?: any;
    symbolCheckLong?: any;
    symbolCheckShort?: any;
    antennaOrb?: any;
    alertLight?: any;
    eyeLens?: any;
    eyePupil?: any;
    eyeSparkle?: any;
    releaseBoxMeshes: any[];
    defectBoxMeshes: any[];
    origReleaseMats: MeshMaterialState[];
    origDefectMats: MeshMaterialState[];
    origEyeMats: MeshMaterialState[];
    releaseRoof?: any;
    defectRoof?: any;
    releaseZone?: any;
    defectZone?: any;
  }>({
    releaseBoxMeshes: [],
    defectBoxMeshes: [],
    origReleaseMats: [],
    origDefectMats: [],
    origEyeMats: [],
  });

  // Bind scene objects when splineApp is ready
  useEffect(() => {
    if (!splineApp) return;

    const scene = splineApp._scene;
    const findObj = (name: string) => {
      if (scene && typeof scene.traverse === "function") {
        let found: any = null;
        scene.traverse((o: any) => {
          if (o.name === name) found = o;
        });
        if (found) return found;
      }
      if (typeof splineApp.findObjectByName === "function") {
        return splineApp.findObjectByName(name);
      }
      return null;
    };

    const foundRoot =
      findObj("SIGAP_Robot_Mascot") ||
      splineApp.findObjectById?.("7a74f02d-e563-420e-8731-2e9e4f5a0b99") ||
      (typeof splineApp.getAllObjects === "function" &&
        splineApp.getAllObjects().find((o: any) => o.name?.includes("Robot") || o.name?.includes("Mascot")));

    if (foundRoot) {
      if (typeof foundRoot.traverse === "function") {
        foundRoot.traverse((child: any) => {
          child.matrixAutoUpdate = true;
        });
      }
      foundRoot.matrixAutoUpdate = true;
    }

    const laserObj = findObj("Scan Beam") || findObj("Mascot_Scan_Laser");
    if (laserObj) laserObj.matrixAutoUpdate = true;

    const releaseNames = [
      "Release Main Shell",
      "Release Roof Cap",
      "Release Door Right",
      "Release Door Left",
      "Release HVAC Pack",
    ];
    const releaseBoxMeshes = releaseNames.map(findObj).filter(Boolean);

    const defectNames = [
      "Defect Main Shell",
      "Defect Roof Cap",
      "Defect Door Right",
      "Defect Door Left",
      "Defect HVAC Pack",
    ];
    const defectBoxMeshes = defectNames.map(findObj).filter(Boolean);

    const eyeLens = findObj("Mascot_Eye_Lens");
    const eyePupil = findObj("Mascot_Eye_Pupil");
    const eyeSparkle = findObj("Mascot_Eye_Sparkle");

    const CONTAINER_BASE_COLORS: Record<string, string> = {
      "Release Main Shell": "#F1F5F9",
      "Release Roof Cap":   "#F1F5F9",
      "Release Door Right": "#334155",
      "Release Door Left":  "#334155",
      "Release HVAC Pack":  "#94A3B8",
      "Defect Main Shell":  "#F1F5F9",
      "Defect Roof Cap":    "#F1F5F9",
      "Defect Door Right":  "#334155",
      "Defect Door Left":   "#334155",
      "Defect HVAC Pack":   "#94A3B8",
    };

    const origReleaseMats: MeshMaterialState[] = releaseBoxMeshes.map((m) => ({
      mesh: m,
      colorHex: CONTAINER_BASE_COLORS[m.name] || "#F1F5F9",
      emissiveHex: "#000000",
      emissiveIntensity: 0,
    }));

    const origDefectMats: MeshMaterialState[] = defectBoxMeshes.map((m) => ({
      mesh: m,
      colorHex: CONTAINER_BASE_COLORS[m.name] || "#F1F5F9",
      emissiveHex: "#000000",
      emissiveIntensity: 0,
    }));

    const origEyeMats: MeshMaterialState[] = [
      { mesh: eyeLens, colorHex: "#00F0FF", emissiveHex: "#000000", emissiveIntensity: 0 },
      { mesh: eyePupil, colorHex: "#03050A", emissiveHex: "#000000", emissiveIntensity: 0 },
      { mesh: eyeSparkle, colorHex: "#FFFFFF", emissiveHex: "#FFFFFF", emissiveIntensity: 1.0 },
    ].filter((item) => Boolean(item.mesh));

    sceneObjectsRef.current = {
      root: foundRoot,
      body: findObj("Mascot_Body_Assembly"),
      head: findObj("Mascot_Head_Dome"),
      legR: findObj("Mascot_R_Leg_Pivot"),
      legL: findObj("Mascot_L_Leg_Pivot"),
      armR: findObj("Mascot_R_Arm_Pivot"),
      armL: findObj("Mascot_L_Arm_Pivot"),
      wheelR: findObj("Mascot_Wheel_R"),
      wheelL: findObj("Mascot_Wheel_L"),
      shield: findObj("Mascot_Holo_Shield"),
      shieldFrame: findObj("Mascot_Shield_Frame"),
      laser: laserObj,
      symbolHazard: findObj("Mascot_Symbol_Hazard"),
      symbolCheckLong: findObj("Mascot_Symbol_Check_Long"),
      symbolCheckShort: findObj("Mascot_Symbol_Check_Short"),
      antennaOrb: findObj("Mascot_Antenna_Orb"),
      alertLight: findObj("Escalation Alert Light"),
      eyeLens,
      eyePupil,
      eyeSparkle,
      releaseBoxMeshes,
      defectBoxMeshes,
      origReleaseMats,
      origDefectMats,
      origEyeMats,
      releaseRoof: findObj("Release Roof Cap"),
      defectRoof: findObj("Defect Roof Cap"),
      releaseZone: findObj("Zone Release OK"),
      defectZone: findObj("Zone Quarantine Defect"),
    };

    // Apply baseline Spline colors immediately on scene load
    for (const item of origReleaseMats) {
      applyMaterialColor(item.mesh, item.colorHex, item.emissiveHex, item.emissiveIntensity);
    }
    for (const item of origDefectMats) {
      applyMaterialColor(item.mesh, item.colorHex, item.emissiveHex, item.emissiveIntensity);
    }
    if (sceneObjectsRef.current.releaseZone) {
      applyMaterialColor(sceneObjectsRef.current.releaseZone, "#E2E8F0", "#000000", 0);
    }
    if (sceneObjectsRef.current.defectZone) {
      applyMaterialColor(sceneObjectsRef.current.defectZone, "#E2E8F0", "#000000", 0);
    }

    // Initial position placement
    if (sceneObjectsRef.current.root) {
      const initPos = TWIN_STATIONS[systemState].pos;
      sceneObjectsRef.current.root.position.x = initPos[0];
      sceneObjectsRef.current.root.position.y = initPos[1];
      sceneObjectsRef.current.root.position.z = initPos[2];
      sceneObjectsRef.current.root.rotation.y = TWIN_STATIONS[systemState].yaw * DEG2RAD;
      curPosRef.current = [...initPos];
      curYawRef.current = TWIN_STATIONS[systemState].yaw;

      // Clean initial visibility: in idle or scanning, hide shield and checkmark
      if (sceneObjectsRef.current.shield) {
        sceneObjectsRef.current.shield.visible = (systemState === "ok" || systemState === "defect");
      }
      if (sceneObjectsRef.current.symbolCheckLong) {
        sceneObjectsRef.current.symbolCheckLong.visible = (systemState === "ok");
      }
      if (sceneObjectsRef.current.symbolCheckShort) {
        sceneObjectsRef.current.symbolCheckShort.visible = (systemState === "ok");
      }

      if (typeof splineApp.requestRender === "function") {
        splineApp.requestRender();
      }
    }
  }, [splineApp]);

  // Trigger movement when systemState changes
  useEffect(() => {
    if (systemState === targetStateRef.current && !isMovingRef.current) return;

    targetStateRef.current = systemState;
    waypointsRef.current = planRoute(curPosRef.current, systemState);
    waypointIdxRef.current = 0;
    isMovingRef.current = true;

    const root = sceneObjectsRef.current.root;
    if (root) {
      if (typeof root.traverse === "function") {
        root.traverse((child: any) => { child.matrixAutoUpdate = true; });
      }
      root.matrixAutoUpdate = true;
    }
  }, [systemState]);

  // Complete, Fluid Kinematics & Living Per-State Animation Loop
  useEffect(() => {
    if (!splineApp || !isVisible) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    lastTimeRef.current = performance.now();
    if (typeof splineApp.requestRender === "function") {
      splineApp.requestRender();
    }

    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.08);
      lastTimeRef.current = now;

      const objs = sceneObjectsRef.current;
      const root = objs.root;

      let targetTorsoLean = 0;
      let targetTorsoSway = 0;
      let targetHeadTilt = 0;
      let targetLegR = { x: 0, y: 0, z: 0 };
      let targetLegL = { x: 0, y: 0, z: 0 };
      let targetArmR = { x: 0, y: 0, z: 0 };
      let targetArmL = { x: 0, y: 0, z: 0 };
      let targetShieldScale = 1.0;

      if (root) {
        if (isMovingRef.current && waypointsRef.current.length > 0) {
          // --- 1. TRANSIT / SKATING MOTION (GLTF Verified Kinematics) ---
          const speed = targetStateRef.current === "defect" ? 440 : 340;
          const targetPt = waypointsRef.current[waypointIdxRef.current];
          const dx = targetPt[0] - curPosRef.current[0];
          const dy = targetPt[1] - curPosRef.current[1];
          const dz = targetPt[2] - curPosRef.current[2];
          const dist = Math.hypot(dx, dz);
          const arrivalThreshold = Math.max(9, speed * dt * 1.35);

          if (dist < arrivalThreshold) {
            waypointIdxRef.current += 1;
            if (waypointIdxRef.current >= waypointsRef.current.length) {
              isMovingRef.current = false;
              currentStateRef.current = targetStateRef.current;
              curPosRef.current = [...TWIN_STATIONS[currentStateRef.current].pos];
              curYawRef.current = TWIN_STATIONS[currentStateRef.current].yaw;
            }
          } else {
            const moveDist = Math.min(speed * dt, dist);
            const moveAngle = Math.atan2(dx, dz);

            curPosRef.current[0] += Math.sin(moveAngle) * moveDist;
            curPosRef.current[1] += dy * (moveDist / dist);
            curPosRef.current[2] += Math.cos(moveAngle) * moveDist;

            const targetDeg = moveAngle * (180 / Math.PI);
            let diffYaw = (targetDeg - curYawRef.current) % 360;
            if (diffYaw > 180) diffYaw -= 360;
            if (diffYaw < -180) diffYaw += 360;
            curYawRef.current += diffYaw * Math.min(dt * 14, 1.0);

            stridePhaseRef.current += dt * 7.8;
            const s = Math.sin(stridePhaseRef.current);
            const c = Math.cos(stridePhaseRef.current);

            // Aerodynamic forward lean, head tilt & body sway
            targetTorsoLean = 18.3;
            targetTorsoSway = s * 3.4;
            targetHeadTilt = -12.6;

            // Vigorous alternating leg & counter-pumping arm strides
            targetLegR = { x:  s * 41.2, y: 0, z: -2.3 };
            targetLegL = { x: -s * 41.2, y: 0, z:  2.3 };
            targetArmR = { x: -11.5 + c * 47.0, y:  8.0 * c, z:  12.6 };
            targetArmL = { x: -11.5 - c * 47.0, y: -8.0 * c, z: -12.6 };

            wheelRotRef.current += speed * dt * 4.8;
            targetShieldScale = 0.0;
          }
        } else {
          // --- 2. LIVING PER-STATE STATION ANIMATIONS ---
          const holdTime = now / 1000;
          targetTorsoLean = 0;
          targetTorsoSway = 0;
          targetHeadTilt = 0;

          const curState = currentStateRef.current;
          if (curState === "idle") {
            // A. Idle: Natural breathing bob cycle (robot gently bobs up/down on platform) - NO POPUP, NO CHECKMARK!
            const bob = Math.sin(holdTime * 2.2) * 1.5;
            curPosRef.current[1] = TWIN_STATIONS.idle.pos[1] + bob;
            targetLegR = { x: 0, y: 0, z: 0 };
            targetLegL = { x: 0, y: 0, z: 0 };
            targetArmR = { x: 0, y: 0, z: 0 };
            targetArmL = { x: 0, y: 0, z: 0 };
            targetShieldScale = 0.0;
          } else if (curState === "scanning") {
            // B. Scanning: Forward conveyor inspection stance with scanning eyes & laser beam active - NO POPUP!
            targetTorsoLean = 18.0;
            targetArmR = { x: 55.0, y: -18.0, z: 12.0 };
            targetArmL = { x: 0, y: 0, z: 0 };
            targetLegR = { x: 0, y: 0, z: 0 };
            targetLegL = { x: 0, y: 0, z: 0 };
            targetShieldScale = 0.0;
          } else if (curState === "ok") {
            // C. OK Pass: Joyful victory celebration hop with leg lifted & thumbs up - POP UP CENTANG HIJAU!
            const hop = Math.max(0, Math.sin(holdTime * 3.5) * 3);
            curPosRef.current[1] = TWIN_STATIONS.ok.pos[1] + hop;
            targetLegL = { x: 22.0, y: 0, z: 5.0 }; // Left leg lifted in joy
            targetLegR = { x: 0, y: 0, z: 0 };
            targetArmL = { x: -20.0, y: 0, z: -15.0 };
            targetArmR = { x: 15.0, y: 0, z: 20.0 }; // Arm raised thumbs-up
            targetShieldScale = 1.0;
          } else if (curState === "defect") {
            // D. Defect Alert: Alert stance & emergency arm waving - POP UP NOTIFIKASI MERAH!
            const wave = Math.sin(holdTime * 4.5) * 8.0;
            targetTorsoLean = -3.0;
            targetArmR = { x: 68.0 + wave, y: -32.0, z: 10.0 };
            targetArmL = { x: 5.0 - wave,  y: 0,     z: -10.0 };
            targetLegR = { x: 0, y: 0, z: 0 };
            targetLegL = { x: 0, y: 0, z: 0 };
            targetShieldScale = 1.1;
          }
        }

        // --- 3. EXPONENTIAL LERP BLENDING (Eliminates stiff freeze/snap) ---
        const blendRate = Math.min(dt * 11, 1.0);
        curTorsoLeanRef.current += (targetTorsoLean - curTorsoLeanRef.current) * blendRate;
        curTorsoSwayRef.current += (targetTorsoSway - curTorsoSwayRef.current) * blendRate;
        curHeadTiltRef.current  += (targetHeadTilt  - curHeadTiltRef.current)  * blendRate;
        curLegRRef.current.x    += (targetLegR.x    - curLegRRef.current.x)    * blendRate;
        curLegRRef.current.y    += (targetLegR.y    - curLegRRef.current.y)    * blendRate;
        curLegRRef.current.z    += (targetLegR.z    - curLegRRef.current.z)    * blendRate;
        curLegLRef.current.x    += (targetLegL.x    - curLegLRef.current.x)    * blendRate;
        curLegLRef.current.y    += (targetLegL.y    - curLegLRef.current.y)    * blendRate;
        curLegLRef.current.z    += (targetLegL.z    - curLegLRef.current.z)    * blendRate;
        curArmRRef.current.x    += (targetArmR.x    - curArmRRef.current.x)    * blendRate;
        curArmRRef.current.y    += (targetArmR.y    - curArmRRef.current.y)    * blendRate;
        curArmRRef.current.z    += (targetArmR.z    - curArmRRef.current.z)    * blendRate;
        curArmLRef.current.x    += (targetArmL.x    - curArmLRef.current.x)    * blendRate;
        curArmLRef.current.y    += (targetArmL.y    - curArmLRef.current.y)    * blendRate;
        curArmLRef.current.z    += (targetArmL.z    - curArmLRef.current.z)    * blendRate;
        curShieldScaleRef.current += (targetShieldScale - curShieldScaleRef.current) * blendRate;

        // --- 4. APPLY TO SPLINE OBJECTS (Degrees to Radians) ---
        root.position.x = curPosRef.current[0];
        root.position.y = curPosRef.current[1];
        root.position.z = curPosRef.current[2];
        root.rotation.y = curYawRef.current * DEG2RAD;

        if (objs.body) {
          objs.body.rotation.x = curTorsoLeanRef.current * DEG2RAD;
          objs.body.rotation.z = curTorsoSwayRef.current * DEG2RAD;
        }

        if (objs.head) {
          objs.head.rotation.x = curHeadTiltRef.current * DEG2RAD;
        }

        if (objs.legR) {
          objs.legR.rotation.x = curLegRRef.current.x * DEG2RAD;
          objs.legR.rotation.y = curLegRRef.current.y * DEG2RAD;
          objs.legR.rotation.z = curLegRRef.current.z * DEG2RAD;
        }
        if (objs.legL) {
          objs.legL.rotation.x = curLegLRef.current.x * DEG2RAD;
          objs.legL.rotation.y = curLegLRef.current.y * DEG2RAD;
          objs.legL.rotation.z = curLegLRef.current.z * DEG2RAD;
        }

        if (objs.armR) {
          objs.armR.rotation.x = curArmRRef.current.x * DEG2RAD;
          objs.armR.rotation.y = curArmRRef.current.y * DEG2RAD;
          objs.armR.rotation.z = curArmRRef.current.z * DEG2RAD;
        }
        if (objs.armL) {
          objs.armL.rotation.x = curArmLRef.current.x * DEG2RAD;
          objs.armL.rotation.y = curArmLRef.current.y * DEG2RAD;
          objs.armL.rotation.z = curArmLRef.current.z * DEG2RAD;
        }

        // Skate wheels rotating continuously while moving
        if (isMovingRef.current) {
          const wRot = (wheelRotRef.current % 360) * DEG2RAD;
          if (objs.wheelR) {
            objs.wheelR.rotation.x = wRot;
            objs.wheelR.rotation.z = 90 * DEG2RAD;
          }
          if (objs.wheelL) {
            objs.wheelL.rotation.x = wRot;
            objs.wheelL.rotation.z = 90 * DEG2RAD;
          }
        }

        const activeSt = isMovingRef.current ? targetStateRef.current : currentStateRef.current;

        // 1. Robot Eyes: Scanning Light Emission
        const isScanningActive = (activeSt === "scanning") && !isMovingRef.current;
        if (isScanningActive) {
          lastEyeScanningRef.current = true;
          const scanPulse = 2.2 + Math.sin(now * 0.012) * 0.6;
          if (objs.eyeLens) applyMaterialColor(objs.eyeLens, "#38BDF8", "#00F0FF", scanPulse);
          if (objs.eyePupil) applyMaterialColor(objs.eyePupil, "#0284C7", "#38BDF8", scanPulse);
          if (objs.eyeSparkle) applyMaterialColor(objs.eyeSparkle, "#FFFFFF", "#FFFFFF", 2.5);
        } else if (lastEyeScanningRef.current) {
          // Revert eyes to baseline ONCE on transition out of scanning
          lastEyeScanningRef.current = false;
          for (const item of objs.origEyeMats) {
            applyMaterialColor(item.mesh, item.colorHex, item.emissiveHex, item.emissiveIntensity);
          }
        }

        // 2. Conveyor Scan Laser
        if (objs.laser) {
          objs.laser.visible = isScanningActive;
        }

        // 3. Shield & Popups (Idle: No popup & no checkmark; OK: Popup with checkmark; Defect: Popup with red alert)
        if (objs.shield) {
          const sScale = curShieldScaleRef.current;
          const shouldBeVisible = (activeSt === "ok" || activeSt === "defect") && !isMovingRef.current && sScale > 0.08;
          objs.shield.visible = shouldBeVisible;
          if (typeof objs.shield.scale?.set === "function") {
            objs.shield.scale.set(sScale, sScale, sScale);
          }

          if (shouldBeVisible) {
            if (activeSt === "ok") {
              // OK: Glowing green shield frame & white checkmark
              if (objs.shieldFrame) applyMaterialColor(objs.shieldFrame, "#10B981", "#10B981", 1.2);
              if (objs.symbolCheckLong) {
                objs.symbolCheckLong.visible = true;
                applyMaterialColor(objs.symbolCheckLong, "#FFFFFF", "#FFFFFF", 1.5);
              }
              if (objs.symbolCheckShort) {
                objs.symbolCheckShort.visible = true;
                applyMaterialColor(objs.symbolCheckShort, "#FFFFFF", "#FFFFFF", 1.5);
              }
            } else if (activeSt === "defect") {
              // DEFECT: Glowing red alert notification (no checkmark)
              const alertPulse = 1.6 + Math.sin(now * 0.014) * 0.5;
              if (objs.shieldFrame) applyMaterialColor(objs.shieldFrame, "#EF4444", "#EF4444", alertPulse);
              if (objs.symbolCheckLong) objs.symbolCheckLong.visible = false;
              if (objs.symbolCheckShort) objs.symbolCheckShort.visible = false;
            }
          } else {
            // Idle / Moving / Scanning: Hide symbols completely
            if (objs.symbolCheckLong) objs.symbolCheckLong.visible = false;
            if (objs.symbolCheckShort) objs.symbolCheckShort.visible = false;
          }
        }

        // 4. Antenna Orb Pulse Color
        if (objs.antennaOrb?.material?.color?.set) {
          let orbColor = "#ffffff";
          if (activeSt === "defect") {
            const pulse = Math.sin(now * 0.018) > 0;
            orbColor = pulse ? "#ff0000" : "#ef4444";
          } else if (activeSt === "ok") {
            orbColor = "#22c55e";
          } else if (activeSt === "scanning") {
            orbColor = "#38bdf8";
          }
          if (lastAntennaColorRef.current !== orbColor) {
            lastAntennaColorRef.current = orbColor;
            objs.antennaOrb.material.color.set(orbColor);
          }
        }

        // 5. ENTIRE Containers Color Shifting (Pass Box -> Green, Defect Box -> Red, Idle -> Neutral)
        if (activeSt === "ok") {
          // OK: ENTIRE Container Release turns GREEN!
          const pulse = Math.sin(now * 0.006) > 0 ? 0.95 : 0.75;
          for (const m of objs.releaseBoxMeshes) {
            applyMaterialColor(m, "#10B981", "#059669", pulse);
          }
          if (objs.releaseZone) applyMaterialColor(objs.releaseZone, "#A7F3D0", "#10B981", 0.4);

          // Reset defect box back to pristine base ONCE
          if (lastContainerStateRef.current !== "ok") {
            for (const item of objs.origDefectMats) {
              applyMaterialColor(item.mesh, item.colorHex, item.emissiveHex, item.emissiveIntensity);
            }
            if (objs.defectZone) applyMaterialColor(objs.defectZone, "#E2E8F0", "#000000", 0);
            lastContainerStateRef.current = "ok";
          }
        } else if (activeSt === "defect") {
          // DEFECT: ENTIRE Container Defect turns RED!
          const pulse = Math.sin(now * 0.012) > 0 ? 1.1 : 0.85;
          for (const m of objs.defectBoxMeshes) {
            applyMaterialColor(m, "#EF4444", "#DC2626", pulse);
          }
          if (objs.defectZone) applyMaterialColor(objs.defectZone, "#FECACA", "#EF4444", 0.4);

          // Reset release box back to pristine base ONCE
          if (lastContainerStateRef.current !== "defect") {
            for (const item of objs.origReleaseMats) {
              applyMaterialColor(item.mesh, item.colorHex, item.emissiveHex, item.emissiveIntensity);
            }
            if (objs.releaseZone) applyMaterialColor(objs.releaseZone, "#E2E8F0", "#000000", 0);
            lastContainerStateRef.current = "defect";
          }
        } else {
          // IDLE / SCANNING: Both entire boxes cleanly revert to default original factory materials ONCE
          if (lastContainerStateRef.current !== "neutral") {
            for (const item of objs.origReleaseMats) {
              applyMaterialColor(item.mesh, item.colorHex, item.emissiveHex, item.emissiveIntensity);
            }
            for (const item of objs.origDefectMats) {
              applyMaterialColor(item.mesh, item.colorHex, item.emissiveHex, item.emissiveIntensity);
            }
            if (objs.releaseZone) applyMaterialColor(objs.releaseZone, "#E2E8F0", "#000000", 0);
            if (objs.defectZone) applyMaterialColor(objs.defectZone, "#E2E8F0", "#000000", 0);
            lastContainerStateRef.current = "neutral";
          }
        }

        // 6. Escalation Alert Spotlight
        if (objs.alertLight) {
          objs.alertLight.visible = (activeSt === "defect");
          if (typeof objs.alertLight.intensity !== "undefined") {
            objs.alertLight.intensity = (activeSt === "defect") ? 2.2 : 0;
          }
          if (objs.alertLight.color?.set && activeSt === "defect") {
            objs.alertLight.color.set("#EF4444");
          }
        }

        // Render call to ensure WebGL canvas updates on every single animation frame
        if (typeof splineApp.requestRender === "function") {
          splineApp.requestRender();
        } else if (typeof splineApp._requestRenderAutoMode === "function") {
          splineApp._requestRenderAutoMode();
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [splineApp, isVisible]);
}
