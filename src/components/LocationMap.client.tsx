import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type LocationMapProps = {
  latitude: number;
  longitude: number;
  name: string;
  address?: string | null;
};

export function LocationMap({
  latitude,
  longitude,
  name,
  address,
}: LocationMapProps) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={16}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <CircleMarker
        center={[latitude, longitude]}
        radius={10}
        pathOptions={{
          fillOpacity: 1,
          weight: 3,
        }}
      >
        <Popup>
          <strong>{name}</strong>
          {address && <div>{address}</div>}
        </Popup>
      </CircleMarker>
    </MapContainer>
  );
}