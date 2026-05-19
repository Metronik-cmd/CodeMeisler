/// <reference types="@ragempcommunity/types-client" />

declare function setInterval(handler: () => void, timeout?: number): number;
declare function clearInterval(handle: number): void;
declare function setTimeout(handler: () => void, timeout?: number): number;

const F6_KEY = 0x75;
const B_KEY = 0x42;
const CEF_URL = "http://package/cef/index.html";
const SHOW_MARKER_KEY = "probeShowMarker";
const LAST_VEHICLE_KEY = "probeLastVehicle";

type UiPosition = {
  x: number;
  y: number;
  z: number;
};

type UiPlayerInfo = {
  name: string;
  position: UiPosition;
  health: number;
  armor: number;
  ping: number;
  serverPlayers: number;
  showMarker: boolean;
  aduty: boolean;
  noclip: boolean;
  vehicleSpawned: boolean;
  lastVehicle: string;
};

type BrowserMessage =
  | {
      type: "client:playerInfo";
      payload: UiPlayerInfo;
    }
  | {
      type: "client:adminMessage";
      payload: {
        success: boolean;
        message: string;
      };
    };

type LocalPlayerTools = PlayerMp & {
  setComponentVariation?: (componentId: number, drawableId: number, textureId: number, paletteId: number) => void;
  setCoordsNoOffset?: (x: number, y: number, z: number, xAxis: boolean, yAxis: boolean, zAxis: boolean) => void;
  setCollision?: (toggle: boolean, keepPhysics: boolean) => void;
  setInvincible?: (toggle: boolean) => void;
  freezePosition?: (toggle: boolean) => void;
  setAlpha?: (alpha: number) => void;
  resetAlpha?: () => void;
};

type ScreenPoint = {
  x: number;
  y: number;
};

let browser: BrowserMp | null = null;
let browserReady = false;
let uiOpen = false;
let showMarker = readStoredBoolean(SHOW_MARKER_KEY);
let aduty = false;
let noclip = false;
let noclipPosition: UiPosition | null = null;
let lastVehicle = readStoredString(LAST_VEHICLE_KEY, "sultan");
let vehicleSpawned = false;
let pendingVehicle = "";
let marker: MarkerMp | null = null;
let refreshInterval: number | null = null;

function readStoredBoolean(key: string): boolean {
  return mp.storage.data[key] === true;
}

function writeStoredBoolean(key: string, value: boolean): void {
  mp.storage.data[key] = value;
  mp.storage.flush();
}

