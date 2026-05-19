const spawnPosition = new mp.Vector3(-425.24, 1123.78, 325.85);
const adminState = new Map();
const adminVehicles = new Map();

function getPlayerState(player) {
  if (!adminState.has(player.id)) {
    adminState.set(player.id, {
      aduty: false
    });
  }

  return adminState.get(player.id);
}

function setPlayerVariables(player) {
  const state = getPlayerState(player);

  player.setVariable("admin:aduty", state.aduty);
}

function sendChat(player, message) {
  if (typeof player.outputChatBox === "function") {
    player.outputChatBox(message);
  }
}

function setClothes(player, component, drawable, texture, palette) {
  if (typeof player.setClothes === "function") {
    player.setClothes(component, drawable, texture, palette);
  }
}

function applyAdminClothes(player) {
  if (typeof player.model !== "undefined") {
    player.model = mp.joaat("mp_m_freemode_01");
  }

  setClothes(player, 3, 3, 0, 0);
  setClothes(player, 1, 135, 0, 0);
  setClothes(player, 4, 114, 0, 0);
  setClothes(player, 6, 78, 0, 0);
  setClothes(player, 8, 15, 0, 0);
  setClothes(player, 11, 287, 0, 0);
}

function applyNormalClothes(player) {
  if (typeof player.model !== "undefined") {
    player.model = mp.joaat("mp_m_freemode_01");
  }

  setClothes(player, 1, 0, 0, 0);
  setClothes(player, 3, 0, 0, 0);
  setClothes(player, 4, 1, 0, 0);
  setClothes(player, 6, 1, 0, 0);
  setClothes(player, 8, 15, 0, 0);
  setClothes(player, 11, 0, 0, 0);
}

function setAduty(player, enabled) {
  const state = getPlayerState(player);
  state.aduty = enabled === true;
  setPlayerVariables(player);

  if (state.aduty) {
    applyAdminClothes(player);
    player.health = 100;
    player.armour = 100;
    sendChat(player, "[Admin] ADuty aktiviert.");
  } else {
    applyNormalClothes(player);
    sendChat(player, "[Admin] ADuty deaktiviert.");
  }

  player.call("admin:dutyState", [state.aduty]);
}

function cleanVehicleModel(modelName) {
  const model = String(modelName || "").trim().toLowerCase();

  if (!/^[a-z0-9_]{2,32}$/.test(model)) {
    return null;
  }

  return model;
}

function destroyAdminVehicle(player) {
  const oldVehicle = adminVehicles.get(player.id);

  if (oldVehicle && typeof oldVehicle.destroy === "function") {
    oldVehicle.destroy();
  }

  adminVehicles.delete(player.id);
}

function spawnVehicle(player, modelName) {
  const state = getPlayerState(player);

  if (!state.aduty) {
    sendChat(player, "[Admin] Erst ADuty aktivieren.");
    player.call("admin:vehicleSpawned", [false, "[Admin] Erst ADuty aktivieren.", ""]);
    return;
  }

  const model = cleanVehicleModel(modelName);

  if (!model) {
    player.call("admin:vehicleSpawned", [false, "[Admin] Fahrzeugname ist ungueltig.", ""]);
    return;
  }

  destroyAdminVehicle(player);

  const heading = Number(player.heading) || 0;
  const rad = (heading * Math.PI) / 180;
  const spawn = new mp.Vector3(
    player.position.x + Math.sin(-rad) * 4,
    player.position.y + Math.cos(rad) * 4,
    player.position.z + 0.5
  );

  const vehicle = mp.vehicles.new(mp.joaat(model), spawn, {
    heading,
    numberPlate: "SCHEISLER",
    dimension: player.dimension
  });

  adminVehicles.set(player.id, vehicle);
  player.call("admin:vehicleSpawned", [true, `[Admin] ${model} gespawnt.`, model]);
}
//General Scheisler
function spawnPlayer(player) {
  player.spawn(spawnPosition);
  player.health = 100;
  player.armour = 0;
  applyNormalClothes(player);
  setPlayerVariables(player);
  sendChat(player, "Probe Admin geladen. F6 Menu, B Noclip nur in ADuty.");
}

mp.events.add("playerJoin", (player) => {
  getPlayerState(player);
  spawnPlayer(player);
});

mp.events.add("playerSpawn", (player) => {
  setPlayerVariables(player);
});

mp.events.add("playerQuit", (player) => {
  destroyAdminVehicle(player);
  adminState.delete(player.id);
});

mp.events.add("admin:toggleDuty", (player, enabled) => {
  setAduty(player, enabled === true || enabled === "true");
});

mp.events.add("admin:spawnVehicle", (player, modelName) => {
  spawnVehicle(player, modelName);
});