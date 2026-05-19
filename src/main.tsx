import React from "react";
import ReactDOM from "react-dom/client";
import {
  Badge,
  Car,
  Copy,
  HeartPulse,
  MapPin,
  Navigation,
  Shield,
  Signal,
  UserRound,
  X
} from "lucide-react";
import gvmpLogoUrl from "./assets/gvmp-logo.png";
import "./styles.css";

type Position = {
  x: number;
  y: number;
  z: number;
};

type PlayerInfo = {
  name: string;
  position: Position;
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

type ClientMessage =
  | {
      type: "client:playerInfo";
      payload: PlayerInfo;
    }
  | {
      type: "client:adminMessage";
      payload: {
        success: boolean;
        message: string;
      };
    };

const fallbackInfo: PlayerInfo = {
  name: "DevPlayer",
  position: { x: -425.24, y: 1123.78, z: 325.85 },
  health: 100,
  armor: 42,
  ping: 18,
  serverPlayers: 1,
  showMarker: false,
  aduty: false,
  noclip: false,
  vehicleSpawned: false,
  lastVehicle: "sultan"
};

const vehicles = ["sultan", "adder", "zentorno", "t20", "kuruma", "buffalo", "police", "bati", "mesa", "insurgent"];

function triggerClient(eventName: string, ...args: unknown[]) {
  if (window.mp?.trigger) {
    window.mp.trigger(eventName, ...args);
    return;
  }

  console.info(`[CEF fallback] ${eventName}`, ...args);
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function formatPosition(position: Position) {
  return `${formatNumber(position.x)}, ${formatNumber(position.y)}, ${formatNumber(position.z)}`;
}

function App() {
  const [playerInfo, setPlayerInfo] = React.useState<PlayerInfo>(fallbackInfo);
  const [vehicleModel, setVehicleModel] = React.useState(fallbackInfo.lastVehicle);
  const [activeTab, setActiveTab] = React.useState<"admin" | "player" | "vehicles">("admin");
  const vehicleSynced = React.useRef(false);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent<ClientMessage>) => {
      if (event.data?.type === "client:playerInfo") {
        setPlayerInfo(event.data.payload);

        if (!vehicleSynced.current) {
          setVehicleModel(event.data.payload.lastVehicle || "sultan");
          vehicleSynced.current = true;
        }
        return;
      }

      if (event.data?.type === "client:adminMessage") {
        return;
      }
    };

    window.addEventListener("message", onMessage);

    const fallbackTimer = window.setTimeout(() => {
      if (!window.mp) {
        window.postMessage({ type: "client:playerInfo", payload: fallbackInfo }, "*");
      }
    }, 250);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  const toggleMarker = () => {
    const nextValue = !playerInfo.showMarker;
    setPlayerInfo((current) => ({ ...current, showMarker: nextValue }));
    triggerClient("ui:toggleMarker", nextValue);
  };

  const toggleAduty = () => {
    const nextValue = !playerInfo.aduty;
    setPlayerInfo((current) => ({ ...current, aduty: nextValue, noclip: nextValue ? current.noclip : false }));
    triggerClient("ui:toggleAduty", nextValue);
  };

  const toggleNoclip = () => {
    const nextValue = !playerInfo.noclip;
    setPlayerInfo((current) => ({ ...current, noclip: nextValue }));
    triggerClient("ui:toggleNoclip", nextValue);
  };

  const spawnVehicle = (model = vehicleModel) => {
    const cleanModel = model.trim().toLowerCase();
    setVehicleModel(cleanModel);
    triggerClient("ui:spawnVehicle", cleanModel);

    if (!window.mp?.trigger) {
      setPlayerInfo((current) => ({ ...current, lastVehicle: cleanModel, vehicleSpawned: true }));
    }
  };

  const statusText = `Aduty ${playerInfo.aduty ? "aktiv" : "deaktiviert"} / ${playerInfo.serverPlayers} Spieler online`;

  return (
    <main className="min-h-screen overflow-hidden bg-transparent text-white">
      <section className="relative min-h-screen bg-[linear-gradient(90deg,rgba(10,9,7,0.48),rgba(124,61,8,0.34)_48%,rgba(10,8,7,0.42)),linear-gradient(0deg,rgba(154,78,6,0.36),rgba(255,255,255,0.02)_48%,rgba(0,0,0,0.18))] px-7 py-5 backdrop-blur-[1px]">
        <header className="flex items-start justify-between">
          <div className="select-none">
            <div className="text-[48px] font-black uppercase leading-none text-orange-500 drop-shadow-md">ADMIN</div>
            <div className="mt-1 inline-flex border-t-2 border-orange-400 bg-orange-500/78 px-2 py-1 text-sm font-black text-white">
              Na, was musst du machen?
            </div>
          </div>

          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 border-b-2 border-orange-400 px-2 text-sm font-black text-white/90 transition hover:text-orange-100"
            onClick={() => triggerClient("ui:close")}
          >
            <X size={17} />
            Schliessen
          </button>
        </header>

        <div className="absolute left-5 top-1/2 flex -translate-y-1/2 flex-col gap-4 text-white/90">
          <SideIcon active={activeTab === "player"} icon={<UserRound size={19} />} label="Spieler" />
          <SideIcon active={playerInfo.aduty} icon={<Badge size={19} />} label="Aduty" />
          <SideIcon active={playerInfo.noclip} icon={<Navigation size={19} />} label="Noclip" />
          <SideIcon active={playerInfo.vehicleSpawned} icon={<Car size={19} />} label="Fahrzeug" />
          <SideIcon active={playerInfo.showMarker} icon={<MapPin size={19} />} label="Marker" />
        </div>

        <section className="mx-auto mt-6 max-w-5xl">
          <div className="mx-auto grid max-w-3xl grid-cols-3 rounded-lg bg-white/24 p-1 text-center text-xs font-black text-white/70 backdrop-blur-md">
            <TabButton active={activeTab === "admin"} label="Admin" onClick={() => setActiveTab("admin")} />
            <TabButton active={activeTab === "player"} label="Spieler Info" onClick={() => setActiveTab("player")} />
            <TabButton active={activeTab === "vehicles"} label="Fahrzeuge" onClick={() => setActiveTab("vehicles")} />
          </div>

          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 text-3xl font-black">
              <img src={gvmpLogoUrl} alt="" className="h-12 w-12 object-contain drop-shadow-lg" />
              Admin Panel
            </div>
            <div className="mt-2 text-sm font-bold text-white/70">{playerInfo.name} / {formatPosition(playerInfo.position)}</div>
          </div>

          {activeTab === "admin" ? (
            <div className="mx-auto mt-5 grid max-w-3xl grid-cols-3 gap-3">
              <ActionTile
                active={playerInfo.aduty}
                icon={<Badge size={34} />}
                title="Aduty"
                sub={playerInfo.aduty ? "aktiv" : "deaktiviert"}
                onClick={toggleAduty}
              />
              <ActionTile
                active={playerInfo.noclip}
                disabled={!playerInfo.aduty}
                icon={<Navigation size={34} />}
                title="Noclip"
                sub="Taste B oder Button"
                onClick={toggleNoclip}
              />
              <ActionTile
                active={playerInfo.showMarker}
                icon={<MapPin size={34} />}
                title="Marker"
                sub={playerInfo.showMarker ? "Wird gespeichert" : "Show Marker"}
                onClick={toggleMarker}
              />
              <ActionTile icon={<Copy size={34} />} title="Copy Pos" sub="Chat + Konsole" onClick={() => triggerClient("ui:copyPos")} />
              <ActionTile active={playerInfo.vehicleSpawned} icon={<Car size={34} />} title="Spawn Car" sub={playerInfo.lastVehicle || vehicleModel || "sultan"} onClick={() => spawnVehicle()} />
              <ActionTile icon={<X size={34} />} title="Close" sub="Fenster zu" onClick={() => triggerClient("ui:close")} />
            </div>
          ) : null}

          {activeTab === "player" ? (
            <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-4 lg:grid-cols-4">
              <InfoCard icon={<UserRound size={22} />} label="Name" value={playerInfo.name} />
              <InfoCard icon={<HeartPulse size={22} />} label="Health" value={playerInfo.health} />
              <InfoCard icon={<Shield size={22} />} label="Armor" value={playerInfo.armor} />
              <InfoCard icon={<Signal size={22} />} label="Ping" value={playerInfo.ping} />
              <div className="col-span-2 lg:col-span-4 rounded-lg border border-white/18 bg-black/18 p-4 text-left backdrop-blur-md">
                <div className="mb-1 flex items-center gap-2 text-sm font-black text-orange-100">
                  <MapPin size={16} />
                  Position
                </div>
                <div className="font-mono text-xl font-black">{formatPosition(playerInfo.position)}</div>
              </div>
            </div>
          ) : null}

          {activeTab === "vehicles" ? (
            <div className="mx-auto mt-8 max-w-3xl rounded-lg border border-white/18 bg-black/18 p-5 backdrop-blur-md">
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <input
                  className="h-12 rounded-md border border-white/18 bg-black/28 px-4 text-lg font-black outline-none placeholder:text-white/35 focus:border-orange-300"
                  value={vehicleModel}
                  onChange={(event) => setVehicleModel(event.target.value)}
                  placeholder="z.B. sultan"
                />
                <button className="h-12 rounded-md bg-orange-400 px-6 text-sm font-black text-zinc-950 hover:bg-orange-300" onClick={() => spawnVehicle()}>
                  Spawnen
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
                {vehicles.map((vehicle) => (
                  <button
                    key={vehicle}
                    className="h-10 rounded-md border border-white/16 bg-white/[0.06] text-xs font-black uppercase hover:border-orange-300 hover:bg-orange-400/16"
                    onClick={() => spawnVehicle(vehicle)}
                  >
                    {vehicle}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mx-auto mt-5 max-w-3xl rounded-md border border-orange-300/22 bg-orange-400/12 px-4 py-3 text-center text-sm font-bold text-orange-50">
            {statusText}
          </div>
        </section>

        <footer className="absolute bottom-3 left-0 right-0 text-center text-xs font-bold text-white/64">
          F6 oeffnet das Fenster / B toggelt Noclip wenn ADuty aktiv ist / Show Marker wird mit mp.storage gespeichert.
        </footer>
      </section>
    </main>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`h-8 rounded-md text-xs font-black transition ${active ? "bg-black/55 text-white" : "text-white/70 hover:text-white"}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SideIcon({ active, icon, label }: { active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <div
      className={`grid h-9 w-9 place-items-center rounded-md border transition ${
        active
          ? "border-orange-200/70 bg-orange-500/70 text-white shadow-[0_0_22px_rgba(249,115,22,0.45)]"
          : "border-white/0 bg-black/0 text-white/88"
      }`}
      title={label}
    >
      {icon}
    </div>
  );
}

function ActionTile({
  active,
  disabled,
  icon,
  title,
  sub,
  onClick
}: {
  active?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`group h-36 rounded-lg border p-3 text-left shadow-inner shadow-black/25 backdrop-blur-md transition disabled:cursor-not-allowed disabled:opacity-45 ${
        active ? "border-orange-200 bg-orange-400/38" : "border-white/20 bg-black/20 hover:border-orange-300 hover:bg-orange-400/18"
      }`}
      onClick={onClick}
    >
      <div className="flex h-full flex-col justify-between rounded-md bg-gradient-to-br from-orange-500/35 to-black/20 p-3">
        <div className="grid h-14 w-14 place-items-center rounded-md border border-white/18 bg-black/24 text-white">{icon}</div>
        <div>
          <div className="text-lg font-black leading-tight">{title}</div>
          <div className="text-xs font-bold text-white/68">{sub}</div>
        </div>
      </div>
    </button>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/18 bg-black/18 p-4 text-left backdrop-blur-md">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-md bg-orange-400/18 text-orange-100">{icon}</div>
      <div className="text-xs font-black uppercase text-white/48">{label}</div>
      <div className="mt-1 truncate text-xl font-black">{value}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
