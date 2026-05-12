const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

export async function createRoom(gameMode = "pair") {
  const response = await fetch(`${API_URL}/api/room/new`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameMode })
  });

  if (!response.ok) {
    throw new Error("Failed to create room.");
  }

  return response.json();
}