function readStoredString(key: string, fallback: string): string {
  const value = mp.storage.data[key];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function writeStoredString(key: string, value: string): void {
  mp.storage.data[key] = value;
  mp.storage.flush();
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function getLocalPlayer(): LocalPlayerTools {
  return mp.players.local as LocalPlayerTools;
}

function getRawHealth(player: PlayerMp): number {
  const typedPlayer = player as PlayerMp & {
    getHealth?: () => number;
  };

  if (typeof typedPlayer.getHealth === "function") {
    return typedPlayer.getHealth();
  }

  return player.health || 0;
}

function getUiHealth(player: PlayerMp): number {
  const rawHealth = getRawHealth(player);
  const normalizedHealth = rawHealth > 100 ? rawHealth - 100 : rawHealth;
  return Math.max(0, Math.min(100, Math.round(normalizedHealth)));
}

function getUiArmor(player: PlayerMp): number {
  const typedPlayer = player as PlayerMp & {
    getArmour?: () => number;
  };
  const rawArmor = typeof typedPlayer.getArmour === "function" ? typedPlayer.getArmour() : typedPlayer.armour || 0;

  return Math.max(0, Math.min(100, Math.round(rawArmor)));
}

function getServerPlayerCount(): number {
  let count = 0;
  mp.players.forEach(() => {
    count += 1;
  });
  return Math.max(1, count);
}

function getPlayerInfo(): UiPlayerInfo {
  const player = getLocalPlayer();
  const position = player.position;

  return {
    name: player.name || "Unknown",
    position: {
      x: round(position.x),
      y: round(position.y),
      z: round(position.z)
    },
    health: getUiHealth(player),
    armor: getUiArmor(player),
    ping: Math.round(player.ping || 0),
    serverPlayers: getServerPlayerCount(),
    showMarker,
    aduty,
    noclip,
    vehicleSpawned,
    lastVehicle
  };
}

function sendBrowserMessage(message: BrowserMessage): void {
  if (!browser || !browserReady || !uiOpen) {
    return;
  }

  const serializedMessage = JSON.stringify(message).replace(/</g, "\\u003c");
  browser.execute(`window.postMessage(${serializedMessage}, "*");`);
}

function sendPlayerInfo(): void {
  sendBrowserMessage({
    type: "client:playerInfo",
    payload: getPlayerInfo()
  });
}

function sendAdminMessage(success: boolean, message: string): void {
  if (message) {
    mp.gui.chat.push(message);
  }

  sendBrowserMessage({
    type: "client:adminMessage",
    payload: {
      success,
      message
    }
  });
  sendPlayerInfo();
}

function setCursorAndControls(enabled: boolean): void {
  const cursor = mp.gui.cursor as unknown as {
    visible: boolean;
    show?: (show: boolean, freezeControls: boolean) => void;
  };

  cursor.visible = enabled;

  if (typeof cursor.show === "function") {
    cursor.show(enabled, enabled);
  }
}

function openUi(): void {
  if (uiOpen) {
    return;
  }

  showMarker = readStoredBoolean(SHOW_MARKER_KEY);
  lastVehicle = readStoredString(LAST_VEHICLE_KEY, "sultan");
  syncMarker();

  browser = mp.browsers.new(CEF_URL);
  browserReady = false;
  uiOpen = true;

  setCursorAndControls(true);
  refreshInterval = setInterval(sendPlayerInfo, 750);
}

function closeUi(): void {
  if (!uiOpen) {
    return;
  }

  uiOpen = false;
  browserReady = false;

  if (refreshInterval !== null) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }

  if (browser) {
    browser.destroy();
    browser = null;
  }

  setCursorAndControls(false);
}

function toggleUi(): void {
  if (uiOpen) {
    closeUi();
    return;
  }

  openUi();
}

function destroyMarker(): void {
  if (!marker) {
    return;
  }

  marker.destroy();
  marker = null;
}

function createMarkerAtPlayer(): void {
  const player = getLocalPlayer();
  const position = player.position;

  destroyMarker();
  marker = mp.markers.new(1, new mp.Vector3(position.x, position.y, position.z - 1), 1.55, {
    color: [255, 110, 0, 190],
    visible: true,
    dimension: player.dimension
  });
}

function syncMarker(): void {
  if (showMarker) {
    if (!marker) {
      createMarkerAtPlayer();
    }
    return;
  }

  destroyMarker();
}

function setShowMarker(value: unknown): void {
  showMarker = value === true || value === "true" || value === 1 || value === "1";
  writeStoredBoolean(SHOW_MARKER_KEY, showMarker);
  syncMarker();
  sendPlayerInfo();
}

function formatPosition(position: UiPosition): string {
  return `${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`;
}

function logPosition(): void {
  const playerInfo = getPlayerInfo();
  const message = `[ProbeUI] Position: ${formatPosition(playerInfo.position)}`;

  mp.console.logInfo(message);
  mp.gui.chat.push(message);
}

function applyAdminClothes(): void {
  const player = getLocalPlayer();

  if (typeof player.setComponentVariation !== "function") {
    return;
  }

  player.setComponentVariation(3, 3, 0, 0);
  player.setComponentVariation(1, 135, 0, 0);
  player.setComponentVariation(4, 114, 0, 0);
  player.setComponentVariation(6, 78, 0, 0);
  player.setComponentVariation(8, 15, 0, 0);
  player.setComponentVariation(11, 287, 0, 0);
}

function resetLocalClothes(): void {
  const player = getLocalPlayer();

  if (typeof player.setComponentVariation !== "function") {
    return;
  }

  player.setComponentVariation(1, 0, 0, 0);
  player.setComponentVariation(3, 0, 0, 0);
  player.setComponentVariation(4, 1, 0, 0);
  player.setComponentVariation(6, 1, 0, 0);
  player.setComponentVariation(8, 15, 0, 0);
  player.setComponentVariation(11, 0, 0, 0);
}

function setAduty(value: unknown): void {
  aduty = value === true || value === "true" || value === 1 || value === "1";

  if (!aduty && noclip) {
    setNoclip(false);
  }

  if (aduty) {
    applyAdminClothes();
  } else {
    resetLocalClothes();
  }

  mp.events.callRemote("admin:toggleDuty", aduty);
  syncGodmode();
  sendPlayerInfo();
}

function syncGodmode(): void {
  const player = getLocalPlayer();

  if (typeof player.setInvincible === "function") {
    player.setInvincible(aduty || noclip);
  }
}

function setLocalArmor(amount: number): void {
  const player = getLocalPlayer();
  const ped = mp.game.ped as unknown as {
    setArmour?: (ped: number, amount: number) => void;
  };

  if (typeof ped.setArmour === "function") {
    ped.setArmour(player.handle, amount);
  }
}

function setNoclip(enabled: boolean): void {
  const player = getLocalPlayer();
  noclip = enabled && aduty;

  if (!aduty && enabled) {
    mp.gui.chat.push("[Admin] Noclip geht nur in ADuty.");
  }

  if (typeof player.setCollision === "function") {
    player.setCollision(!noclip, !noclip);
  }

  if (typeof player.freezePosition === "function") {
    player.freezePosition(noclip);
  }

  syncGodmode();

  noclipPosition = noclip
    ? {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z
      }
    : null;

  if (typeof player.resetAlpha === "function") {
    player.resetAlpha();
  } else if (typeof player.setAlpha === "function") {
    player.setAlpha(255);
  }

  sendPlayerInfo();
}

function toggleNoclip(): void {
  setNoclip(!noclip);
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function isControlPressed(control: number): boolean {
  const controls = mp.game.controls as unknown as {
    isControlPressed: (padIndex: number, control: number) => boolean;
    isDisabledControlPressed?: (padIndex: number, control: number) => boolean;
  };

  if (typeof controls.isDisabledControlPressed === "function" && controls.isDisabledControlPressed(0, control)) {
    return true;
  }

  return controls.isControlPressed(0, control);
}

function getCameraDirection(): UiPosition {
  const camera = mp.game.cam as unknown as {
    getGameplayCamRot: (rotationOrder: number) => UiPosition;
  };
  const rotation = camera.getGameplayCamRot(2);
  const z = degreesToRadians(rotation.z);
  const x = degreesToRadians(rotation.x);
  const cosX = Math.abs(Math.cos(x));

  return {
    x: -Math.sin(z) * cosX,
    y: Math.cos(z) * cosX,
    z: Math.sin(x)
  };
}

function moveNoclip(): void {
  const player = getLocalPlayer();
  const direction = getCameraDirection();
  const rotation = (mp.game.cam as unknown as { getGameplayCamRot: (rotationOrder: number) => UiPosition }).getGameplayCamRot(2);
  const heading = degreesToRadians(rotation.z);
  const right = {
    x: Math.cos(heading),
    y: Math.sin(heading),
    z: 0
  };
  const speed = isControlPressed(21) ? 1.4 : 0.45;
  const next = noclipPosition || {
    x: player.position.x,
    y: player.position.y,
    z: player.position.z
  };

  if (isControlPressed(32)) {
    next.x += direction.x * speed;
    next.y += direction.y * speed;
    next.z += direction.z * speed;
  }

  if (isControlPressed(33)) {
    next.x -= direction.x * speed;
    next.y -= direction.y * speed;
    next.z -= direction.z * speed;
  }

  if (isControlPressed(34)) {
    next.x -= right.x * speed;
    next.y -= right.y * speed;
  }

  if (isControlPressed(35)) {
    next.x += right.x * speed;
    next.y += right.y * speed;
  }

  if (isControlPressed(22)) {
    next.z += speed;
  }

  if (isControlPressed(36)) {
    next.z -= speed;
  }

  noclipPosition = next;

  if (typeof player.setCoordsNoOffset === "function") {
    player.setCoordsNoOffset(next.x, next.y, next.z, false, false, false);
  } else {
    player.position = new mp.Vector3(next.x, next.y, next.z);
  }
}

function spawnVehicle(modelName: unknown): void {
  const model = typeof modelName === "string" ? modelName.trim().toLowerCase() : "";

  if (!model) {
    sendAdminMessage(false, "[Admin] Kein Fahrzeug angegeben.");
    return;
  }

  pendingVehicle = model;
  mp.events.callRemote("admin:spawnVehicle", model);
  sendPlayerInfo();
}

function parseWorldToScreenResult(value: unknown): ScreenPoint | null {
  if (Array.isArray(value) && value.length >= 3 && value[0]) {
    return {
      x: Number(value[1]),
      y: Number(value[2])
    };
  }

  if (typeof value === "object" && value !== null && "x" in value && "y" in value) {
    const point = value as ScreenPoint;
    return {
      x: Number(point.x),
      y: Number(point.y)
    };
  }

  return null;
}

function drawScreenText(text: string, x: number, y: number, scale: number, color: [number, number, number, number]): void {
  const graphics = mp.game.graphics as unknown as {
    drawText?: (content: string, position: [number, number], options: Record<string, unknown>) => void;
  };

  if (typeof graphics.drawText !== "function") {
    return;
  }

  graphics.drawText(text, [x, y], {
    font: 4,
    color,
    scale: [scale, scale],
    outline: true,
    centre: true
  });
}

function drawNameTags(): void {
  if (!aduty) {
    return;
  }

  const graphics = mp.game.graphics as unknown as {
    world3dToScreen2d?: (x: number, y: number, z: number) => unknown;
  };
  const world3dToScreen2d = graphics.world3dToScreen2d;

  if (typeof world3dToScreen2d !== "function") {
    return;
  }

  mp.players.forEach((player: PlayerMp) => {
    const distance = getDistance(getLocalPlayer().position, player.position);

    if (distance > 45) {
      return;
    }

    const screen = parseWorldToScreenResult(world3dToScreen2d(player.position.x, player.position.y, player.position.z + 1.25));

    if (!screen) {
      return;
    }

    const duty = player.getVariable("admin:aduty") === true ? " ADuty" : "";
    drawScreenText(`${player.name} [${player.remoteId}]${duty}`, screen.x, screen.y, 0.28, [255, 255, 255, 235]);
  });
}

function getDistance(positionA: UiPosition, positionB: UiPosition): number {
  const distanceX = positionA.x - positionB.x;
  const distanceY = positionA.y - positionB.y;
  const distanceZ = positionA.z - positionB.z;

  return Math.sqrt(distanceX * distanceX + distanceY * distanceY + distanceZ * distanceZ);
}

mp.keys.bind(F6_KEY, true, toggleUi);
mp.keys.bind(B_KEY, true, toggleNoclip);

mp.events.add("browserDomReady", (readyBrowser: BrowserMp) => {
  if (readyBrowser !== browser) {
    return;
  }

  browserReady = true;
  sendPlayerInfo();
});

mp.events.add("render", () => {
  if (uiOpen) {
    mp.game.controls.disableAllControlActions(0);
  }

  if (aduty) {
    syncGodmode();
  }

  if (noclip) {
    mp.game.controls.disableControlAction(0, 32, true);
    mp.game.controls.disableControlAction(0, 33, true);
    mp.game.controls.disableControlAction(0, 34, true);
    mp.game.controls.disableControlAction(0, 35, true);
    moveNoclip();
  }

  drawNameTags();
});

mp.events.add("playerReady", () => {
  showMarker = readStoredBoolean(SHOW_MARKER_KEY);
  lastVehicle = readStoredString(LAST_VEHICLE_KEY, "sultan");
  syncMarker();
});

mp.events.add("playerSpawn", () => {
  showMarker = readStoredBoolean(SHOW_MARKER_KEY);
  syncMarker();
});

mp.events.add("admin:dutyState", (enabled: boolean) => {
  aduty = enabled === true;

  if (aduty) {
    applyAdminClothes();
    setLocalArmor(100);
  } else {
    setNoclip(false);
    resetLocalClothes();
  }

  syncGodmode();
  sendPlayerInfo();
});

mp.events.add("admin:vehicleSpawned", (success: boolean, message: string, modelName?: string) => {
  if (success) {
    lastVehicle = typeof modelName === "string" && modelName.length > 0 ? modelName : pendingVehicle;
    vehicleSpawned = true;
    writeStoredString(LAST_VEHICLE_KEY, lastVehicle);
  }

  pendingVehicle = "";
  sendAdminMessage(success, message);
});

mp.events.add("ui:copyPos", logPosition);
mp.events.add("ui:toggleMarker", setShowMarker);
mp.events.add("ui:toggleAduty", setAduty);
mp.events.add("ui:toggleNoclip", (enabled: boolean) => setNoclip(enabled === true));
mp.events.add("ui:spawnVehicle", spawnVehicle);
mp.events.add("ui:close", closeUi);
