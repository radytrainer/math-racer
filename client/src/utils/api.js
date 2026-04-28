const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

export async function createRoom() {
  const response = await fetch(`${API_URL}/api/room/new`);

  if (!response.ok) {
    throw new Error("Failed to create room.");
  }

  return response.json();
}
